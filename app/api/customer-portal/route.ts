import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { optionalServerEnv } from '@/lib/env'

// Task 7: hands the user off to Stripe's hosted Customer Portal, where they
// can change plan, update their card, download invoices, and cancel. All of
// that is Stripe's UI — we only mint the short-lived session link.

export const runtime = 'nodejs'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wdwshiftx.com'

export async function POST() {
  if (!isStripeConfigured() || !optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Billing is not available yet.' }, { status: 503 })
  }

  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please log in.' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Start a subscription first.' },
        { status: 404 }
      )
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${BASE_URL}/profile#membership`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[customer-portal] Failed to create session:', err)
    return NextResponse.json(
      { error: 'Could not open the billing portal. Please try again.' },
      { status: 500 }
    )
  }
}
