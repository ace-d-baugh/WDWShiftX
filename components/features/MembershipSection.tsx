'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react'

interface MembershipSectionProps {
  tier: 'Basic' | 'Pro' | 'Trial'
  /** ISO timestamp — only set while tier is 'Trial'. */
  trialEndsAt?: string | null
  /** False until STRIPE_SECRET_KEY is set, matching the /upgrade gate. */
  billingEnabled: boolean
}

const CYCLE_COPY: Record<'Pro' | 'Trial', string> = {
  Pro: 'Your subscription is active. Thanks for supporting WDWShiftX.',
  Trial: 'You’re on a free trial with full Pro access.',
}

/**
 * Membership + billing card on Profile (Task 7). Everything transactional —
 * changing plan, updating the card, downloading invoices, cancelling — happens
 * in Stripe's hosted Customer Portal rather than being rebuilt here.
 */
export function MembershipSection({ tier, trialEndsAt, billingEnabled }: MembershipSectionProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trialEnds = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  async function openPortal() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/customer-portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Could not open the billing portal.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div id="membership" className="card shadow-sm scroll-mt-20">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-accent text-lg font-bold text-text">Membership</h2>
          <p className="text-xs text-text/50">
            {tier === 'Basic' ? 'You’re on the free plan' : CYCLE_COPY[tier]}
          </p>
        </div>
      </div>

      {tier === 'Trial' && trialEnds && (
        <p className="text-sm text-text/70 mb-4">
          Your trial runs through <strong className="text-text">{trialEnds}</strong>. Your first
          payment happens the day after — cancel before then and you won&apos;t be charged.
        </p>
      )}

      {tier === 'Basic' ? (
        <Link href="/upgrade" className="btn btn-primary w-full sm:w-auto">
          See what Pro unlocks ⭐
        </Link>
      ) : billingEnabled ? (
        <>
          <button
            onClick={openPortal}
            disabled={loading}
            className={`btn btn-outline w-full sm:w-auto gap-2 ${loading ? 'opacity-70 cursor-wait' : ''}`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            )}
            {loading ? 'Opening…' : 'Manage Billing'}
          </button>
          <p className="text-xs text-text/50 mt-3">
            Change your plan, update your card, download invoices, or cancel — all handled securely
            by Stripe.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-xs text-warning">
              {error}
            </p>
          )}
        </>
      ) : null}
    </div>
  )
}
