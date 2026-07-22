import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { optionalServerEnv } from '@/lib/env'
import { CalendarClient } from './CalendarClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Calendar' }

export default async function CalendarPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Date window: start of this month → end of month+3
  const now = new Date()
  const windowStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 4, 0)
  const windowEnd = new Date(endMonth.getFullYear(), endMonth.getMonth(), endMonth.getDate(), 23, 59, 59).toISOString()

  const [{ data: myShifts }, { data: boardShifts }, { data: boardRequests }, { data: profile }, { data: memberRows }] = await Promise.all([
    // User's own shifts (all types — personal calendar entries)
    supabase
      .from('shifts')
      .select('id, shift_title, start_time, end_time, is_trade, is_giveaway, board_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gte('start_time', windowStart)
      .lte('start_time', windowEnd)
      .order('start_time', { ascending: true }),
    // Board-level public shifts for dots (all boards the user belongs to)
    supabase
      .from('shifts')
      .select('id, start_time, is_trade, is_giveaway, board_id')
      .eq('is_active', true)
      .or('is_trade.eq.true,is_giveaway.eq.true')
      .gte('start_time', windowStart)
      .lte('start_time', windowEnd)
      .gt('expires_at', now.toISOString()),
    // Board-level requests for dots
    supabase
      .from('requests')
      .select('id, requested_date, board_id')
      .eq('is_active', true)
      .gte('requested_date', windowStart.split('T')[0])
      .lte('requested_date', windowEnd.split('T')[0])
      .gt('expires_at', now.toISOString()),
    // Display name for shifts created via schedule import
    supabase.from('users').select('display_name').eq('id', user.id).single(),
    // Approved boards — feeds the hidden screenshot board filter
    supabase
      .from('user_boards')
      .select('board_id, boards(id, name)')
      .eq('user_id', user.id)
      .eq('is_approved', true),
  ])

  const boards = (memberRows ?? [])
    .map((ub: { board_id: string; boards: { id: string; name: string } | null }) => ub.boards)
    .filter((b): b is { id: string; name: string } => !!b)
    .sort((a, b) => a.name.localeCompare(b.name))

  // Photo schedule import stays hidden until the Gemini key is configured —
  // same env-var-flip pattern as AdSense.
  const importEnabled = Boolean(optionalServerEnv.GEMINI_API_KEY)

  return (
    <CalendarClient
      userId={user.id}
      displayName={profile?.display_name ?? 'User'}
      importEnabled={importEnabled}
      today={now.toISOString()}
      myShifts={(myShifts ?? []) as {
        id: string; shift_title: string; start_time: string; end_time: string
        is_trade: boolean; is_giveaway: boolean; board_id: string | null
      }[]}
      boardShifts={(boardShifts ?? []) as {
        id: string; start_time: string; is_trade: boolean; is_giveaway: boolean; board_id: string | null
      }[]}
      boardRequests={(boardRequests ?? []) as { id: string; requested_date: string; board_id: string | null }[]}
      boards={boards}
      isPro={true}
    />
  )
}
