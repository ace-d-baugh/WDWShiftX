'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HeartHandshake as Handshake, Check, X, Layers, Send, ChevronDown } from 'lucide-react'
import { claimShift, claimBundle, respondToClaim, withdrawClaim } from '@/app/actions/claims'
import { messageAboutShift } from '@/app/actions/messages'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { ClaimStatus } from '@/lib/database.types'

export interface MyClaim {
  id: string
  status: ClaimStatus
}

export interface PendingClaim {
  id: string
  claimant_id: string
  claimant_name: string
  /** Set when the claim covers a whole bundle — accepting archives them all. */
  bundleSize?: number
}

// A claimant's trade record used to be summarised here so the owner could
// weigh reliability. It was removed deliberately: a "3 fell through" line is
// effectively a disciplinary note, and showing it to other members is not
// something the app should do. Trade stats are now visible only to the person
// they describe (Profile -> Trade Record) and to Overlord.

interface InterestedPillProps {
  count: number
  open: boolean
  onToggle: () => void
}

/**
 * Owner-side counterpart to ClaimPill: "(N) Interested". Claiming never
 * removes a post from the Wall — everyone who wants it stacks up here so the
 * owner can pick (seniority, union rules, whatever they go by) rather than
 * it being first-come-first-served. Opens the ClaimSection accordion below.
 */
export function InterestedPill({ count, open, onToggle }: InterestedPillProps) {
  const none = count === 0
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={none}
      title={none ? 'Nobody has asked for this shift yet' : `${count} interested — tap to review`}
      className={cn(
        'badge inline-flex items-center gap-1 transition-colors shrink-0',
        none
          ? 'bg-text/10 text-text/50 cursor-default'
          : 'bg-primary text-white hover:bg-primary/90 cursor-pointer'
      )}
    >
      <Handshake className="w-3.5 h-3.5" />
      ({count}) <span className="hidden sm:inline">Interested</span>
      {!none && <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />}
    </button>
  )
}

interface ClaimSectionProps {
  pendingClaims?: PendingClaim[]
  /** Prewritten shift details dropped into the chat on Accept or Message, so
   *  neither side has to retype which shift they're talking about. */
  shiftSummary?: string
  /** Called after any successful claim action so the parent can refresh. */
  onChanged?: () => void
}

/**
 * Owner-only accordion listing everyone who tapped "I'll take this", newest
 * information first: name, reliability record, then Accept and Message.
 * Accepting archives the post as covered, auto-declines the rest, and opens a
 * chat with the shift details already posted; Message opens that same chat
 * without committing, so the owner can ask questions before deciding.
 */
