'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, CalendarDays, LayoutDashboard, Bell, ArrowRight, Ticket, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { dismissOnboarding } from '@/app/actions/onboarding'
import { lookupBoardByCode, confirmJoinBoard } from '@/app/actions/boards'
import { ScheduleImportModal } from '@/components/features/ScheduleImportModal'
import { MyBoardsSection } from '@/components/features/MyBoardsSection'
import { PushNotificationsToggle } from '@/components/features/PushNotificationsToggle'
import { IosInstallPrompt } from '@/components/features/IosInstallPrompt'
import { cn } from '@/lib/utils'

const PENDING_INVITE_KEY = 'wdwshiftx-pending-invite'

interface WelcomeClientProps {
  userId: string
  displayName: string
  importEnabled: boolean
  initialShiftCount: number
  initialBoardCount: number
}

/** Number while pending; the site-wide yellow star once the step is done. */
function StepBadge({ n, done }: { n: number; done: boolean }) {
  if (done) {
    return (
      <div className="w-8 h-8 flex items-center justify-center shrink-0">
        <Star className="w-7 h-7 text-secondary-accent" fill="#ffea80" strokeWidth={0} />
      </div>
    )
  }
  return (
    <div className={cn(
      'w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm',
      'bg-primary/15 text-primary'
    )}>
      {n}
    </div>
  )
}

/**
 * Task 22 onboarding wizard (v3 — display name comes from registration, so
 * three easy steps): (1) join or create a board — an invite code carried
 * through registration (QR / share link) is redeemed automatically,
 * (2) schedule import (useful solo even while a join request is pending),
 * (3) push notifications. Completed steps swap their number for the yellow
 * star used across the site.
 */
