'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LayoutGrid, User, Flag, Pencil, Trash2, CheckCircle,
  MoreVertical, MessageSquare, Send, Clock, ChevronDown,
  HeartHandshake as Handshake,
} from 'lucide-react'
import { FlagModal } from '@/components/features/FlagModal'
import { slugify } from '@/lib/slug'
import { CommentSection } from '@/components/features/CommentSection'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { fulfillRequest } from '@/app/actions/posts'
import { cn } from '@/lib/utils'
import type { PreferredTime } from '@/lib/database.types'

const timeLabels: Record<PreferredTime, string> = {
  morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', late: 'Late Night',
}
const timeLabelsShort: Record<PreferredTime, string> = {
  morning: 'AM', afternoon: 'PM', evening: 'Eve', late: 'Late',
}
const timeBadgeVariant: Record<PreferredTime, string> = {
  morning: 'bg-accent/20 text-text',
  afternoon: 'bg-info/20 text-info',
  evening: 'bg-primary/20 text-primary',
  late: 'bg-text/10 text-text',
}

export interface RequestData {
  id: string
  created_by: string
  user_id: string | null
  board_id: string | null
  board_name: string
  request_title: string
  preferred_times: PreferredTime[]
  requested_date: string
  details: string | null
  is_active: boolean
  expires_at: string
  created_at: string
  comment_count?: number
  interested_count?: number
  contactReady?: boolean
}

interface RequestCardProps {
  request: RequestData
  currentUserId?: string
  onDeactivate?: (id: string) => void
  /** Called after this card marks itself fulfilled (the server write already
   *  happened here) so the parent can prune it from the list. */
  onFulfilled?: (id: string) => void
}

