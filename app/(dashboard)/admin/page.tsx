import { requireAdmin } from '@/lib/auth/session'
import { AdminClient } from './AdminClient'
import type { PostStats } from './AdminCharts'
import type { GlobalRole } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Overlord' }

export default async function AdminPage() {
  const { supabase, user } = await requireAdmin()

  const [boardsRes, usersRes, memberRowsRes, postStatsRes] = await Promise.all([
    supabase
      .from('boards')
      .select('id, name, slug, invite_code_enabled, is_active, created_at')
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

  const boards = (boardsRes.data ?? []).map(b => ({ ...b, member_count: memberCounts.get(b.id) ?? 0 }))
  const users = (usersRes.data ?? []).map((u: { id: string }) => ({
    ...u,
    board_count: userBoardCounts.get(u.id) ?? 0,
  }))

  return (
    <AdminClient
      boards={boards as { id: string; name: string; slug: string; invite_code_enabled: boolean; is_active: boolean; created_at: string; member_count: number }[]}
      users={users as unknown as { id: string; display_name: string | null; role: GlobalRole; is_active: boolean; created_at: string; board_count: number }[]}
      adminId={user.id}
      postStats={postStatsRes.data as PostStats | null}
    />
  )
}