export function WelcomeClient({ userId, displayName, importEnabled, initialShiftCount, initialBoardCount }: WelcomeClientProps) {
  const supabase = createClient()
  const router = useRouter()

  const [shiftCount, setShiftCount] = useState(initialShiftCount)
  const [boardCount, setBoardCount] = useState(initialBoardCount)
  const [importOpen, setImportOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Invite code redeemed from registration (QR / share link)
  const [inviteNotice, setInviteNotice] = useState<string | null>(null)
  const inviteAttempted = useRef(false)

  const refreshCounts = useCallback(async () => {
    const [{ count: sc }, { count: bc }] = await Promise.all([
      supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true),
      supabase.from('user_boards').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])
    if (sc !== null) setShiftCount(sc)
    if (bc !== null) setBoardCount(bc)
  }, [supabase, userId])

  // Counts change from inside the embedded import modal / boards section, so
  // refresh whenever the tab regains focus and when the import modal closes.
  useEffect(() => {
    const onFocus = () => { refreshCounts().catch(() => {}) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshCounts])

  // Redeem a pending invite code once: localStorage first (same-device
  // registration), signup metadata as the cross-device fallback.
  useEffect(() => {
    if (inviteAttempted.current || initialBoardCount > 0) return
    inviteAttempted.current = true

    const attempt = async () => {
      let code: string | null = null
      try { code = localStorage.getItem(PENDING_INVITE_KEY) } catch {}
      if (!code) {
        const { data } = await supabase.auth.getUser()
        code = (data.user?.user_metadata?.invite_code as string | undefined) ?? null
      }
      if (!code) return

      const res = await lookupBoardByCode(code)
      if (res.board) {
        const join = await confirmJoinBoard(res.board.id, true)
        if (!join.error) {
          setInviteNotice(`Your request to join ${res.board.name} was sent — a board admin will approve you shortly.`)
          await refreshCounts().catch(() => {})
        }
      }
      // One shot either way — clear so a stale/used code never loops.
      try { localStorage.removeItem(PENDING_INVITE_KEY) } catch {}
      supabase.auth.updateUser({ data: { invite_code: null } }).catch(() => {})
    }
    attempt().catch(() => {})
  }, [initialBoardCount, supabase, refreshCounts])

  const finish = async () => {
    setLeaving(true)
    await dismissOnboarding().catch(() => {})
    router.push('/wall')
  }

  const scheduleDone = shiftCount > 0
  const boardsDone = boardCount > 0
  const firstName = displayName.replace(/ [A-Z]\.$/, '')

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="font-accent text-3xl font-bold text-text mb-2">
          Welcome{firstName ? `, ${firstName}` : ''}! 👋
        </h1>
        <p className="text-text/60 text-sm">
          Three easy steps and WDWShiftX starts working for you.
        </p>
      </div>

      <div className="space-y-4">
        {/* Step 1 — join the crew (invite code input or create a board) */}
        <div className="card shadow-sm">
          <div className="flex items-start gap-3">
            <StepBadge n={1} done={boardsDone} />
            <div className="flex-1 min-w-0">
              <h2 className="font-accent font-bold text-text">Join your board</h2>
              {inviteNotice && (
                <div className="mt-2 mb-1 p-2.5 rounded-md bg-success/10 border border-success/20 text-sm flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-success shrink-0" />
                  <span className="text-text/80">{inviteNotice}</span>
                </div>
              )}
              <p className="text-sm text-text/60 mt-1 mb-3">
                Boards are private groups where your coworkers trade shifts. Enter your
                team&apos;s 7-character invite code below to join.
              </p>
              <MyBoardsSection
                key={inviteNotice ? 'invite-joined' : 'initial'}
                userId={userId}
                showJoin
              />
            </div>
          </div>
        </div>

        {/* Step 2 — schedule on the calendar (useful even while approval is pending) */}
        <div className="card shadow-sm">
          <div className="flex items-start gap-3">
            <StepBadge n={2} done={scheduleDone} />
            <div className="flex-1 min-w-0">
              <h2 className="font-accent font-bold text-text">Put your schedule on your calendar</h2>
              {scheduleDone ? (
                <p className="text-sm text-success mt-1">
                  ✓ {shiftCount} shift{shiftCount === 1 ? '' : 's'} on your calendar — nice.{' '}
                  <Link href="/calendar" className="text-primary hover:underline">View it</Link>
                </p>
              ) : (
                <>
                  <p className="text-sm text-text/60 mt-1 mb-3">
                    {importEnabled
                      ? 'Snap a photo of your work schedule — paper or screen — and watch it land on your calendar in seconds. Works even while your join request is pending.'
                      : 'Add your shifts so your schedule is always in your pocket — even while your join request is pending.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {importEnabled && (
                      <button onClick={() => setImportOpen(true)} className="btn btn-primary gap-1.5 text-sm px-4 py-2 min-h-0">
                        <Camera className="w-4 h-4" /> Import from a photo
                      </button>
                    )}
                    <Link href="/calendar" className="text-sm text-primary hover:underline flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" /> {importEnabled ? 'or add shifts manually' : 'Open My Calendar'}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Step 3 — notifications */}
        <div className="card shadow-sm">
          <div className="flex items-start gap-3">
            <StepBadge n={3} done={false} />
            <div className="flex-1 min-w-0">
              <h2 className="font-accent font-bold text-text flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-info" /> Never miss a shift
              </h2>
              <p className="text-sm text-text/60 mt-1 mb-3">
                Shifts go fast — the first person to hear about one usually gets it. Turn on push
                notifications so claims and matches reach you instantly. Email updates are already on;
                manage both anytime in your <Link href="/profile" className="text-primary hover:underline">profile</Link>.
              </p>
              <PushNotificationsToggle />
              {/* iOS browser tab: the toggle above hides itself — show the
                  Home Screen install walkthrough instead (Task 23) */}
              <IosInstallPrompt variant="inline" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <button onClick={finish} disabled={leaving} className="btn btn-primary gap-1.5 px-6">
          <LayoutDashboard className="w-4 h-4" />
          {leaving ? 'Loading…' : 'Take me to the Wall'}
          <ArrowRight className="w-4 h-4" />
        </button>
        <button onClick={finish} disabled={leaving} className="text-xs text-text/40 hover:text-text/70 transition-colors min-h-0">
          Skip for now — I&apos;ll set up later
        </button>
      </div>

      <ScheduleImportModal
        userId={userId}
        displayName={displayName || 'User'}
        open={importOpen}
        onClose={() => { setImportOpen(false); refreshCounts().catch(() => {}) }}
      />
    </div>
  )
}
