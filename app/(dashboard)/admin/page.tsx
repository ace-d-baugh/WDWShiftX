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
    // Real (approved, non-hidden) memberships, tallied per board below for
    // the Boards tab's member-count pill.
    supabase
      .from('user_boards')
      .select('board_id')
      .eq('is_approved', true)
      .eq('is_hidden', false)
      .limit(2000),
    // Also internally gated to Admins only — see get_post_stats_admin().
    supabase.rpc('get_post_stats_admin').single(),
  ])

  const memberCounts = new Map<string, number>()
  for (const row of memberRowsRes.data ?? []) {
    memberCounts.set(row.board_id, (memberCounts.get(row.board_id) ?? 0) + 1)
  }

  const boards = (boardsRes.data ?? []).map(b => ({ ...b, member_count: memberCounts.get(b.id) ?? 0 }))

  return (
    <AdminClient
      boards={boards as { id: string; name: string; slug: string; invite_code_enabled: boolean; is_active: boolean; created_at: string; member_count: number }[]}
      users={(usersRes.data ?? []) as unknown as { id: string; display_name: string | null; role: GlobalRole; is_active: boolean; created_at: string }[]}
      adminId={user.id}
      postStats={postStatsRes.data as PostStats | null}
    />
  )
}
