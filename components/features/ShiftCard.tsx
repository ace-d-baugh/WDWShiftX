'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { parseISO } from 'date-fns'
import { getSettings } from '@/lib/settings'
import { slugify } from '@/lib/slug'
import {
  Clock, LayoutGrid, User, Flag, Pencil, Trash2,
  MoreVertical, MessageSquare, Star, Send, ChevronDown, HeartHandshake as Handshake,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { FlagModal } from '@/components/features/FlagModal'
import { CommentSection } from '@/components/features/CommentSection'
import { ClaimSection, type MyClaim, type PendingClaim, type TradeStats } from '@/components/features/ClaimSection'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'

export interface ShiftData {
  id: string
  shift_title: string
  created_by: string
  user_id: string | null
  board_id: string | null
  board_name: string
  start_time: string
  end_time: string
  is_trade: boolean
  is_giveaway: boolean
  is_overtime_approved: boolean
  details: string | null
  is_active: boolean
  expires_at: string
  created_at: string
  comment_count?: number
  interested_count?: number
  contactReady?: boolean
}

interface ShiftCardProps {
  shift: ShiftData
  currentUserId?: string
  currentUserName?: string
  onDeactivate?: (id: string) => void
  /** Trade Loop (Task 21) — supplied by WallClient */
  myClaim?: MyClaim | null
  pendingClaims?: PendingClaim[]
  posterStats?: TradeStats
  onClaimChanged?: () => void
}

export function ShiftCard({
  shift, currentUserId, currentUserName, onDeactivate,
  myClaim, pendingClaims, posterStats, onClaimChanged,
}: ShiftCardProps) {
  const router = useRouter()
  const [flagOpen, setFlagOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [openCommentsTick, setOpenCommentsTick] = useState(0)
  const [interestTick, setInterestTick] = useState(0)
  const [messageTick, setMessageTick] = useState(0)

  const isOwner = currentUserId && shift.user_id === currentUserId
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const [tz, setTz] = useState('America/New_York')
  useEffect(() => { const s = getSettings(); setTimeFormat(s.timeFormat); setTz(s.timezone) }, [])

  // Close menu on any scroll
  const menuOpen = !!menuPos
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuPos(null)
    document.addEventListener('scroll', close, { passive: true, capture: true })
    return () => document.removeEventListener('scroll', close, { capture: true })
  }, [menuOpen])

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const W = 192 // w-48
    const left = Math.max(8, Math.min(rect.right - W, window.innerWidth - W - 8))
    setMenuPos({ top: rect.bottom + 4, left })
  }

  const duration = () => {
    const start = parseISO(shift.start_time)
    const end = parseISO(shift.end_time)
    const diffMs = end.getTime() - start.getTime()
    const hours = Math.floor(diffMs / 3600000)
    const mins = Math.floor((diffMs % 3600000) / 60000)
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const timePat   = timeFormat === '24h' ? 'HH:mm' : 'h:mm a'
  const startTime = formatInTimeZone(parseISO(shift.start_time), tz, timePat)
  const endTime   = formatInTimeZone(parseISO(shift.end_time),   tz, timePat)

  // Derive shift type for consistent colour theming
  const isBoth      = shift.is_trade && shift.is_giveaway
  const isTradeOnly = shift.is_trade && !shift.is_giveaway
  const isGiveOnly  = !shift.is_trade && shift.is_giveaway
  const typeColor   = isBoth ? 'text-primary' : isTradeOnly ? 'text-info' : isGiveOnly ? 'text-success' : 'text-text/40'
  const borderColor = isBoth ? 'border-l-primary' : isTradeOnly ? 'border-l-info' : isGiveOnly ? 'border-l-success' : 'border-l-text/20'

  // Completed-trade count badge next to the poster's name (Trade Loop)
  const posterTrades = posterStats ? posterStats.picked_up + posterStats.covered : 0
  const tradeBadge = posterTrades > 0 && (
    <span
      title={`${posterTrades} completed trade${posterTrades === 1 ? '' : 's'} on WDWShiftX`}
      className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-success/15 text-success px-1.5 py-0.5 rounded-full leading-none"
    >
      <Handshake className="w-2.5 h-2.5" />
      {posterTrades}
    </span>
  )

  const menuItemCls = 'flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors text-text/80 hover:bg-primary-light/50 hover:text-text'
  const menuDangerCls = 'flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors text-warning hover:bg-warning/10'
  const menuDisabledCls = 'flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-text/25 cursor-not-allowed'

  return (
    <>
      <div className={cn(
        'card border-l-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
        borderColor,
        isOwner && 'bg-primary-light/30'
      )}>
        {/* Row 1: Title (full-width on mobile) | Poster name + ⋮ on sm+ */}
        <div className="mb-1">
          <div className="flex items-start gap-2">
            <h3 className={cn('font-accent font-bold text-lg leading-snug flex-1 min-w-0 break-words hyphens-auto', typeColor)}>
              {shift.shift_title}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              {/* Name hidden on mobile, visible sm+ */}
              <span className="hidden sm:flex text-xs text-text/50 items-center gap-1.5 whitespace-nowrap">
                <User className={cn('w-3 h-3 shrink-0', typeColor)} />
                {shift.created_by}
                {tradeBadge}
                {isOwner && (
                  <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full leading-none">you</span>
                )}
              </span>
              <button onClick={openMenu}
                className="p-1 rounded text-text/40 hover:text-text hover:bg-primary-light/50 transition-colors min-h-0 min-w-0 ml-0.5"
                aria-label="More options">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Mobile-only: poster name below title */}
          <div className="sm:hidden flex items-center gap-1.5 mt-0.5 text-xs text-text/50">
            <User className={cn('w-3 h-3 shrink-0', typeColor)} />
            {shift.created_by}
            {tradeBadge}
            {isOwner && (
              <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full leading-none">you</span>
            )}
          </div>
        </div>

        {/* Row 2: Times + chevron toggle */}
        <div className="flex items-center gap-1.5 text-base font-medium text-text/80 mb-3">
          <Clock className={cn('w-3.5 h-3.5 shrink-0', typeColor)} />
          {startTime}
          <span className="text-text/40 mx-0.5">→</span>
          {endTime}
          <span className="text-text/40 font-normal text-xs ml-1">({duration()})</span>
          <button
            onClick={() => setDetailsOpen(o => !o)}
            className="ml-auto p-0.5 text-text/40 hover:text-primary min-h-0 min-w-0"
            aria-label="Toggle details"
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', detailsOpen && 'rotate-180')} />
          </button>
        </div>

        {/* Collapsible: notes + board */}
        <div className={detailsOpen ? 'block' : 'hidden'}>
          {shift.details && (
            <p className="text-sm text-text/60 bg-primary-light/50 rounded-md px-3 py-2 mb-3 italic">
              &ldquo;{shift.details}&rdquo;
            </p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-text/50 mb-3 min-w-0">
            <LayoutGrid className={cn('w-3.5 h-3.5 shrink-0 opacity-70', typeColor)} />
            {shift.board_id
              ? <Link href={`/boards/${slugify(shift.board_name)}`} className="truncate hover:text-primary hover:underline transition-colors">{shift.board_name}</Link>
              : <span className="truncate">{shift.board_name}</span>
            }
          </div>
        </div>

        {/* Trade Loop: claim button (non-owners) / pending-claims panel (owner) */}
        {shift.board_id && shift.user_id && currentUserId && (
          <ClaimSection
            shiftId={shift.id}
            isOwner={!!isOwner}
            myClaim={myClaim}
            pendingClaims={pendingClaims}
            onChanged={onClaimChanged}
          />
        )}

        {/* Comments / Interest / Contact | Badges */}
        <CommentSection
          postType="shift"
          postId={shift.id}
          isOwner={!!isOwner}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          commentCount={shift.comment_count ?? 0}
          interestedCount={shift.interested_count ?? 0}
          boardId={shift.board_id ?? undefined}
          ownerUserId={shift.user_id}
          openCommentsTick={openCommentsTick}
          interestTick={interestTick}
          messageTick={messageTick}
          actions={
            <div className="flex items-center gap-1">
              {isBoth ? (
                <Badge variant="give-trade">
                  <span className="sm:hidden">G/T</span>
                  <span className="hidden sm:inline">Give/Trade</span>
                </Badge>
              ) : (
                <>
                  {isGiveOnly && (
                    <Badge variant="giveaway">
                      <span className="sm:hidden">G</span>
                      <span className="hidden sm:inline">Giveaway</span>
                    </Badge>
                  )}
                  {isTradeOnly && (
                    <Badge variant="trade">
                      <span className="sm:hidden">T</span>
                      <span className="hidden sm:inline">Trade</span>
                    </Badge>
                  )}
                </>
              )}
              {shift.is_overtime_approved && <Badge variant="ot">OT</Badge>}
            </div>
          }
        />
      </div>

      {/* ⋮ menu — portalled to body so CSS transform ancestors don't trap it */}
      {mounted && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuPos(null)} />
          <div
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
            className="w-48 rounded-lg border border-border bg-card shadow-xl z-50 py-1 overflow-hidden"
          >
            <button className={menuItemCls} onClick={() => { setOpenCommentsTick(t => t + 1); setMenuPos(null) }}>
              <MessageSquare className="w-3.5 h-3.5 shrink-0" /> Comment
            </button>
            {!isOwner && (
              <>
                <button
                  className={shift.user_id ? menuItemCls : menuDisabledCls}
                  disabled={!shift.user_id}
                  onClick={() => { setMessageTick(t => t + 1); setMenuPos(null) }}
                >
                  <Send className="w-3.5 h-3.5 shrink-0" /> Message
                </button>
                <button className={menuItemCls} onClick={() => { setInterestTick(t => t + 1); setMenuPos(null) }}>
                  <Star className="w-3.5 h-3.5 shrink-0" /> Show Interest
                </button>
                <button className={menuItemCls} onClick={() => { setFlagOpen(true); setMenuPos(null) }}>
                  <Flag className="w-3.5 h-3.5 shrink-0" /> Flag
                </button>
              </>
            )}
            {isOwner && (
              <>
                <div className="my-1 border-t border-border" />
                <button className={menuItemCls} onClick={() => { router.push(`/wall/edit-shift/${shift.id}`); setMenuPos(null) }}>
                  <Pencil className="w-3.5 h-3.5 shrink-0" /> Edit
                </button>
                <button className={menuDangerCls} onClick={() => { setConfirmRemove(true); setMenuPos(null) }}>
                  <Trash2 className="w-3.5 h-3.5 shrink-0" /> Remove
                </button>
              </>
            )}
          </div>
        </>,
        document.body
      )}

      <FlagModal
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        targetType="post"
        targetId={shift.id}
        boardId={shift.board_id ?? undefined}
      />

      <ConfirmDialog
        open={confirmRemove}
        title="Remove Post"
        message="Are you sure you want to remove this shift? This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => { onDeactivate?.(shift.id); setConfirmRemove(false) }}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  )
}
