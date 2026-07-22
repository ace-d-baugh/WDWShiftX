import Link from 'next/link'
import { Trash2, Mail, Clock, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Data Deletion Instructions',
  description: 'How to request the deletion of your WDWShiftX account and personal data.',
}

export default async function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">

        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text/60 hover:text-text mb-8 min-h-0 min-w-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-warning/10 rounded-full flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-warning" />
            </div>
            <h1 className="font-accent text-3xl font-bold text-text">Data Deletion Instructions</h1>
          </div>
          <p className="text-text/60 text-sm">
            Last updated: June 2026 &nbsp;·&nbsp;{' '}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </p>
        </div>

        <div className="space-y-8 text-text/80 leading-relaxed">

          {/* Overview */}
          <section>
            <p className="text-base">
              WDWShiftX (operated by one private individual LLC) is committed to your privacy. Whether you
              signed up with an email address or through Google, Facebook, or LinkedIn, this page
              explains exactly how to delete your account and personal data.
            </p>
          </section>

          {/* What data we store */}
          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">What Data We Store</h2>
            <p className="mb-3 text-sm">When you create a WDWShiftX account, we store:</p>
            <ul className="space-y-1.5 list-none pl-0">
              {[
                'Your email address',
                'Your display name (set by you)',
                'Your phone number (optional, if provided)',
                'Shift offers and requests you have posted',
                'Board memberships and your role on each board',
                'Comments and interest marks on posts',
                'Notification and display preferences (time zone, date format, dark mode)',
                'OAuth connection record if you signed in via Google, Facebook, or LinkedIn',
              ].map(item => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-text/60">
              We do <strong>not</strong> store your passwords in readable form — only a cryptographic hash.
            </p>
          </section>

          {/* Option 1 — Self-service */}
          <section className="card shadow-sm border-l-4 border-l-primary">
            <h2 className="font-accent text-lg font-bold text-text mb-2">
              Option 1 — Delete Your Account Yourself
            </h2>
            <p className="text-sm mb-3">
              The fastest way is to deactivate your account directly from within the app:
            </p>
            <ol className="space-y-2 text-sm list-none pl-0">
              {[
                'Log in to WDWShiftX',
                'Go to your Profile page',
                'Scroll to the Danger Zone section',
                'Click "Deactivate Account" and confirm',
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-xs text-text/50 mt-3">
              This immediately deactivates your account and removes your posts from all boards.
              Full data purge occurs within 30 days.
            </p>
          </section>

          {/* Option 2 — Email request */}
          <section className="card shadow-sm border-l-4 border-l-info">
            <h2 className="font-accent text-lg font-bold text-text mb-2">
              Option 2 — Email Us a Deletion Request
            </h2>
            <p className="text-sm mb-3">
              If you no longer have access to your account, email us and we will delete your data
              within <strong>30 days</strong>.
            </p>
            <a
              href="mailto:support@wdwshiftx.com?subject=Data%20Deletion%20Request&body=Please%20delete%20all%20data%20associated%20with%20my%20account.%0A%0AEmail%20address%20used%20to%20register%3A%20"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Mail className="w-4 h-4" />
              support@wdwshiftx.com
            </a>
            <p className="text-xs text-text/50 mt-3">
              Please include the email address associated with your account so we can locate your
              data. We may ask you to verify your identity before processing the request.
            </p>
          </section>

          {/* Timeline */}
          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">Deletion Timeline</h2>
            <div className="flex items-start gap-3 text-sm">
              <Clock className="w-4 h-4 text-text/40 shrink-0 mt-0.5" />
              <p>
                Once a deletion request is received or initiated, all personal data is permanently
                removed from our systems within <strong>30 days</strong>. Anonymized, aggregated
                data (e.g., total post counts) that cannot be linked back to you may be retained
                for analytics purposes.
              </p>
            </div>
          </section>

          {/* What cannot be deleted */}
          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">What Cannot Be Deleted</h2>
            <p className="text-sm mb-3">
              Certain records must be retained even after a deletion request due to legal obligations:
            </p>
            <ul className="space-y-1.5 list-none pl-0">
              <li className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span>
                  <strong>Server log files</strong> — retained for up to 90 days for security
                  and fraud prevention purposes, then automatically purged.
                </span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span>
                  <strong>Data required by law enforcement</strong> — if we are under a legal
                  hold or have received a valid court order, we may be required to preserve
                  certain data until the legal matter is resolved.
                </span>
              </li>
            </ul>
          </section>

          {/* OAuth revocation — Google */}
          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">Google Login Users</h2>
            <p className="text-sm mb-3">
              If you registered with Google Sign-In, you can revoke WDWShiftX&apos;s access directly
              from your Google account:
            </p>
            <ol className="space-y-2 text-sm list-none pl-0">
              {[
                'Go to myaccount.google.com → Security',
                'Scroll to "Third-party apps & services"',
                'Find WDWShiftX and click "Remove Access"',
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-success/15 text-success text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-xs text-text/50 mt-3">
              Revoking Google access prevents future sign-ins but does not delete your WDWShiftX
              account data. Follow Option 1 or Option 2 above to delete your data.
            </p>
          </section>

          {/* OAuth revocation — Facebook */}
          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">Facebook Login Users</h2>
            <p className="text-sm mb-3">
              If you registered with Facebook Login, you can revoke WDWShiftX&apos;s access directly
              from Facebook:
            </p>
            <ol className="space-y-2 text-sm list-none pl-0">
              {[
                'Go to Facebook Settings → Security and Login',
                'Click "Apps and Websites"',
                'Find WDWShiftX and click "Remove"',
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-info/15 text-info text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-xs text-text/50 mt-3">
              Revoking Facebook access prevents future sign-ins but does not delete your WDWShiftX
              account data. Follow Option 1 or Option 2 above to delete your data.
            </p>
          </section>

          {/* OAuth revocation — LinkedIn */}
          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">LinkedIn Login Users</h2>
            <p className="text-sm mb-3">
              If you registered with LinkedIn, you can revoke WDWShiftX&apos;s access from your
              LinkedIn settings:
            </p>
            <ol className="space-y-2 text-sm list-none pl-0">
              {[
                'Go to linkedin.com → Settings & Privacy',
                'Click "Data Privacy" → "Permitted Services"',
                'Find WDWShiftX and click "Remove"',
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-xs text-text/50 mt-3">
              Revoking LinkedIn access prevents future sign-ins but does not delete your WDWShiftX
              account data. Follow Option 1 or Option 2 above to delete your data.
            </p>
          </section>

          {/* Contact */}
          <section className="border-t border-border pt-6">
            <p className="text-sm text-text/60">
              Questions about your data?{' '}
              <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">
                support@wdwshiftx.com
              </a>
              {' '}·{' '}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              {' '}·{' '}
              <Link href="/terms" className="text-primary hover:underline">Terms &amp; Conditions</Link>
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
