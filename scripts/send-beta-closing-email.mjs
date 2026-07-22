// One-off ops script: emails every active user to let them know the beta is
// closing tonight. Run with --dry-run first to see the recipient list and
// preview the email without sending anything.
//
//   node scripts/send-beta-closing-email.mjs --dry-run
//   node scripts/send-beta-closing-email.mjs
//
// Not part of the app build — plain Node/ESM so it runs without ts-node/tsx.

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { readFileSync } from 'fs'

function loadEnvLocal() {
  let text
  try {
    text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    return
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://wdwshiftx.com'
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
if (!DRY_RUN && !RESEND_API_KEY) {
  console.error('Missing RESEND_API_KEY.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

const surveyUrl = `${BASE_URL}/survey`
const betaTestUrl = `${BASE_URL}/beta-test`

function emailHtml(displayName) {
  const greeting = displayName ? ` ${displayName}` : ''
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WDWShiftX</title>
  <link href="https://fonts.googleapis.com/css2?family=Philosopher:wght@700&family=Lato:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f5f0ff;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f5f0ff;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="background-color:#F0E2FF;background-image:linear-gradient(148deg, rgba(255,255,255,0.25) 0%, transparent 38%),linear-gradient(135deg, rgba(60,0,140,0.38) 0%, transparent 52%),linear-gradient(315deg, rgba(70,5,150,0.34) 0%, transparent 52%),linear-gradient(225deg, rgba(50,0,130,0.26) 0%, transparent 48%),linear-gradient(45deg, rgba(65,5,145,0.24) 0%, transparent 48%);padding:32px 24px;text-align:center;">
              <img src="https://wdwshiftx.com/logos/ShiftX-logo-sm.png" alt="WDWShiftX" width="200" height="50" style="display:block;border:0;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              <h1 style="margin:0 0 12px;font-family:'Philosopher',Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#2f2040;">The beta is wrapping up tonight 💜</h1>
              <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#5a4a6e;">Hi${greeting},</p>
              <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#5a4a6e;">Beta testing is sadly wrapping up tonight. WDWShiftX will go dark while I process everyone&rsquo;s feedback and get ready for what&rsquo;s next.</p>
              <p style="margin:0 0 24px;padding:16px 20px;background-color:#F2E6FF;border-left:4px solid #BD80FF;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#2f2040;line-height:1.4;">Goes dark tonight at 11:59 PM</p>
              <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#5a4a6e;">If you haven&rsquo;t already, please fill out the survey &mdash; it&rsquo;s the single biggest thing that shapes what happens next, and it&rsquo;ll stay open for about a week even after the site goes dark.</p>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;">
                <tr>
                  <td align="center" style="background:#BD80FF;border-radius:8px;">
                    <a href="${surveyUrl}" style="display:inline-block;padding:14px 28px;font-family:'Lato',Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.2px;">Fill Out the Survey</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#5a4a6e;">Want the full story on why, and what&rsquo;s next? <a href="${betaTestUrl}" style="color:#BD80FF;">Read the beta wrap-up page</a>.</p>
              <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9b8ab4;line-height:1.5;">Thank you for being some of the very first people to use WDWShiftX, break it, and tell me what needed to change. This isn&rsquo;t goodbye &mdash; just see you soon.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#F2E6FF;border-top:1px solid #E0D8F7;text-align:center;">
              <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#2F2040;line-height:1.5;">
                Questions? <a href="mailto:support@wdwshiftx.com" style="color:#BD80FF;text-decoration:none;">support@wdwshiftx.com</a>
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9b8ab4;line-height:1.5;">
                You received this because you have an account on
                <a href="${BASE_URL}" style="color:#BD80FF;text-decoration:none;">wdwshiftx.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

async function main() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, display_name, is_active')
    .eq('is_active', true)

  if (error) {
    console.error('Failed to fetch users:', error.message)
    process.exit(1)
  }

  const recipients = (users ?? []).filter(u => !!u.email)
  console.log(`Found ${recipients.length} active user(s) with an email address.`)

  if (DRY_RUN) {
    recipients.forEach(u => console.log(` - ${u.email}  (${u.display_name ?? 'no display name'})`))
    console.log('\n--- Preview of email body (first recipient) ---\n')
    console.log(emailHtml(recipients[0]?.display_name ?? null))
    console.log('\nDry run only — no emails were sent.')
    return
  }

  let sent = 0
  let failed = 0
  for (const u of recipients) {
    try {
      const { error: sendError } = await resend.emails.send({
        from: 'noreply@wdwshiftx.com',
        to: u.email,
        subject: 'The beta is wrapping up tonight — one more thing before we go dark',
        html: emailHtml(u.display_name),
      })
      if (sendError) {
        console.error(`Failed for ${u.email}:`, sendError.message)
        failed++
      } else {
        sent++
        console.log(`Sent to ${u.email}`)
      }
    } catch (e) {
      console.error(`Failed for ${u.email}:`, e instanceof Error ? e.message : e)
      failed++
    }
    // Stay comfortably under Resend's rate limit
    await new Promise(r => setTimeout(r, 550))
  }
  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}`)
}

main()
