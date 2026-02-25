import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { FlagsClient } from './FlagsClient'
import type { UserRole } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Flags – WDWShiftX' }

type ProfileRow = { role: UserRole } | null

export default async function FlagsPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('role').eq('id', session.user.id).single() as unknown as { data: ProfileRow }

  if (!userProfile || !['leader', 'admin'].includes(userProfile.role)) {
    redirect('/board')
  }

  const { data: flags } = await supabase
    .from('flags')
    .select('id, target_type, target_id, reason, status, created_at, users!flagged_by_user_id(display_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return <FlagsClient
    flags={(flags ?? []) as { id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string; users: { display_name: string } | null }[]}
    resolverId={session.user.id}
  />
}
