import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { optionalServerEnv } from '@/lib/env'

/** Same constant-time bearer check as /api/cron/expirations. */
function authorized(header: string | null, secret: string): boolean {
  if (!header) return false
  const provided = Buffer.from(header)
  const expected = Buffer.from(`Bearer ${secret}`)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export async function GET(req: NextRequest) {
  const configured = Boolean(
    optionalServerEnv.CRON_SECRET && optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY
  )

  if (!configured || !authorized(req.headers.get('authorization'), optionalServerEnv.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Guests who never verified their email within 14 days — mostly fake
    // signups the invite-code gate stopped from going any further.
    const { data: staleUsers, error: staleError } = await supabase.rpc('stale_unverified_user_ids')
    if (staleError) throw staleError

    let deleted = 0
    for (const { id } of staleUsers ?? []) {
      // auth.admin.deleteUser cascades to public.users via the
      // on_auth_user_deleted trigger, and cleans up Auth-internal state
      // (sessions, identities) that a raw SQL delete wouldn't touch.
      const { error: deleteError } = await supabase.auth.admin.deleteUser(id)
      if (deleteError) {
        console.error(`cleanup-unverified: failed to delete user ${id}:`, deleteError)
        continue
      }
      deleted++
    }

    const { error: pruneError } = await supabase.rpc('prune_signup_attempts')
    if (pruneError) throw pruneError

    return NextResponse.json({
      success: true,
      deleted,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    console.error('Cleanup-unverified cron error:', error)
    return NextResponse.json({ error: 'Failed to clean up unverified users' }, { status: 500 })
  }
}
