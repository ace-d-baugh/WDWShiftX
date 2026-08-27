import { requireUser } from '@/lib/auth/session'
import { NotificationsClient, type NotificationCard } from './NotificationsClient'
import type { NotificationType } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications' }

interface RawRow {
  id: string
  read_at: string | null
  board_id: string | null
  board: { name: string } | null
  notifications: {
    id: string
    type: NotificationType
    title: string
    body: string
    link_url: string
    actor_user_id: string | null
    pinned_until: string | null
    created_at: string
    updated_at: string
    actor: { display_name: string | null; avatar_url: string | null } | null
  } | null
}

export default async function NotificationsPage() {
  const { supabase, user } = await requireUser()

  // Best-effort sweep of anything past its 14-day post-read expiry. Never
  // blocks the page — if pg_cron is enabled this is mostly a no-op.
  supabase.rpc('purge_expired_notifications').then(({ error }) => {
    if (error) console.error('[NotificationsPage] purge failed:', error.message)
  })

  const [{ data: profile }, { data: isModRpc }, { data: rows }, { count: myBoardCount }] = await Promise.all([
    supabase.from('users').select('role').eq('id', user.id).single(),
    supabase.rpc('is_any_board_moderator'),
    supabase
      .from('notification_recipients')
      .select(`
        id, read_at, board_id,
        board:boards ( name ),
        notifications (
          id, type, title, body, link_url, actor_user_id, pinned_until, created_at, updated_at,
          actor:users!actor_user_id ( display_name, avatar_url )
        )
      `)
      .eq('user_id', user.id)
      .is('dismissed_at', null)
      .returns<RawRow[]>(),
    supabase.from('user_boards').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_approved', true),
  ])

  const isAdmin = profile?.role === 'Admin'
  const isBoardModerator = Boolean(isModRpc)
  const canSend = isAdmin || isBoardModerator

  const notifications: NotificationCard[] = (rows ?? [])
    .filter((r): r is RawRow & { notifications: NonNullable<RawRow['notifications']> } => r.notifications !== null)
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

  let sendableBoards: { id: string; name: string }[] = []
  if (canSend) {
    if (isAdmin) {
      const { data } = await supabase.from('boards').select('id, name').eq('status', 'active').order('name')
      sendableBoards = data ?? []
    } else {
      const { data } = await supabase
        .from('user_boards')
        .select('board_id, boards(id, name, status)')
        .eq('user_id', user.id)
        .eq('is_approved', true)
        .in('role', ['Mod', 'Leader'])
      sendableBoards = (data ?? [])
        .map(r => (r.boards as unknown) as { id: string; name: string; status: string } | null)
        .filter((b): b is { id: string; name: string; status: string } => !!b && b.status === 'active')
        .map(b => ({ id: b.id, name: b.name }))
    }
  }

  return (
    <NotificationsClient
      currentUserId={user.id}
      isAdmin={isAdmin}
      canSend={canSend}
      showBoardLabels={(myBoardCount ?? 0) > 1}
      sendableBoards={sendableBoards}
      initialNotifications={notifications}
    />
  )
}
