import { requireModeratorOrAdmin } from '@/lib/auth/session'
import { FlagsClient } from './FlagsClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Flags – WDWShiftX' }

export default async function FlagsPage() {
  const { supabase, user } = await requireModeratorOrAdmin()

  const { data: flags } = await supabase
    .from('flags')
    .select('id, target_type, target_id, reason, status, created_at, flagged_by_user_id, users!flagged_by_user_id(display_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return <FlagsClient
    flags={(flags ?? []) as { id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string; flagged_by_user_id: string | null; users: { display_name: string } | null }[]}
    currentUserId={user.id}
  />
}
