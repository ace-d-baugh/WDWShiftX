import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, isStripeConfigured, planByKey, priceIdForPlan } from '@/lib/stripe'
import { optionalServerEnv } from '@/lib/env'

// Task 7: creates the Stripe Checkout Session the /upgrade buttons send users
// to. The client sends only a plan KEY — the Price ID is resolved server-side
// so a tampered request can't check out against an arbitrary price.

export const runtime = 'nodejs'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wdwshiftx.com'

const bodySchema = z.object({
  plan: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']),
})

export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Checkout is not available yet.' }, { status: 503 })
  }

  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please log in to upgrade.' }, { status: 401 })
  }

  let parsed
  try {
    parsed = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid plan selection.' }, { status: 400 })
  }

  const plan = planByKey(parsed.plan)
  const priceId = plan ? priceIdForPlan(plan) : undefined
  if (!plan || !priceId) {
    // A plan exists in pricing.ts but its STRIPE_PRICE_* env var is missing.
    console.error(`[checkout] No Price ID configured for plan "${parsed.plan}"`)
    return NextResponse.json({ error: 'That plan is not available right now.' }, { status: 503 })
  }

  try {
    const stripe = getStripe()
    const admin = createAdminClient()

    // Membership + billing columns are service-role only, so read them here
    // rather than through the user's own client.
    const { data: profile } = await admin
      .from('users')
      .select('email, display_name, membership, trial_used, stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profile?.membership === 'Pro') {
      return NextResponse.json(
        { error: "You're already a Pro member. Manage your plan in the billing portal." },
        { status: 409 }
      )
    }

    // Reuse the existing Stripe Customer when there is one, so a returning
    // subscriber keeps one customer record (and one invoice history) instead
    // of accumulating duplicates on every checkout attempt.
    let customerId = profile?.stripe_customer_id ?? undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email ?? undefined,
        name: profile?.display_name ?? undefined,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
      await admin.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    // Trials are once per account. `trial_used` is set by the webhook when a
    // trialing subscription starts, so a cancel-and-resubscribe loop can't
    // farm free months.
    const offerTrial = Boolean(plan.trialDays) && !profile?.trial_used

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      // Omit payment_method_types entirely — Stripe picks the eligible methods
      // dynamically from the Dashboard settings, which converts better than a
      // hardcoded card-only list.
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(offerTrial ? { trial_period_days: plan.trialDays } : {}),
        // Stamped on the subscription itself so later customer.subscription.*
        // events can be matched to a user without a database round-trip.
        metadata: { user_id: user.id, plan: plan.key },
      },
      // Task 9 will add coupons in the Dashboard; this renders the input now.
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan: plan.key },
      success_url: `${BASE_URL}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/upgrade`,
      integration_identifier: 'wdwshiftx-pro-kwbdhnzt',
    })

    if (!session.url) {
      throw new Error('Stripe returned a session without a redirect URL')
    }
    return NextResponse.json({ url: session.url })
  } catch (err) {
    // Never surface the raw Stripe error — it can echo request details.
    console.error('[checkout] Failed to create session:', err)
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again.' },
      { status: 500 }
    )
  }
}
