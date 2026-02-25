import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AdminClient } from './AdminClient'
import type { UserRole } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Admin – WDWShiftX' }

type ProfileRow = { role: UserRole } | null

export default async function AdminPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('role').eq('id', session.user.id).single() as unknown as { data: ProfileRow }

  if (!userProfile || userProfile.role !== 'admin') {
    redirect('/board')
  }

  const [propertiesRes, locationsRes, rolesRes, usersRes] = await Promise.all([
    supabase.from('properties').select('id, name, created_at').order('name'),
    supabase.from('locations').select('id, name, property_id, is_approved, created_at, properties(name)').order('name'),
    supabase.from('roles').select('id, name, is_approved, created_at').order('name'),
    supabase.from('users').select('id, display_name, email, role, is_active, created_at').order('created_at', { ascending: false }).limit(100),
  ])

  return (
    <AdminClient
      properties={(propertiesRes.data ?? []) as { id: string; name: string; created_at: string }[]}
      locations={(locationsRes.data ?? []) as { id: string; name: string; property_id: string; is_approved: boolean; created_at: string; properties: { name: string } | null }[]}
      roles={(rolesRes.data ?? []) as { id: string; name: string; is_approved: boolean; created_at: string }[]}
      users={(usersRes.data ?? []) as { id: string; display_name: string; email: string; role: UserRole; is_active: boolean; created_at: string }[]}
      adminId={session.user.id}
    />
  )
}
