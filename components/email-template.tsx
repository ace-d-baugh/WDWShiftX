// Shared email template helpers — used by transactional emails sent via Resend.
// All functions return an HTML string safe to pass to resend.emails.send().

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wdwshiftx.com'

// ── Shell (header + footer wrapping all emails) ────────────────────────────────
// Header matches the confirm-email-template gradient style.
// Google Fonts loads in Apple Mail / iOS Mail only; Arial/Georgia cover everyone else.

const shell = (body: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WDWShiftX</title>
  <link href="https://fonts.googleapis.com/css2?family=Philosopher:wght@700&family=Lato:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f5f0ff;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f5f0ff;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:560px;width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td align="center"
                style="
                  background-color:#F0E2FF;
                  background-image:
                    linear-gradient(148deg, rgba(255,255,255,0.25) 0%, transparent 38%),
                    linear-gradient(135deg, rgba(60,0,140,0.38)    0%, transparent 52%),
                    linear-gradient(315deg, rgba(70,5,150,0.34)     0%, transparent 52%),
                    linear-gradient(225deg, rgba(50,0,130,0.26)    0%, transparent 48%),
                    linear-gradient(45deg,  rgba(65,5,145,0.24)    0%, transparent 48%);
                  padding:32px 24px;
                  text-align:center;
                ">
              <img
                src="https://wdwshiftx.com/logos/WDWShiftX-Full-Logo-Gradient.png"
                alt="WDWShiftX"
                width="220"
                height="45"
                style="display:block;border:0;margin:0 auto;"
              />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
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

// ── Primitive helpers ──────────────────────────────────────────────────────────

// User-sourced values (display names, shift titles, board names) MUST pass
// through esc() before interpolation — otherwise a shift titled
// "<a href=phish>..." becomes live HTML in someone else's inbox.
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const btn = (href: string, label: string) => `
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;">
    <tr>
      <td align="center" style="background:#BD80FF;border-radius:8px;">
        <a href="${href}"
           style="display:inline-block;padding:14px 28px;font-family:'Lato',Arial,Helvetica,sans-serif;
                  font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;
                  border-radius:8px;letter-spacing:0.2px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>
`

const h1 = (text: string) =>
  `<h1 style="margin:0 0 12px;font-family:'Philosopher',Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#2f2040;">${text}</h1>`

const p = (text: string) =>
  `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#5a4a6e;">${text}</p>`

const muted = (text: string) =>
  `<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9b8ab4;line-height:1.5;">${text}</p>`

const highlight = (text: string) =>
  `<p style="margin:0 0 24px;padding:16px 20px;background-color:#F2E6FF;border-left:4px solid #BD80FF;
             border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;
             color:#2f2040;line-height:1.4;">${text}</p>`

// ── Templates ──────────────────────────────────────────────────────────────────

/** Supabase passes {{ .ConfirmationURL }} — paste into the Supabase email template editor */
export const verifyEmailHtml = (confirmUrl: string, displayName?: string) =>
  shell(`
    ${h1('Confirm your email address')}
    ${p(`Hi${displayName ? ` ${esc(displayName)}` : ''},`)}
    ${p('Thanks for signing up! Click the button below to verify your email address and activate your WDWShiftX account.')}
    ${btn(confirmUrl, 'Confirm Email Address')}
    ${muted("This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.")}
  `)

/** Password reset email */
export const resetPasswordHtml = (resetUrl: string) =>
  shell(`
    ${h1('Reset your password')}
    ${p("We received a request to reset the password for your WDWShiftX account.")}
    ${btn(resetUrl, 'Reset Password')}
    ${muted("This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.")}
  `)

/** Sent when a user's board join request is approved */
export const boardApprovedHtml = (opts: {
  displayName?: string
  boardName: string
  wallUrl: string
}) =>
  shell(`
    ${h1('You\'re in! 🎉')}
    ${p(`Hi${opts.displayName ? ` ${esc(opts.displayName)}` : ''},`)}
    ${p(`Congratulations — your request to join has been approved!`)}
    ${highlight(esc(opts.boardName))}
    ${p('Head over to the wall to start browsing shift offers and requests from your new board.')}
    ${btn(opts.wallUrl, 'Go to the Wall')}
    ${muted('You received this because you requested to join a board on WDWShiftX.')}
  `)

/** Sent to a post owner when someone marks interest on their shift or request */
export const interestedHtml = (opts: {
  commenterName: string
  postTitle: string
  postType: 'shift' | 'request'
  wallUrl: string
}) =>
  shell(`
    ${h1('Someone is interested! ⭐')}
    ${p(`<strong>${esc(opts.commenterName)}</strong> just marked interest in your ${opts.postType === 'shift' ? 'shift offer' : 'shift request'}:`)}
    ${highlight(esc(opts.postTitle))}
    ${p('Head to The Wall to connect with them.')}
    ${btn(opts.wallUrl, 'Go to The Wall')}
    ${muted('You can turn off email notifications in your profile settings.')}
  `)

/** Sent to a shift owner when someone claims their shift (Trade Loop) */
export const claimReceivedHtml = (opts: {
  claimantName: string
  shiftTitle: string
  wallUrl: string
}) =>
  shell(`
    ${h1('Someone wants your shift! 🤝')}
    ${p(`<strong>${esc(opts.claimantName)}</strong> tapped "I'll take this shift" on your post:`)}
    ${highlight(esc(opts.shiftTitle))}
    ${p('Head to The Wall to accept or decline their claim. Accepting marks your post as covered.')}
    ${btn(opts.wallUrl, 'Review the Claim')}
    ${muted('You can turn off email notifications in your profile settings.')}
  `)

/** Sent to a claimant when the owner accepts or declines their claim (Trade Loop) */
export const claimResultHtml = (opts: {
  accepted: boolean
  ownerName: string
  shiftTitle: string
  /** accepted → profile trade record; declined → back to the wall */
  ctaUrl: string
}) =>
  opts.accepted
    ? shell(`
        ${h1('Your claim was accepted! 🎉')}
        ${p(`<strong>${esc(opts.ownerName)}</strong> accepted your claim on:`)}
        ${highlight(esc(opts.shiftTitle))}
        ${p('Now complete the trade in your company\'s scheduling system. Once it goes through, the owner will confirm it and it will count toward your trade record.')}
        ${btn(opts.ctaUrl, 'View Your Trade Record')}
        ${muted('You can turn off email notifications in your profile settings.')}
      `)
    : shell(`
        ${h1('Update on your claim')}
        ${p(`<strong>${esc(opts.ownerName)}</strong> declined your claim on:`)}
        ${highlight(esc(opts.shiftTitle))}
        ${p('No worries — there are more shifts on The Wall.')}
        ${btn(opts.ctaUrl, 'Back to The Wall')}
        ${muted('You can turn off email notifications in your profile settings.')}
      `)

/** Sent when a Pro renewal charge fails, before Stripe exhausts its retries (Task 7) */
export const paymentFailedHtml = (opts: {
  displayName?: string
  amountDue: number
  billingUrl: string
}) =>
  shell(`
    ${h1('Your Pro payment did not go through')}
    ${p(`${opts.displayName ? `Hi ${esc(opts.displayName)},` : 'Hi,'} we tried to charge <strong>$${opts.amountDue.toFixed(2)}</strong> for your WDWShiftX Pro subscription and your card was declined.`)}
    ${p('Usually this is just an expired card or a new billing address. We will keep retrying for a few days — updating your payment method now is enough to fix it, and nothing about your account changes in the meantime.')}
    ${btn(opts.billingUrl, 'Update Payment Method')}
    ${muted('If the payment ultimately fails, your account returns to Basic. Your boards, shifts, and messages are never deleted.')}
  `)

/** Sent to both parties when a shift and request on the same board may match */
export const shiftMatchHtml = (opts: {
  recipientRole: 'shift-poster' | 'requester'
  otherPartyName: string
  ownPostTitle: string
  otherPostTitle: string
  boardName: string
  shiftDate: string
  wallUrl: string
}) => {
  const isShiftPoster = opts.recipientRole === 'shift-poster'
  const heading = isShiftPoster
    ? 'Your shift may match a request! ⭐'
    : 'A shift may match your request! ⭐'
  const line1 = isShiftPoster
    ? `<strong>${esc(opts.otherPartyName)}</strong> has a shift request on <strong>${esc(opts.boardName)}</strong> that may match your shift offer:`
    : `<strong>${esc(opts.otherPartyName)}</strong> just posted a shift offer on <strong>${esc(opts.boardName)}</strong> that may match your request:`
  const ownLabel  = isShiftPoster ? 'Your shift offer:' : 'Your request:'
  const otherLabel = isShiftPoster ? 'Their request:' : 'Their shift offer:'
  return shell(`
    ${h1(heading)}
    ${p(line1)}
    <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;">
      <tr>
        <td style="padding:0 0 8px;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9b8ab4;text-transform:uppercase;letter-spacing:0.5px;">${ownLabel}</span><br/>
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#2f2040;">${esc(opts.ownPostTitle)}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:0 0 8px;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9b8ab4;text-transform:uppercase;letter-spacing:0.5px;">${otherLabel}</span><br/>
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#2f2040;">${esc(opts.otherPostTitle)}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:0 0 8px;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9b8ab4;text-transform:uppercase;letter-spacing:0.5px;">Date:</span><br/>
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#2f2040;">${opts.shiftDate}</span>
        </td>
      </tr>
    </table>
    ${p('Head to The Wall to reach out and coordinate directly.')}
    ${btn(opts.wallUrl, 'Go to The Wall')}
    ${muted('You can turn off email notifications in your profile settings.')}
  `)
}

// (betaClosingHtml and a generic notificationHtml used to live here — both
// had no callers and were removed in the 2026-07-18 code-scan cleanup. Git
// history has them if a one-off send is ever needed again.)
