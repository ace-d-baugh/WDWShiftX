import { requireAdmin } from '@/lib/auth/session'
import { AdminClient } from './AdminClient'
import type { GlobalRole } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Overlord' }

export default async function AdminPage() {
  const { supabase, user } = await requireAdmin()

  const [boardsRes, usersRes] = await Promise.all([
    supabase
      .from('boards')
      .select('id, name, invite_code_enabled, is_active, created_at')
      .order('name')
      .limit(200),
    // This RPC is internally gated to Admins only and returns every user.
    supabase.rpc('get_users_admin').limit(200),
  ])

  return (
    <AdminClient
      boards={(boardsRes.data ?? []) as { id: string; name: string; invite_code_enabled: boolean; is_active: boolean; created_at: string }[]}
      users={(usersRes.data ?? []) as unknown as { id: string; display_name: string | null; role: GlobalRole; is_active: boolean; created_at: string }[]}
      adminId={user.id}
    />
  )
}
