import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { EMAIL_FROM } from '@/lib/email-constants'
import { formatInTimeZone } from 'date-fns-tz'
import { parseISO } from 'date-fns'
import { weeklyDigestHtml } from '@/components/email-template'
import { digestUnsubscribeSig } from '@/lib/digest'
import { optionalServerEnv } from '@/lib/env'

// Task 22: weekly digest — "N new shifts on your boards this week".
// Scheduled in vercel.json (Sunday evening ET). Skips users with nothing new,
// so quiet boards never generate empty email.

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wdwshiftx.com'
const ET = 'America/New_York'
const MAX_ITEMS_PER_EMAIL = 6

interface DigestItem {
  title: string
  when: string
  board: string
  boardId: string
  posterId: string | null
  isShift: boolean
}

export async function GET(req: NextRequest) {
  if (!optionalServerEnv.CRON_SECRET || !optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY || !optionalServerEnv.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${optionalServerEnv.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const resend = new Resend(optionalServerEnv.RESEND_API_KEY)

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // New, still-live posts from the past week across all boards
    const [{ data: shifts }, { data: requests }] = await Promise.all([
      supabase
        .from('shifts')
        .select('shift_title, start_time, board_id, user_id, boards!board_id(name)')
        .eq('is_active', true)
        .not('board_id', 'is', null)
        .gte('created_at', weekAgo)
        .gt('expires_at', now.toISOString())
        .order('start_time', { ascending: true }),
      supabase
        .from('requests')
        .select('request_title, requested_date, board_id, user_id, boards!board_id(name)')
        .eq('is_active', true)
        .gte('created_at', weekAgo)
        .gt('expires_at', now.toISOString())
        .order('requested_date', { ascending: true }),
    ])

    const items: DigestItem[] = [
      ...(shifts ?? []).map(s => ({
        title: s.shift_title as string,
        when: formatInTimeZone(parseISO(s.start_time as string), ET, 'EEE, MMM d · h:mm a'),
        board: ((s.boards as unknown) as { name: string } | null)?.name ?? 'your board',
        boardId: s.board_id as string,
        posterId: s.user_id as string | null,
        isShift: true,
      })),
      ...(requests ?? []).map(r => ({
        title: ((r.request_title as string | null) ?? 'Shift Wanted'),
        when: formatInTimeZone(parseISO(`${r.requested_date as string}T12:00:00Z`), ET, 'EEE, MMM d'),
        board: ((r.boards as unknown) as { name: string } | null)?.name ?? 'your board',
        boardId: r.board_id as string,
        posterId: r.user_id as string | null,
        isShift: false,
      })),
    ]

    if (items.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No new activity this week' })
    }

    // Who can see these boards
    const boardIds = [...new Set(items.map(i => i.boardId))]
    const { data: memberships } = await supabase
      .from('user_boards')
      .select('user_id, board_id')
      .in('board_id', boardIds)
      .eq('is_approved', true)

    const boardsByUser = new Map<string, Set<string>>()
    for (const m of memberships ?? []) {
      const set = boardsByUser.get(m.user_id as string) ?? new Set<string>()
      set.add(m.board_id as string)
      boardsByUser.set(m.user_id as string, set)
    }

    const userIds = [...boardsByUser.keys()]
    if (userIds.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No board members to notify' })
    }

    const { data: users } = await supabase
      .from('users')
      .select('id, email, display_name, notify_via_email, notify_weekly_digest, is_active')
      .in('id', userIds)

    let sent = 0
    const failures: string[] = []

    for (const u of users ?? []) {
      if (!u.is_active || !u.notify_via_email || !u.notify_weekly_digest || !u.email) continue

      const visibleBoards = boardsByUser.get(u.id as string)
      if (!visibleBoards) continue

      // Their boards' new posts, excluding their own
      const mine = items.filter(i => visibleBoards.has(i.boardId) && i.posterId !== u.id)
      if (mine.length === 0) continue

      const shiftCount = mine.filter(i => i.isShift).length
      const requestCount = mine.length - shiftCount
      const sig = digestUnsubscribeSig(u.id as string, optionalServerEnv.CRON_SECRET)

      const { error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: u.email as string,
        subject: shiftCount > 0
          ? `${shiftCount} new shift${shiftCount === 1 ? '' : 's'} on your boards this week`
          : `${requestCount} new shift request${requestCount === 1 ? '' : 's'} on your boards this week`,
        html: weeklyDigestHtml({
          displayName: (u.display_name as string | null) ?? undefined,
          shiftCount,
          requestCount,
          items: mine.slice(0, MAX_ITEMS_PER_EMAIL).map(({ title, when, board }) => ({ title, when, board })),
          wallUrl: `${BASE_URL}/wall`,
          unsubscribeUrl: `${BASE_URL}/api/digest/unsubscribe?uid=${u.id}&sig=${sig}`,
        }),
      })

      if (error) failures.push(`${u.id}: ${error.message}`)
      else sent++
    }

    return NextResponse.json({
      success: true,
      sent,
      failures: failures.length ? failures : undefined,
      newPosts: items.length,
      timestamp: now.toISOString(),
    })
  } catch (error: unknown) {
    console.error('Weekly digest cron error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to send weekly digest', details: message }, { status: 500 })
  }
}
