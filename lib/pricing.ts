// Canonical Pro plan definitions — the /upgrade page renders from this, and
// the Stripe checkout route (Task 7) will map `priceIdEnv` to real Stripe
// Price IDs once they exist in Vercel env vars. Keep the numbers in sync with
// Stripe Dashboard → Products → WDWShiftX Pro (see TASKS.md Task 7).

import type { BillingCycle } from '@/lib/database.types'

export interface ProPlan {
  key: 'monthly' | 'quarterly' | 'semiannual' | 'annual'
  name: string
  /** Total charged per billing period, in dollars. */
  price: number
  /** Human description of the billing period. */
  per: string
  /** Effective monthly cost, for apples-to-apples display. */
  perMonth: string
  /** Savings badge; null renders no badge. */
  badge: string | null
  /** Whether the card gets the highlighted "best value" treatment. */
  featured: boolean
  /** One-line hook under the plan name. */
  hook: string
  /** Fine print under the price. */
  finePrint: string
  /** Env var that will hold this plan's Stripe Price ID. */
  priceIdEnv: string
  /** Value written to `users.billing_cycle` when this plan is active. */
  billingCycle: BillingCycle
  /**
   * Free trial length in days, or undefined for no trial. This is the ONLY
   * place the trial is configured — the checkout route passes it straight to
   * Stripe as `subscription_data.trial_period_days`, and Stripe then owns the
   * whole trial: card verification up front, the countdown, the reminder
   * email, the automatic first charge, and dunning if that charge fails.
   *
   * Trials are deliberately monthly-only. The longer plans are already
   * discounted commitments — someone choosing annual has decided, and a trial
   * on a $47.99 charge reads as friction rather than reassurance.
   *
   * (Stripe has no dashboard-level trial setting for Prices used with
   * Checkout: the price-level `trial_from_plan` route is deprecated in favour
   * of this parameter. See docs.stripe.com/payments/checkout/free-trials.)
   */
  trialDays?: number
}

export const PRO_PLANS: ProPlan[] = [
  {
    key: 'monthly',
    name: 'Monthly',
    price: 4.99,
    per: 'per month',
    perMonth: '$4.99',
    badge: null,
    featured: false,
    hook: 'Total flexibility',
    finePrint: 'Billed monthly after your free trial. Cancel anytime in two clicks.',
    priceIdEnv: 'STRIPE_PRICE_PRO_MONTHLY',
    billingCycle: 'monthly',
    trialDays: 14,
  },
  {
    key: 'quarterly',
    name: '3 Months',
    price: 13.99,
    per: 'every 3 months',
    perMonth: '$4.66',
    badge: 'SAVE 6.7%',
    featured: false,
    hook: 'A full season of Pro',
    finePrint: 'Billed $13.99 quarterly. Ideal for seasonal or part-time schedules.',
    priceIdEnv: 'STRIPE_PRICE_PRO_QUARTERLY',
    billingCycle: 'quarterly',
  },
  {
    key: 'semiannual',
    name: '6 Months',
    price: 26.99,
    per: 'every 6 months',
    perMonth: '$4.50',
    badge: 'SAVE 10%',
    featured: false,
    hook: 'Set it and forget it',
    finePrint: 'Billed $26.99 every 6 months. Lock in your schedule for the next half-year.',
    priceIdEnv: 'STRIPE_PRICE_PRO_SEMIANNUAL',
    billingCycle: 'semi_annual',
  },
  {
    key: 'annual',
    name: 'Annual',
    price: 47.99,
    per: 'per year',
    perMonth: '$4.00',
    badge: 'BEST VALUE · 2+ MONTHS FREE',
    featured: true,
    hook: 'The one most people pick',
    finePrint: 'Billed $47.99 annually — less than one shift\'s pay to protect your schedule all year.',
    priceIdEnv: 'STRIPE_PRICE_PRO_ANNUAL',
    billingCycle: 'yearly',
  },
]

/** Rows for the Basic vs Pro comparison table on /upgrade. */
export const TIER_COMPARISON: { feature: string; basic: string | boolean; pro: string | boolean; comingSoon?: boolean }[] = [
  { feature: 'Shift boards, offers & requests', basic: true, pro: true },
  { feature: 'Mark interest & comment on shifts', basic: true, pro: true },
  { feature: 'Private messaging with board-mates', basic: true, pro: true },
  { feature: 'Push notifications', basic: true, pro: true },
  { feature: 'Photo Schedule Import', basic: '4 per month', pro: 'Unlimited' },
  { feature: 'Ads', basic: 'Ad-supported', pro: 'None. Anywhere.' },
  { feature: 'Live Wall — new posts appear instantly', basic: false, pro: true },
  { feature: 'Instant match alerts by email', basic: false, pro: true },
  { feature: 'Calendar sync (Google · Apple · Outlook)', basic: false, pro: true },
  { feature: 'Premium themes (Midnight · Cyberpunk · Nordic · Kitty)', basic: false, pro: true },
  { feature: 'SMS match alerts (30/month)', basic: false, pro: true, comingSoon: true },
  { feature: 'Trade preferences — smarter matching', basic: false, pro: true, comingSoon: true },
  { feature: 'Bulk import (CSV & multi-week photos)', basic: false, pro: true, comingSoon: true },
]
