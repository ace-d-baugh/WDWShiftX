import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { BoardClient } from './BoardClient'
import type { UserRole } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Shift Board – WDWShiftX',
}

type UserProfileRow = { id: string; display_name: string; role: UserRole } | null

export default async function BoardPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users')
    .select('id, display_name, role')
    .eq('id', session.user.id)
    .single() as unknown as { data: UserProfileRow }

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .order('name')

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, property_id')
    .eq('is_approved', true)
    .order('name')

  const { data: roles } = await supabase
    .from('roles')
    .select('id, name')
    .eq('is_approved', true)
    .order('name')

  return (
    <BoardClient
      userId={session.user.id}
      displayName={userProfile?.display_name ?? 'Cast Member'}
      userRole={userProfile?.role ?? 'cast'}
      properties={(properties ?? []) as { id: string; name: string }[]}
      locations={(locations ?? []) as { id: string; name: string; property_id: string }[]}
      roles={(roles ?? []) as { id: string; name: string }[]}
    />
  )
}
