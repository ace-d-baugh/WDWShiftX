import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { registerSchema } from '@/lib/validations/auth'
import { REGISTRATION_PAUSED } from '@/lib/registration'
import { optionalServerEnv } from '@/lib/env'

function clientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() ?? 'unknown'
}

export async function POST(req: NextRequest) {
  if (REGISTRATION_PAUSED) {
    return NextResponse.json({ ok: false, error: 'Registration is currently paused.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  // Honeypot — a hidden form field real users never see or fill. A bot
  // driving the form (or a naive script replaying its fields) fills every
  // input, including this one. Report success so it doesn't adjust its
  // script, but never touch Supabase Auth.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: true, needsVerification: true })
  }

  const parseResult = registerSchema.safeParse({
    first_name: body.first_name,
    last_name: body.last_name,
    email: body.email,
    password: body.password,
    confirm_password: body.confirm_password,
    terms_accepted: body.terms_accepted,
  })
  if (!parseResult.success) {
    return NextResponse.json({ ok: false, error: 'Invalid registration details.' }, { status: 400 })
  }

  // Rate limit by IP before ever touching Supabase Auth — 5/hour, 15/day.
  // Skipped only if the service role key isn't configured (local dev without
  // it), same soft-fail convention as the cron routes.
  if (optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient()
    const { data: underLimit, error: rateLimitError } = await admin.rpc('check_signup_rate_limit', {
      p_ip: clientIp(req),
    })
    if (rateLimitError) {
      console.error('register: rate limit check failed:', rateLimitError)
    } else if (!underLimit) {
      return NextResponse.json(
        { ok: false, error: 'Too many signup attempts from this network. Please try again later.' },
        { status: 429 }
      )
    }
  }

  const { first_name, last_name, email, password } = parseResult.data
  const inviteCode = typeof body.invite_code === 'string' ? body.invite_code : undefined
  const emailRedirectTo = typeof body.emailRedirectTo === 'string' ? body.emailRedirectTo : undefined

  const supabase = createServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        given_name: first_name,
        family_name: last_name,
        full_name: `${first_name} ${last_name}`,
        ...(inviteCode && { invite_code: inviteCode }),
      },
    },
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, needsVerification: Boolean(data.user && !data.session) })
}
