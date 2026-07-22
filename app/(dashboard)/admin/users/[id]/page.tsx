import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { UserEditClient } from './UserEditClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Edit User – WDWShiftX' }

interface PageProps {
  params: { id: string }
}

export default async function AdminUserEditPage({ params }: PageProps) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminProfile } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (!adminProfile || adminProfile.role !== 'Admin') redirect('/wall')

  const { data: editUser } = await supabase
    .from('users')
    .select('id, display_name, email, role, is_active, created_at')
    .eq('id', params.id)
    .single()

  if (!editUser) notFound()

  return (
    <UserEditClient
      user={{
        id: editUser.id,
        display_name: editUser.display_name,
        email: editUser.email,
        role: editUser.role,
        is_active: editUser.is_active,
        created_at: editUser.created_at,
      }}
      adminId={user.id}
    />
  )
}
