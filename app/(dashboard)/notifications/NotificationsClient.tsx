'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, parseISO } from 'date-fns'
import {
  Bell, BellOff, BellRing, MoreVertical, Send, Trash2, Pencil, X, Pin, Plus,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { createClient } from '@/lib/supabase/client'
import { startConversation } from '@/app/actions/messages'
import { markNotificationRead, deleteNotification, dismissBoardNotification } from '@/app/actions/notificationInbox'
import { sendBoardNotification, editBoardNotification, deleteBoardNotification } from '@/app/actions/boardNotifications'
import type { NotificationType } from '@/lib/database.types'
import { cn } from '@/lib/utils'

export interface NotificationCard {
  recipientId: string
  notificationId: string
  type: NotificationType
  title: string
  body: string
  linkUrl: string
  actorUserId: string | null
  actorName: string | null
  actorAvatarUrl: string | null
  boardId: string | null
  boardName: string | null
  pinnedUntil: string | null
  createdAt: string
  updatedAt: string
  readAt: string | null
}

interface BoardOption {
  id: string
  name: string
}

interface NotificationsClientProps {
  currentUserId: string
  isAdmin: boolean
  canSend: boolean
  showBoardLabels: boolean
  sendableBoards: BoardOption[]
  initialNotifications: NotificationCard[]
}

const menuItemCls = 'flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors text-text/80 hover:bg-primary-light/50 hover:text-text'
const menuDangerCls = 'flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors text-warning hover:bg-warning/10'

type ConfirmKind = 'delete-personal' | 'dismiss' | 'delete-board'

export function NotificationsClient({
  currentUserId, isAdmin, canSend, showBoardLabels, sendableBoards, initialNotifications,
}: NotificationsClientProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [notifications, setNotifications] = useState(initialNotifications)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // ── 3-dot menu ────────────────────────────────────────────────────────────
  const [menuForId, setMenuForId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const closeMenu = () => { setMenuForId(null); setMenuPos(null) }
  const openMenu = (recipientId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const W = 208
    const left = Math.max(8, Math.min(rect.right - W, window.innerWidth - W - 8))
    setMenuForId(recipientId)
    setMenuPos({ top: rect.bottom + 4, left })
  }
  useEffect(() => {
    if (!menuPos) return
    const close = () => setMenuPos(null)
    document.addEventListener('scroll', close, { passive: true, capture: true })
    return () => document.removeEventListener('scroll', close, { capture: true })
  }, [menuPos])

  // ── Confirm dialogs (delete / dismiss) ──────────────────────────────────────
  const [confirming, setConfirming] = useState<{ kind: ConfirmKind; card: NotificationCard } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // ── Send / Edit form ─────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<NotificationCard | null>(null)
  const [formBoardIds, setFormBoardIds] = useState<string[]>([])
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [messaging, setMessaging] = useState(false)

  const refreshList = useCallback(async () => {
    const { data, error } = await supabase
      .from('notification_recipients')
      .select(`
        id, read_at, board_id,
        board:boards ( name ),
        notifications (
          id, type, title, body, link_url, actor_user_id, pinned_until, created_at, updated_at,
          actor:users!actor_user_id ( display_name, avatar_url )
        )
      `)
      .eq('user_id', currentUserId)
      .is('dismissed_at', null)
    if (error || !data) return

    type Row = {
      id: string; read_at: string | null; board_id: string | null
      board: { name: string } | null
      notifications: {
        id: string; type: NotificationType; title: string; body: string; link_url: string
        actor_user_id: string | null; pinned_until: string | null; created_at: string; updated_at: string
        actor: { display_name: string | null; avatar_url: string | null } | null
      } | null
    }
    const mapped: NotificationCard[] = (data as unknown as Row[])
      .filter((r): r is Row & { notifications: NonNullable<Row['notifications']> } => r.notifications !== null)
      .map(r => ({
        recipientId: r.id,
        notificationId: r.notifications.id,
        type: r.notifications.type,
        title: r.notifications.title,
        body: r.notifications.body,
        linkUrl: r.notifications.link_url,
        actorUserId: r.notifications.actor_user_id,
        actorName: r.notifications.actor?.display_name ?? null,
        actorAvatarUrl: r.notifications.actor?.avatar_url ?? null,
        boardId: r.board_id,
        boardName: r.board?.name ?? null,
        pinnedUntil: r.notifications.pinned_until,
        createdAt: r.notifications.created_at,
        updatedAt: r.notifications.updated_at,
        readAt: r.read_at,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    setNotifications(mapped)
  }, [supabase, currentUserId])

  // Re-fetch on mount (stale router cache) + live updates for this user.
  useEffect(() => { refreshList() }, [refreshList])
  useEffect(() => {
    const channel = supabase
      .channel('realtime:notification_recipients:list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_recipients' }, () => refreshList())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, refreshList])

  const now = Date.now()
  const pinned = notifications
    .filter(n => n.type === 'board_announcement' && n.pinnedUntil && new Date(n.pinnedUntil).getTime() > now)
  const regular = notifications
    .filter(n => !(n.type === 'board_announcement' && n.pinnedUntil && new Date(n.pinnedUntil).getTime() > now))

  // Marks read via a direct Supabase call rather than the markNotificationRead
  // server action: the click also navigates (this is a Link), and a server
  // action's POST goes to the *current* route — racing that against the
  // Link's own transition to linkUrl let Next's router see the action's
  // response land after the route had already changed and abort the
  // navigation, so the click appeared to do nothing but flip read state.
  const handleCardClick = (card: NotificationCard) => {
    if (card.readAt) return
    setNotifications(prev => prev.map(n =>
      n.recipientId === card.recipientId ? { ...n, readAt: new Date().toISOString() } : n
    ))
    supabase
      .from('notification_recipients')
      .update({ read_at: new Date().toISOString() })
      .eq('id', card.recipientId)
      .eq('user_id', currentUserId)
      .then(({ error }) => {
        if (error) console.error('[handleCardClick] mark read failed:', error.message)
      })
  }

  const handleToggleRead = async (card: NotificationCard) => {
    closeMenu()
    const nextRead = !card.readAt
    setNotifications(prev => prev.map(n =>
      n.recipientId === card.recipientId ? { ...n, readAt: nextRead ? new Date().toISOString() : null } : n
    ))
    const res = await markNotificationRead(card.notificationId, nextRead)
    if (res.error) refreshList()
  }

  const handleMessage = async (otherUserId: string) => {
    closeMenu()
    if (messaging) return
    setMessaging(true)
    const res = await startConversation(otherUserId)
    setMessaging(false)
    if (res.conversationId) router.push(`/messages/${res.conversationId}`)
    else setActionError(res.error ?? 'Could not start the conversation.')
  }

  const runConfirm = async () => {
    if (!confirming) return
    setConfirmLoading(true)
    setActionError(null)
    const { kind, card } = confirming
    const res = kind === 'delete-personal'
      ? await deleteNotification(card.notificationId)
      : kind === 'dismiss'
        ? await dismissBoardNotification(card.notificationId)
        : await deleteBoardNotification(card.notificationId)
    setConfirmLoading(false)
    setConfirming(null)
    if (res.error) { setActionError(res.error); return }
    // Hard-deleting a board announcement removes every card it produced for
    // this user (they may have one per targeted board); the others are
    // per-recipient and only ever remove the single card.
    if (kind === 'delete-board') {
      setNotifications(prev => prev.filter(n => n.notificationId !== card.notificationId))
    } else {
      setNotifications(prev => prev.filter(n => n.recipientId !== card.recipientId))
    }
  }

  const openSendForm = () => {
    setEditingCard(null)
    setFormBoardIds(sendableBoards.length === 1 ? [sendableBoards[0].id] : [])
    setFormTitle('')
    setFormBody('')
    setFormError(null)
    setFormOpen(true)
  }
  const openEditForm = (card: NotificationCard) => {
    closeMenu()
    setEditingCard(card)
    setFormTitle(card.title)
    setFormBody(card.body)
    setFormError(null)
    setFormOpen(true)
  }
  const toggleFormBoard = (boardId: string) => {
    setFormBoardIds(prev => prev.includes(boardId) ? prev.filter(id => id !== boardId) : [...prev, boardId])
  }
  const submitForm = async () => {
    if (!formTitle.trim() || !formBody.trim()) { setFormError('Title and details are required.'); return }
    setFormSubmitting(true)
    setFormError(null)
    const res = editingCard
      ? await editBoardNotification(editingCard.notificationId, { title: formTitle, body: formBody })
      : await sendBoardNotification({ boardIds: formBoardIds, title: formTitle, body: formBody })
    setFormSubmitting(false)
    if (res.error) { setFormError(res.error); return }
    setFormOpen(false)
    refreshList()
  }

  const canManage = (card: NotificationCard) => isAdmin || card.actorUserId === currentUserId

  const confirmCopy: Record<ConfirmKind, { title: string; message: string; confirmLabel: string }> = {
    'delete-personal': {
      title: 'Delete Notification',
      message: 'This removes it from your Notifications permanently.',
      confirmLabel: 'Delete',
    },
    dismiss: {
      title: 'Dismiss Notification',
      message: 'This removes it from your Notifications only — other board members still see it.',
      confirmLabel: 'Dismiss',
    },
    'delete-board': {
      title: 'Delete Announcement',
      message: 'This removes it for every member it was sent to. This can\'t be undone.',
      confirmLabel: 'Delete',
    },
  }

  const renderCard = (card: NotificationCard) => {
    const unread = !card.readAt
    const isBoard = card.type === 'board_announcement'
    const mayManage = isBoard && canManage(card)
    const showMessage = !!card.actorUserId && card.actorUserId !== currentUserId

    return (
      <li key={card.recipientId} className="relative">
        <Link
          href={card.linkUrl}
          onClick={() => handleCardClick(card)}
          className={cn(
            'flex items-start gap-3 pl-4 pr-12 py-3.5 transition-colors',
            isBoard ? 'bg-secondary-accent/20 hover:bg-secondary-accent/30' : 'hover:bg-primary-light/40'
          )}
        >
          {isBoard ? (
            <span className="mt-0.5 flex items-center justify-center w-9 h-9 rounded-full bg-secondary-accent/50 text-text shrink-0">
              <Pin className="w-4 h-4" />
            </span>
          ) : (
            <Avatar avatarUrl={card.actorAvatarUrl} displayName={card.actorName} size={36} clickable={false} />
          )}
          <span className="flex-1 min-w-0">
            <span className="flex items-center justify-between gap-2">
              <span className={cn('text-sm truncate', unread ? 'font-bold text-text' : 'font-medium text-text/90')}>
                {card.title}
              </span>
              <span className="text-[11px] text-text/40 shrink-0">
                {formatDistanceToNow(parseISO(card.updatedAt), { addSuffix: true })}
              </span>
            </span>
            <span className={cn('block text-xs mt-0.5', unread ? 'text-text/80 font-medium' : 'text-text/50')}>
              {card.body}
            </span>
            {showBoardLabels && card.boardName && (
              <span className="inline-flex items-center mt-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-secondary-accent/50 text-text">
                {card.boardName}
              </span>
            )}
          </span>
          {unread && <span className="mt-1.5 w-2 h-2 rounded-full bg-warning shrink-0" />}
        </Link>

        <button
          type="button"
          onClick={e => openMenu(card.recipientId, e)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-text/40 hover:text-text hover:bg-primary-light/50 transition-colors min-h-0 min-w-0"
          aria-label="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {mounted && menuForId === card.recipientId && menuPos && createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={closeMenu} />
            <div
              style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
              className="w-52 rounded-lg border border-border bg-card shadow-xl z-50 py-1 overflow-hidden"
            >
              <button className={menuItemCls} onClick={() => handleToggleRead(card)}>
                {unread ? <BellRing className="w-3.5 h-3.5 shrink-0" /> : <BellOff className="w-3.5 h-3.5 shrink-0" />}
                {unread ? 'Mark as read' : 'Mark as unread'}
              </button>
              {showMessage && (
                <button className={menuItemCls} disabled={messaging} onClick={() => handleMessage(card.actorUserId!)}>
                  <Send className="w-3.5 h-3.5 shrink-0" /> Message
                </button>
              )}
              {mayManage && (
                <button className={menuItemCls} onClick={() => openEditForm(card)}>
                  <Pencil className="w-3.5 h-3.5 shrink-0" /> Edit
                </button>
              )}
              {isBoard ? (
                mayManage ? (
                  <button className={menuDangerCls} onClick={() => { closeMenu(); setConfirming({ kind: 'delete-board', card }) }}>
                    <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete
                  </button>
                ) : (
                  <button className={menuItemCls} onClick={() => { closeMenu(); setConfirming({ kind: 'dismiss', card }) }}>
                    <X className="w-3.5 h-3.5 shrink-0" /> Dismiss
                  </button>
                )
              ) : (
                <button className={menuDangerCls} onClick={() => { closeMenu(); setConfirming({ kind: 'delete-personal', card }) }}>
                  <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete
                </button>
              )}
            </div>
          </>,
          document.body
        )}
      </li>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-accent text-2xl font-bold text-text">Notifications</h1>
        {canSend && (
          <Button size="sm" onClick={openSendForm}>
            <Plus className="w-4 h-4" /> Send Notification
          </Button>
        )}
      </div>

      {actionError && <p className="text-xs text-warning mb-2">{actionError}</p>}

      {notifications.length === 0 ? (
        <div className="card text-center py-10">
          <Bell className="w-8 h-8 mx-auto text-text/20 mb-3" />
          <p className="text-sm font-medium text-text/70">No notifications yet</p>
          <p className="text-xs text-text/50 mt-1 max-w-sm mx-auto">
            You&apos;ll see shift matches, interest, comments, and trade updates here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pinned.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text/50 mb-1.5 px-1">
                <Pin className="w-3.5 h-3.5" /> Pinned
              </p>
              <ul className="card divide-y divide-border p-0 overflow-hidden">
                {pinned.map(renderCard)}
              </ul>
            </div>
          )}
          {regular.length > 0 && (
            <ul className="card divide-y divide-border p-0 overflow-hidden">
              {regular.map(renderCard)}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={confirming ? confirmCopy[confirming.kind].title : ''}
        message={confirming ? confirmCopy[confirming.kind].message : ''}
        confirmLabel={confirming ? confirmCopy[confirming.kind].confirmLabel : 'Confirm'}
        loadingLabel="Working…"
        onConfirm={runConfirm}
        onCancel={() => setConfirming(null)}
        loading={confirmLoading}
      />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingCard ? 'Edit Announcement' : 'Send Notification'} size="sm">
        <div className="space-y-3">
          {!editingCard && sendableBoards.length > 1 && (
            <div>
              <p className="text-xs font-medium text-text/60 mb-1.5">Boards</p>
              <div className="space-y-1 max-h-36 overflow-y-auto border border-border rounded-lg p-2">
                {sendableBoards.map(b => (
                  <label key={b.id} className="flex items-center gap-2 text-sm text-text/80 py-0.5">
                    <input
                      type="checkbox"
                      checked={formBoardIds.includes(b.id)}
                      onChange={() => toggleFormBoard(b.id)}
                      className="rounded border-border"
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-text/60 mb-1.5">Title</p>
            <input
              type="text"
              className="input text-sm"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              maxLength={150}
              autoFocus
            />
          </div>
          <div>
            <p className="text-xs font-medium text-text/60 mb-1.5">Details</p>
            <textarea
              className="input text-sm min-h-[100px] resize-y"
              value={formBody}
              onChange={e => setFormBody(e.target.value)}
              maxLength={1000}
            />
          </div>
          {formError && <p className="text-xs text-warning">{formError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)} disabled={formSubmitting}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitForm} disabled={formSubmitting}>
              {formSubmitting ? <LoadingSpinner size="sm" /> : editingCard ? 'Save' : 'Send'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
