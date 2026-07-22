import Stripe from 'stripe'
import { optionalServerEnv } from '@/lib/env'
import { PRO_PLANS, type ProPlan } from '@/lib/pricing'

/**
 * Server-only Stripe helpers (Task 7). Never import from a client component —
 * this module reads the secret key.
 *
 * Every entry point is gated on STRIPE_SECRET_KEY, matching the env-flip
 * pattern used by AdSense, push, and the schedule importer: with the key
 * unset the whole checkout surface stays in "Launching Soon" mode instead of
 * erroring.
 */

let client: Stripe | null = null

/** Whether checkout is live. Cheap enough to call in a render path. */
export function isStripeConfigured(): boolean {
  return Boolean(optionalServerEnv.STRIPE_SECRET_KEY)
}

/**
 * Memoized Stripe client. Pinned to the SDK's own API version rather than
 * floating, so a future `npm update stripe` can't silently change response
 * shapes under the webhook handler.
 */
export function getStripe(): Stripe {
  const key = optionalServerEnv.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY is unset).')
  if (!client) {
    client = new Stripe(key, {
      apiVersion: '2026-06-24.dahlia',
      typescript: true,
      appInfo: { name: 'WDWShiftX', url: 'https://wdwshiftx.com' },
    })
  }
  return client
}

/**
 * The Stripe Price ID for a plan, from the env var named on the plan.
 * Read dynamically because these are server-only (no NEXT_PUBLIC_ inlining
 * to worry about) and it keeps the plan list the single source of truth.
 */
export function priceIdForPlan(plan: ProPlan): string | undefined {
  const id = process.env[plan.priceIdEnv]
  return id && id.trim() ? id.trim() : undefined
}

/** Look up a plan by its `key`, as sent from the upgrade page. */
export function planByKey(key: string): ProPlan | undefined {
  return PRO_PLANS.find(p => p.key === key)
}

/**
 * Reverse lookup used by the webhook: given the Price ID Stripe reports on a
 * subscription, which plan is it? Returns undefined for prices we don't know
 * about (e.g. a legacy or manually-created price), in which case the caller
 * still grants Pro but leaves billing_cycle null rather than guessing.
 */
export function planByPriceId(priceId: string | null | undefined): ProPlan | undefined {
  if (!priceId) return undefined
  return PRO_PLANS.find(p => priceIdForPlan(p) === priceId)
}
