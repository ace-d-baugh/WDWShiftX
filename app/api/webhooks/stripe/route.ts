import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, isStripeConfigured, planByPriceId } from '@/lib/stripe'
import { optionalServerEnv } from '@/lib/env'
import { EMAIL_FROM } from '@/lib/email-constants'
import { paymentFailedHtml } from '@/components/email-template'
import type { BillingCycle, Membership } from '@/lib/database.types'

// Task 7: the only path that may grant or revoke Pro. Stripe is the source of
// truth for subscription state — this route just mirrors it onto users.membership.
//
// Runs with the service role because the membership/billing columns are
// write-protected against the `authenticated` role by the
// enforce_membership_protection trigger.

export const runtime = 'nodejs'
// Stripe signature verification needs the byte-exact body, so this route must
// never be statically optimized or have its body parsed upstream.
export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wdwshiftx.com'

type UserPatch = {
  membership?: Membership
  billing_cycle?: BillingCycle | null
  trial_ends_at?: string | null
  trial_used?: boolean
  stripe_subscription_id?: string | null
  stripe_customer_id?: string | null
}

/**
 * Map Stripe's subscription status onto our tier.
 *
 * `past_due` deliberately keeps Pro: Stripe is still retrying the card, and
 * yanking features mid-dunning punishes people for an expired card. The
 * `canceled` event arrives if the retries ultimately fail.
 */
function tierForStatus(status: Stripe.Subscription.Status): Membership {
  switch (status) {
    case 'trialing':
      return 'Trial'
    case 'active':
    case 'past_due':
      return 'Pro'
    default:
      // canceled, unpaid, incomplete, incomplete_expired, paused
      return 'Basic'
  }
}

/** Resolve the WDWShiftX user for a subscription: metadata first, then customer ID. */
async function findUserId(
  admin: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription
): Promise<string | null> {
  const fromMetadata = sub.metadata?.user_id
  if (fromMetadata) return fromMetadata

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  if (!customerId) return null

  const { data } = await admin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return data?.id ?? null
}

/** Apply a subscription's current state to the user record. */
async function syncSubscription(
  admin: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription
): Promise<void> {
  const userId = await findUserId(admin, sub)
  if (!userId) {
    console.error(`[stripe-webhook] No user matched subscription ${sub.id}`)
    return
  }

  const tier = tierForStatus(sub.status)
  const priceId = sub.items.data[0]?.price?.id
  const plan = planByPriceId(priceId)

  const patch: UserPatch = {
    membership: tier,
    // An unrecognized price still grants Pro; we just don't guess the cycle.
    billing_cycle: tier === 'Basic' ? null : plan?.billingCycle ?? null,
    // A canceled/expired sub keeps a trial_end timestamp on the Stripe object;
    // don't carry it onto a Basic user, or their record looks like it has a
    // pending trial. Only Trial/Pro rows keep the date.
    trial_ends_at:
      tier === 'Basic' ? null : sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    stripe_subscription_id: tier === 'Basic' ? null : sub.id,
  }

  // Burn the one free trial the moment a trialing subscription exists, so
  // cancelling during the trial and resubscribing doesn't hand out another.
  if (sub.status === 'trialing') patch.trial_used = true

  const { error } = await admin.from('users').update(patch).eq('id', userId)
  if (error) {
    // Throw so Stripe records a delivery failure and retries — silently
    // swallowing this would leave a paying customer on Basic.
    throw new Error(`Failed to update user ${userId}: ${error.message}`)
  }
}

/** Warn a customer whose renewal payment bounced, with a link to fix the card. */
async function sendPaymentFailedEmail(
  admin: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
): Promise<void> {
  if (!optionalServerEnv.RESEND_API_KEY) return

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return

  const { data: profile } = await admin
    .from('users')
    .select('email, display_name, notify_via_email')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  // Billing problems are transactional, but honour the same opt-out the rest
  // of the app respects — Stripe also emails its own dunning notices.
  if (!profile?.email || !profile.notify_via_email) return

  try {
    const resend = new Resend(optionalServerEnv.RESEND_API_KEY)
    await resend.emails.send({
      from: EMAIL_FROM,
      to: profile.email,
      subject: 'Your WDWShiftX Pro payment did not go through',
      html: paymentFailedHtml({
        displayName: profile.display_name ?? undefined,
        amountDue: (invoice.amount_due ?? 0) / 100,
        billingUrl: `${BASE_URL}/profile#membership`,
      }),
    })
  } catch (err) {
    // A failed courtesy email must not fail the webhook — Stripe would retry
    // the whole event and re-run the membership sync for no reason.
    console.error('[stripe-webhook] payment_failed email error:', err)
  }
}

export async function POST(req: NextRequest) {
  const secret = optionalServerEnv.STRIPE_WEBHOOK_SECRET
  if (!isStripeConfigured() || !secret || !optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[stripe-webhook] Not configured — rejecting event')
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    // Raw text, not req.json() — the signature covers the exact bytes sent.
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription' || !session.subscription) break
        // Re-retrieve rather than trusting the session snapshot: by the time
        // this arrives the subscription may already be trialing vs active.
        const subId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id
        const sub = await stripe.subscriptions.retrieve(subId)

        // The session knows the user even if subscription metadata is missing.
        const userId = session.client_reference_id ?? session.metadata?.user_id
        if (userId && !sub.metadata?.user_id) {
          sub.metadata = { ...sub.metadata, user_id: userId }
        }
        if (userId) {
          const customerId =
            typeof session.customer === 'string' ? session.customer : session.customer?.id
          if (customerId) {
            await admin.from('users').update({ stripe_customer_id: customerId }).eq('id', userId)
          }
        }
        await syncSubscription(admin, sub)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // deleted carries the final state (status: 'canceled'), so the same
        // sync path correctly drops the user to Basic.
        await syncSubscription(admin, event.data.object)
        break
      }

      case 'invoice.payment_failed': {
        await sendPaymentFailedEmail(admin, event.data.object)
        break
      }

      default:
        // Unhandled types are fine — acknowledge so Stripe stops retrying.
        break
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, err)
    // 500 tells Stripe to retry with backoff.
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
