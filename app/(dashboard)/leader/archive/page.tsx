import { requireModeratorOrAdmin } from '@/lib/auth/session'
import { ArchiveClient } from './ArchiveClient'
import type { RemovedReason } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Archive – WDWShiftX' }

const REASONS: RemovedReason[] = ['expired', 'leader_removed', 'user_removed', 'covered', 'fulfilled']

export default async function ArchivePage() {
  const { supabase } = await requireModeratorOrAdmin()

  const now = new Date().toISOString()

  const [{ data: archivedShifts }, { data: archivedRequests }, shiftCounts, requestCounts] = await Promise.all([
    supabase
      .from('shifts')
      .select('id, shift_title, created_by, start_time, end_time, is_trade, is_giveaway, is_overtime_approved, created_at, removed_reason, remover:users!removed_by_user_id(display_name), boards(name)')
      .or(`is_active.eq.false,expires_at.lte.${now}`)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('requests')
      .select('id, created_by, requested_date, preferred_times, created_at, removed_reason, remover:users!removed_by_user_id(display_name), boards(name)')
      .or(`is_active.eq.false,expires_at.lte.${now}`)
      .order('created_at', { ascending: false })
      .limit(50),
    Promise.all(REASONS.map(reason =>
      supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('removed_reason', reason)
    )),
    Promise.all(REASONS.map(reason =>
      supabase.from('requests').select('id', { count: 'exact', head: true }).eq('removed_reason', reason)
    )),
  ])

  const counts = {
    shifts: Object.fromEntries(REASONS.map((r, i) => [r, shiftCounts[i].count ?? 0])) as Record<RemovedReason, number>,
    requests: Object.fromEntries(REASONS.map((r, i) => [r, requestCounts[i].count ?? 0])) as Record<RemovedReason, number>,
  }

  return <ArchiveClient
    archivedShifts={(archivedShifts ?? []) as { id: string; shift_title: string; created_by: string; start_time: string; end_time: string; is_trade: boolean; is_giveaway: boolean; is_overtime_approved: boolean; created_at: string; removed_reason: RemovedReason | null; remover: { display_name: string | null } | null; boards: { name: string } | null }[]}
    archivedRequests={(archivedRequests ?? []) as { id: string; created_by: string; requested_date: string; preferred_times: string[]; created_at: string; removed_reason: RemovedReason | null; remover: { display_name: string | null } | null; boards: { name: string } | null }[]}
    counts={counts}
  />
}
