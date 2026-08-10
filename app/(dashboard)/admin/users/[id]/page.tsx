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

  // Board memberships + the board catalogue for the "User Boards" section.
  const [{ data: allBoards }, { data: memberRows }] = await Promise.all([
    supabase.from('boards').select('id, name, slug').eq('is_active', true).order('name'),
    supabase
      .from('user_boards')
      .select('id, board_id, role, is_approved, is_hidden, boards(name, slug)')
      .eq('user_id', params.id),
  ])

  // Hidden rows are the auto-added Overlord memberships — never shown or managed
  // here. Visible ones drive the list; every membership (hidden included) is
  // excluded from the "add" dropdown so we never hit the unique-membership index.
  const memberships = (memberRows ?? [])
    .filter(m => !m.is_hidden)
    .map(m => ({
      userBoardId: m.id as string,
      boardId: m.board_id as string,
      boardName: (m.boards as unknown as { name: string; slug: string } | null)?.name ?? 'Unknown board',
      boardSlug: (m.boards as unknown as { name: string; slug: string } | null)?.slug ?? '',
      role: m.role as 'User' | 'Mod' | 'Leader',
      isApproved: m.is_approved as boolean,
    }))

  const memberBoardIds = new Set((memberRows ?? []).map(m => m.board_id as string))
  const availableBoards = (allBoards ?? [])
    .filter(b => !memberBoardIds.has(b.id as string))
    .map(b => ({ id: b.id as string, name: b.name as string, slug: b.slug as string }))

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
      memberships={memberships}
      availableBoards={availableBoards}
    />
  )
}
