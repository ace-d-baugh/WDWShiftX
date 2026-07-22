import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDigestUnsubscribeSig } from '@/lib/digest'
import { optionalServerEnv } from '@/lib/env'

// Task 22: one-click unsubscribe from the weekly digest email. The link in
// the email carries an HMAC signature, so no login is needed and the URL
// can't be forged for other users. Only flips notify_weekly_digest — all
// other notifications are untouched.

const page = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${title} – WDWShiftX</title></head>
<body style="margin:0;padding:48px 16px;background:#f5f0ff;font-family:Arial,Helvetica,sans-serif;text-align:center;">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:10px;padding:32px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <h1 style="margin:0 0 12px;font-size:20px;color:#2f2040;">${title}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5a4a6e;">${body}</p>
    <a href="https://wdwshiftx.com/profile" style="color:#BD80FF;font-size:14px;text-decoration:none;font-weight:600;">Manage notifications in your profile →</a>
  </div>
</body>
</html>`

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid') ?? ''
  const sig = req.nextUrl.searchParams.get('sig') ?? ''

  if (!optionalServerEnv.CRON_SECRET || !optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  if (!uid || !sig || !verifyDigestUnsubscribeSig(uid, sig, optionalServerEnv.CRON_SECRET)) {
    return new NextResponse(
      page('Link not valid', 'This unsubscribe link is invalid or has been altered. You can still turn the weekly digest off from your profile.'),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    )
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('users')
    .update({ notify_weekly_digest: false })
    .eq('id', uid)

  if (error) {
    return new NextResponse(
      page('Something went wrong', 'We could not update your preference just now. Please try again, or turn the digest off from your profile.'),
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }

  return new NextResponse(
    page('You\'re unsubscribed', 'You will no longer receive the weekly digest. Match alerts, claims, and other notifications are unaffected.'),
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}