export function ClaimSection({ pendingClaims, shiftSummary, onChanged }: ClaimSectionProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openChat = async (claimantId: string): Promise<string | null> => {
    const res = await messageAboutShift(claimantId, shiftSummary ?? 'About my shift on WDWShiftX.')
    if (!res.conversationId) {
      setError(res.error ?? 'Could not open the conversation.')
      return null
    }
    return res.conversationId
  }

  const handleAccept = async (claim: PendingClaim) => {
    setBusy(`accept-${claim.id}`)
    setError(null)
    const res = await respondToClaim(claim.id, true)
    if (res.error) {
      setBusy(null)
      setError(res.error)
      return
    }
    onChanged?.()
    const conversationId = await openChat(claim.claimant_id)
    setBusy(null)
    if (conversationId) router.push(`/messages/${conversationId}`)
  }

  const handleMessage = async (claim: PendingClaim) => {
    setBusy(`msg-${claim.id}`)
    setError(null)
    const conversationId = await openChat(claim.claimant_id)
    setBusy(null)
    if (conversationId) router.push(`/messages/${conversationId}`)
  }

  if (!pendingClaims || pendingClaims.length === 0) return null

  const isBundle = pendingClaims.some(c => (c.bundleSize ?? 0) > 1)

  return (
    <div className="mt-3 rounded-md border border-primary/30 bg-primary-light/40 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
        <Handshake className="w-3.5 h-3.5" />
        {pendingClaims.length === 1 ? 'Someone wants this shift' : `${pendingClaims.length} people want this shift`}
      </p>
      <ul className="space-y-2">
        {pendingClaims.map(claim => (
          <li key={claim.id} className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-text">{claim.claimant_name}</span>
              {claim.bundleSize && claim.bundleSize > 1 && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full leading-none align-middle">
                  <Layers className="w-2.5 h-2.5" />
                  all {claim.bundleSize}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleAccept(claim)}
                disabled={busy !== null}
                className="inline-flex items-center gap-1 rounded-md bg-success px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-success/90 disabled:opacity-50 min-h-0"
              >
                <Check className="w-3.5 h-3.5" />
                {busy === `accept-${claim.id}` ? 'Accepting…' : 'Accept'}
              </button>
              <button
                onClick={() => handleMessage(claim)}
                disabled={busy !== null}
                title={`Message ${claim.claimant_name}`}
                className="inline-flex items-center gap-1 rounded-md border border-primary/50 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-light disabled:opacity-50 min-h-0"
              >
                <Send className="w-3.5 h-3.5" />
                {busy === `msg-${claim.id}` ? 'Opening…' : 'Message'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-text/50">
        {isBundle
          ? 'Accepting marks every shift in the bundle as covered and opens a chat with the details — complete the actual trade in your company system.'
          : 'Accepting marks this post as covered and opens a chat with the details — complete the actual trade in your company system.'}
      </p>
      {error && <p className="mt-1 text-xs text-warning">{error}</p>}
    </div>
  )
}

interface ClaimPillProps {
  shiftId: string
  /** Set when this shift is part of a bundle — claiming takes the whole set. */
  bundleId?: string | null
  /** Every active shift in the bundle, for the confirmation modal's list. */
  bundleSiblings?: { id: string; shift_title: string; start_time: string }[]
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
export function ClaimPill({ shiftId, bundleId, bundleSiblings, myClaim, claimCount, onChanged }: ClaimPillProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmBundle, setConfirmBundle] = useState(false)

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
  const siblings = bundleSiblings ?? []

  // Bundled shifts go through a confirmation first — taking one means taking
  // all of them, which isn't obvious from a single card.
  const handleClick = () => {
    if (pending) return run(() => withdrawClaim(myClaim!.id))
    if (bundleId) { setConfirmBundle(true); return }
    return run(() => claimShift(shiftId))
  }

  const confirm = async () => {
    setConfirmBundle(false)
    await run(() => claimBundle(bundleId!))
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={pending
          ? 'Claim sent — tap to withdraw'
          : bundleId ? "I'll take this bundle" : "I'll take this"}
        className={cn(
          'badge inline-flex items-center gap-1 transition-colors shrink-0 disabled:opacity-60',
          pending
            ? 'bg-primary text-white hover:bg-primary/90'
            : 'border border-primary text-primary bg-transparent hover:bg-primary-light cursor-pointer'
        )}
      >
        {bundleId ? <Layers className="w-3.5 h-3.5" /> : <Handshake className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">
          {bundleId ? "I'll take all" : "I'll take this"}
        </span> ({claimCount})
      </button>
      {pending && (
        <p className="text-[11px] text-text/50 w-full mt-1">
          Sent — waiting on the owner to accept. Message them to coordinate the handoff.
        </p>
      )}
      {error && <p className="text-xs text-warning w-full mt-1">{error}</p>}

      <Modal open={confirmBundle} onClose={() => setConfirmBundle(false)} size="sm"
        title={siblings.length ? `Take all ${siblings.length} bundled shifts?` : 'Take all bundled shifts?'}>
        <p className="text-sm text-text/70 mb-3">
          These shifts are offered together — claiming means you&apos;d cover every one of them:
        </p>
        {siblings.length > 0 && (
          <ul className="mb-4 rounded-md border border-border divide-y divide-border max-h-48 overflow-y-auto">
            {siblings.map(s => (
              <li key={s.id} className="px-3 py-2 text-sm text-text">
                <span className="block truncate">{s.shift_title}</span>
                <span className="block text-[11px] text-text/50">
                  {new Date(s.start_time).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-text/60 bg-primary-light/30 border border-primary/15 rounded-lg px-3 py-2.5 leading-relaxed mb-5">
          This just shows interest — the owner still has to accept. Once they do,
          message them to work out the details.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmBundle(false)}>Cancel</Button>
          <Button size="sm" onClick={confirm} loading={busy}>Yes, take all</Button>
        </div>
      </Modal>
    </>
  )
}
