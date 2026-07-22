import { requireModeratorOrAdmin } from '@/lib/auth/session'
import { ApprovalsClient } from './ApprovalsClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Approvals – WDWShiftX' }

interface PendingRequest {
  id: string
  board_id: string
  requested_at: string
  users: { display_name: string } | null
  boards: { name: string } | null
}

export default async function ApprovalsPage() {
  const { supabase } = await requireModeratorOrAdmin()

  // Use a SECURITY DEFINER RPC so the multi-table RLS interaction
  // (user_boards → boards → is_board_member → user_boards) doesn't
  // silently drop rows. Authorization is checked inside the function.
  const { data: rows } = await supabase.rpc('get_pending_board_requests')

  const pendingRequests: PendingRequest[] = (rows ?? []).map((r: {
    id: string; board_id: string; requested_at: string;
    user_display_name: string | null; board_name: string | null
  }) => ({
    id:           r.id,
    board_id:     r.board_id,
    requested_at: r.requested_at,
    users:        r.user_display_name ? { display_name: r.user_display_name } : null,
    boards:       r.board_name        ? { name: r.board_name }               : null,
  }))

  return (
    <ApprovalsClient
      pendingRequests={pendingRequests}
    />
  )
}
