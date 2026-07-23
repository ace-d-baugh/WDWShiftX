'use client'

import { useState } from 'react'
import { HeartHandshake as Handshake, Check, X } from 'lucide-react'
import { claimShift, respondToClaim, withdrawClaim } from '@/app/actions/claims'
import { cn } from '@/lib/utils'
import type { ClaimStatus } from '@/lib/database.types'

export interface TradeStats {
  picked_up: number
  covered: number
  fell_through: number
}

export interface MyClaim {
  id: string
  status: ClaimStatus
}

export interface PendingClaim {
  id: string
  claimant_id: string
  claimant_name: string
  stats?: TradeStats
}

/** One-line reliability summary shown next to a claimant's name. */
function statsLabel(stats?: TradeStats): string {
  if (!stats) return 'No trades yet'
  const done = stats.picked_up + stats.covered
  if (done === 0 && stats.fell_through === 0) return 'No trades yet'
  const parts = [`${done} completed`]
  if (stats.fell_through > 0) parts.push(`${stats.fell_through} fell through`)
  return parts.join(' · ')
}

interface ClaimSectionProps {
  pendingClaims?: PendingClaim[]
  /** Called after any successful claim action so the parent can refresh. */
  onChanged?: () => void
}

/**
 * Trade Loop (Task 21) — owner-only claim management panel: a list of every
 * pending claimant with Accept/Decline and each one's reliability record.
 * Accepting archives the post as covered and auto-declines the rest. Renders
 * nothing once there's nothing to decide on (no pending claims).
 */
export function ClaimSection({ pendingClaims, onChanged }: ClaimSectionProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<{ error?: string }>) => {
    setBusy(key)
    setError(null)
    const res = await fn()
    setBusy(null)
    if (res.error) setError(res.error)
    else onChanged?.()
  }

  if (!pendingClaims || pendingClaims.length === 0) return null

  return (
    <div className="mb-3 rounded-md border border-primary/30 bg-primary-light/40 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
        <Handshake className="w-3.5 h-3.5" />
        {pendingClaims.length === 1 ? 'Someone wants this shift' : `${pendingClaims.length} people want this shift`}
      </p>
      <ul className="space-y-2">
        {pendingClaims.map(claim => (
          <li key={claim.id} className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-text">{claim.claimant_name}</span>
              <span className="block text-[11px] text-text/50">{statsLabel(claim.stats)}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => run(`accept-${claim.id}`, () => respondToClaim(claim.id, true))}
                disabled={busy !== null}
                className="inline-flex items-center gap-1 rounded-md bg-success px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-success/90 disabled:opacity-50 min-h-0"
              >
                <Check className="w-3.5 h-3.5" />
                {busy === `accept-${claim.id}` ? 'Accepting…' : 'Accept'}
              </button>
              <button
                onClick={() => run(`decline-${claim.id}`, () => respondToClaim(claim.id, false))}
                disabled={busy !== null}
                className="inline-flex items-center gap-1 rounded-md border border-warning/50 px-2.5 py-1.5 text-xs font-semibold text-warning transition-colors hover:bg-warning/10 disabled:opacity-50 min-h-0"
              >
                <X className="w-3.5 h-3.5" />
                {busy === `decline-${claim.id}` ? 'Declining…' : 'Decline'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-text/50">
        Accepting marks this post as covered — complete the actual trade in your company system.
      </p>
      {error && <p className="mt-1 text-xs text-warning">{error}</p>}
    </div>
  )
}

interface ClaimPillProps {
  shiftId: string
  myClaim?: MyClaim | null
  /** Total pending claimants on this shift — visible to any viewer, not just
   * the owner (a bare count isn't sensitive; who claimed stays private). */
  claimCount: number
  onChanged?: () => void
}

/**
 * Non-owner "I'll take this" control — lives inline in the card's action
 * row (where the old Interested pill used to sit). A toggle: border-only
 * when you haven't claimed, filled once you have. Clicking the filled state
 * withdraws the claim. A declined claim shows as a plain muted label.
 */
export function ClaimPill({ shiftId, myClaim, claimCount, onChanged }: ClaimPillProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<{ error?: string }>) => {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (res.error) setError(res.error)
    else onChanged?.()
  }

  if (myClaim?.status === 'declined') {
    return (
      <span className="badge bg-text/10 text-text/40 inline-flex items-center gap-1 shrink-0">
        <X className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Declined</span>
      </span>
    )
  }

  const pending = myClaim?.status === 'pending'

  return (
    <>
      <button
        type="button"
        onClick={() => run(() => pending ? withdrawClaim(myClaim!.id) : claimShift(shiftId))}
        disabled={busy}
        title={pending ? 'Claim sent — tap to withdraw' : "I'll take this"}
        className={cn(
          'badge inline-flex items-center gap-1 transition-colors shrink-0 disabled:opacity-60',
          pending
            ? 'bg-primary text-white hover:bg-primary/90'
            : 'border border-primary text-primary bg-transparent hover:bg-primary-light cursor-pointer'
        )}
      >
        <Handshake className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">I&apos;ll take this</span> ({claimCount})
      </button>
      {error && <p className="text-xs text-warning w-full mt-1">{error}</p>}
    </>
  )
}
