import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildIcsCalendar } from '@/lib/ical'
import { env, optionalServerEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Include the last 30 days so recently worked shifts don't vanish from the
// subscriber's calendar view; everything upcoming is always included.
const LOOKBACK_DAYS = 30

/**
 * Per-user iCal feed (Task 17, Pro/Trial only). The token in the URL is the
 * only authentication — calendar apps can't send cookies — so any failure
 * (bad token, unknown token, non-Pro member) is a uniform 404 that reveals
 * nothing about whether the token exists.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  if (!optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return new NextResponse('Calendar feeds are not configured.', { status: 503 })
  }

  // Accept both /api/calendar/<uuid> and /api/calendar/<uuid>.ics
  const raw = params.token
  const wantsDownload = _req.nextUrl.searchParams.get('download') === '1'
  const token = raw.endsWith('.ics') ? raw.slice(0, -4) : raw
  if (!UUID_RE.test(token)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: user } = await db
    .from('users')
    .select('id, membership, is_active')
    .eq('ical_token', token)
    .maybeSingle()

  if (!user || !user.is_active || (user.membership !== 'Pro' && user.membership !== 'Trial')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: shifts, error } = await db
    .from('shifts')
    .select('id, shift_title, start_time, end_time, details, boards(name)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .gte('end_time', since)
    .order('start_time', { ascending: true })

  if (error) {
    console.error('[calendar-feed] shifts query error:', error.message)
    return new NextResponse('Temporarily unavailable', { status: 500 })
  }

  const ics = buildIcsCalendar({
    calendarName: 'WDWShiftX Shifts',
    events: (shifts ?? []).map(s => {
      const boardName = (s.boards as unknown as { name: string } | null)?.name
      const description = [s.details, boardName ? `Board: ${boardName}` : null]
        .filter(Boolean)
        .join('\n')
      return {
        uid: s.id as string,
        start: s.start_time as string,
        end: s.end_time as string,
        summary: s.shift_title as string,
        description: description || undefined,
        url: 'https://wdwshiftx.com/calendar',
      }
    }),
  })

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': wantsDownload
        ? 'attachment; filename="wdwshiftx-shifts.ics"'
        : 'inline; filename="wdwshiftx-shifts.ics"',
      // Calendar apps poll on their own schedule; keep responses fresh
      'Cache-Control': 'private, no-cache',
    },
  })
}
