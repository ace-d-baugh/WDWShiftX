import { requireAdmin } from '@/lib/auth/session'
import { AdminClient, type Board, type UserRow } from './AdminClient'
import type { PostStats } from './AdminCharts'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Overlord' }

export default async function AdminPage() {
  const { supabase, user } = await requireAdmin()

  const [boardsRes, usersRes, memberRowsRes, postStatsRes] = await Promise.all([
    supabase
      .from('boards')
      .select('id, name, slug, invite_code_enabled, is_active, status, created_at')
      .order('name')
      .limit(200),
    // This RPC is internally gated to Admins only and returns every user.
    supabase.rpc('get_users_admin').limit(200),
    // Non-hidden memberships (approved AND pending), tallied two ways below:
    // per board (approved only, for the Boards tab's member-count pill) and
    // per user (approved + pending, for the Users tab's Boards-N pill — a
    // pending row still means "not fallen through the cracks", just awaiting
    // a mod's approval, so it must count to avoid a false 0).
    supabase
      .from('user_boards')
      .select('board_id, user_id, is_approved')
      .eq('is_hidden', false)
      .limit(2000),
    // Also internally gated to Admins only — see get_post_stats_admin().
    // All-boards view for the fast first paint; AdminCharts refetches
    // client-side when the board filter changes.
    supabase.rpc('get_post_stats_admin', { p_board_id: null }).single(),
  ])

  const memberCounts = new Map<string, number>()
  const userBoardCounts = new Map<string, number>()
  for (const row of memberRowsRes.data ?? []) {
    userBoardCounts.set(row.user_id, (userBoardCounts.get(row.user_id) ?? 0) + 1)
    if (row.is_approved) {
      memberCounts.set(row.board_id, (memberCounts.get(row.board_id) ?? 0) + 1)
    }
  }

  // invite_code is column-locked (S8) — `authenticated` has no SELECT on it, so
  // it comes from the membership-gated RPC the /boards page uses, which admits
  // approved members and Admins. Feeds the Boards tab's Invite modal.
  const boardRows = boardsRes.data ?? []
  const inviteCodes = new Map<string, string>()
  if (boardRows.length > 0) {
    const { data: codes } = await supabase.rpc('get_board_invite_codes', {
      p_board_ids: boardRows.map(b => b.id),
    })
    for (const row of codes ?? []) inviteCodes.set(row.board_id, row.invite_code)
  }

  const boards = boardRows.map(b => ({
    ...b,
    member_count: memberCounts.get(b.id) ?? 0,
    invite_code: inviteCodes.get(b.id) ?? '',
  }))
  const users = (usersRes.data ?? []).map((u: { id: string }) => ({
    ...u,
    board_count: userBoardCounts.get(u.id) ?? 0,
  }))

  return (
    <AdminClient
      boards={boards as Board[]}
      users={users as unknown as UserRow[]}
      adminId={user.id}
      postStats={postStatsRes.data as PostStats | null}
    />
  )
}