export function RequestCard({ request, currentUserId, onDeactivate, onFulfilled }: RequestCardProps) {
  const router = useRouter()
  const [flagOpen, setFlagOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmFulfill, setConfirmFulfill] = useState(false)
  const [fulfilling, setFulfilling] = useState(false)
  const [fulfillError, setFulfillError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [openCommentsTick, setOpenCommentsTick] = useState(0)
  const [interestTick, setInterestTick] = useState(0)
  const [messageTick, setMessageTick] = useState(0)

  const isOwner = currentUserId && request.user_id === currentUserId

  const TIME_ORDER: PreferredTime[] = ['morning', 'afternoon', 'evening', 'late']
  const sortedTimes = [...request.preferred_times].sort(
    (a, b) => TIME_ORDER.indexOf(a) - TIME_ORDER.indexOf(b)
  )

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const W = 192 // w-48
    const left = Math.max(8, Math.min(rect.right - W, window.innerWidth - W - 8))
    setMenuPos({ top: rect.bottom + 4, left })
  }

  const handleFulfill = async () => {
    setFulfilling(true)
    setFulfillError(null)
    const res = await fulfillRequest(request.id)
    setFulfilling(false)
    if (res.error) { setFulfillError(res.error); return }
    setConfirmFulfill(false)
    onFulfilled?.(request.id)
  }

  const menuItemCls = 'flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors text-text/80 hover:bg-primary-light/50 hover:text-text'
  const menuDangerCls = 'flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors text-warning hover:bg-warning/10'
  const menuDisabledCls = 'flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-text/25 cursor-not-allowed'

  return (
    <>
      <div className={cn('card border-l-4 border-l-accent transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5', isOwner && 'bg-primary-light/30')}>

        {/* Row 1: Title (full-width on mobile) | Poster name + ⋮ on sm+ */}
        <div className="mb-1">
          <div className="flex items-start gap-2">
            <h3 className="font-accent font-bold text-accent text-lg leading-snug flex-1 min-w-0 break-words hyphens-auto">
              {request.request_title}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              <span className="hidden sm:flex text-xs text-text/50 items-center gap-1.5 whitespace-nowrap">
                <User className="w-3 h-3 shrink-0 text-accent" />
                {request.created_by}
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
            <User className="w-3 h-3 shrink-0 text-accent" />
            {request.created_by}
            {isOwner && (
              <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full leading-none">you</span>
            )}
          </div>
        </div>

        {/* Row 2: Preferred times + chevron toggle */}
        <div className="flex items-center gap-1.5 mb-3">
          <Clock className="w-3.5 h-3.5 text-accent shrink-0" />
          <div className="flex flex-wrap gap-1.5">
            {sortedTimes.map(t => (
              <span key={t} className={cn('badge text-sm', timeBadgeVariant[t])}>
                <span className="sm:hidden">{timeLabelsShort[t]}</span>
                <span className="hidden sm:inline">{timeLabels[t]}</span>
              </span>
            ))}
          </div>
          <button
            onClick={() => setDetailsOpen(o => !o)}
            className="ml-auto p-0.5 text-text/40 hover:text-accent min-h-0 min-w-0"
            aria-label="Toggle details"
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', detailsOpen && 'rotate-180')} />
          </button>
        </div>

        {/* Collapsible: notes + board */}
        <div className={detailsOpen ? 'block' : 'hidden'}>
          {request.details && (
            <p className="text-sm text-text/60 bg-accent/10 rounded-md px-3 py-2 mb-3 italic">
              &ldquo;{request.details}&rdquo;
            </p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-text/50 mb-3 min-w-0">
            <LayoutGrid className="w-3.5 h-3.5 text-accent/70 shrink-0" />
            {request.board_id
              ? <Link href={`/boards/${slugify(request.board_name)}`} className="truncate hover:text-primary hover:underline transition-colors">{request.board_name}</Link>
              : <span className="truncate">{request.board_name}</span>
            }
          </div>
        </div>

        {/* Comments / Interest / Contact | Request badge */}
        <CommentSection
          postType="request"
          postId={request.id}
          isOwner={!!isOwner}
          currentUserId={currentUserId}
          commentCount={request.comment_count ?? 0}
          interestedCount={request.interested_count ?? 0}
          boardId={request.board_id ?? undefined}
          ownerUserId={request.user_id}
          openCommentsTick={openCommentsTick}
          interestTick={interestTick}
          messageTick={messageTick}
          actions={
            <span className="badge bg-accent/20 text-text shrink-0 font-medium">
              <span className="sm:hidden font-bold">R</span>
              <span className="hidden sm:inline">Request</span>
            </span>
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
                  className={request.user_id ? menuItemCls : menuDisabledCls}
                  disabled={!request.user_id}
                  onClick={() => { setMessageTick(t => t + 1); setMenuPos(null) }}
                >
                  <Send className="w-3.5 h-3.5 shrink-0" /> Message
                </button>
                <button className={menuItemCls} onClick={() => { setInterestTick(t => t + 1); setMenuPos(null) }}>
                  <Handshake className="w-3.5 h-3.5 shrink-0" /> I Can Help
                </button>
                <button className={menuItemCls} onClick={() => { setFlagOpen(true); setMenuPos(null) }}>
                  <Flag className="w-3.5 h-3.5 shrink-0" /> Flag
                </button>
              </>
            )}
            {isOwner && (
              <>
                <div className="my-1 border-t border-border" />
                <button className={menuItemCls} onClick={() => { router.push(`/wall/edit-request/${request.id}`); setMenuPos(null) }}>
                  <Pencil className="w-3.5 h-3.5 shrink-0" /> Edit
                </button>
                <button className={menuItemCls} onClick={() => { setConfirmFulfill(true); setMenuPos(null) }}>
                  <CheckCircle className="w-3.5 h-3.5 shrink-0 text-success" /> Mark Fulfilled
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
        targetId={request.id}
        boardId={request.board_id ?? undefined}
      />

      <ConfirmDialog
        open={confirmRemove}
        title="Remove Post"
        message="Are you sure you want to remove this request? This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => { onDeactivate?.(request.id); setConfirmRemove(false) }}
        onCancel={() => setConfirmRemove(false)}
      />

      <ConfirmDialog
        open={confirmFulfill}
        title="Mark as Fulfilled"
        message={`Mark this request as fulfilled? It comes off the Wall as covered — use this once someone's actually taken care of it.${fulfillError ? ` ${fulfillError}` : ''}`}
        confirmLabel="Mark Fulfilled"
        loadingLabel="Saving…"
        loading={fulfilling}
        onConfirm={handleFulfill}
        onCancel={() => { setConfirmFulfill(false); setFulfillError(null) }}
      />
    </>
  )
}
