import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ApprovalsClient } from './ApprovalsClient'
import type { UserRole } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Approvals – WDWShiftX' }

type ProfileRow = { role: UserRole } | null

export default async function ApprovalsPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('role').eq('id', session.user.id).single() as unknown as { data: ProfileRow }

  if (!userProfile || !['leader', 'admin'].includes(userProfile.role)) {
    redirect('/board')
  }

  const { data: pendingLocations } = await supabase
    .from('locations')
    .select('id, name, property_id, created_at, properties(name), users!suggested_by_user_id(display_name)')
    .eq('is_approved', false)
    .order('created_at', { ascending: true })

  const { data: pendingRoles } = await supabase
    .from('roles')
    .select('id, name, created_at, users!suggested_by_user_id(display_name)')
    .eq('is_approved', false)
    .order('created_at', { ascending: true })

  return (
    <ApprovalsClient
      pendingLocations={(pendingLocations ?? []) as { id: string; name: string; property_id: string; created_at: string; properties: { name: string } | null; users: { display_name: string } | null }[]}
      pendingRoles={(pendingRoles ?? []) as { id: string; name: string; created_at: string; users: { display_name: string } | null }[]}
      approverId={session.user.id}
    />
  )
}
