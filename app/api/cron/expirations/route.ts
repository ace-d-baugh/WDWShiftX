import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { optionalServerEnv } from '@/lib/env'

/**
 * Constant-time comparison of the bearer token. `!==` short-circuits on the
 * first differing byte, which leaks the secret's prefix to anyone able to
 * measure response times closely enough. Length is compared first because
 * timingSafeEqual throws on mismatched lengths — that leaks only the length,
 * not the content.
 */
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

  // Authenticate BEFORE reporting configuration state. Checking config first
  // let an unauthenticated caller tell "not configured" (500) from
  // "unauthorized" (401) and learn something about the deployment.
  if (!configured || !authorized(req.headers.get('authorization'), optionalServerEnv.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Expire shifts where expires_at <= NOW()
    const { error: shiftsError } = await supabase.rpc('expire_shifts')
    if (shiftsError) throw shiftsError

    // Expire requests where expires_at <= NOW()
    const { error: requestsError } = await supabase.rpc('expire_requests')
    if (requestsError) throw requestsError

    return NextResponse.json({
      success: true,
      message: 'Expirations processed successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error: unknown) {
    // Log the detail, don't return it: the raw Postgres error can name tables,
    // columns and constraints.
    console.error('Expiration cron error:', error)
    return NextResponse.json({ error: 'Failed to process expirations' }, { status: 500 })
  }
}
