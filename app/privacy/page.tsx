import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Privacy Policy' }

export default async function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text/60 hover:text-text mb-8 min-h-0 min-w-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="font-accent text-3xl font-bold text-text mb-2">Privacy Policy</h1>
        <p className="text-text/50 text-sm mb-8">Last updated: July 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-text/80">

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">1. Introduction</h2>
            <p>
              This Privacy Policy explains how Digital Elegance LLC d/b/a WDWShiftX (&ldquo;WDWShiftX,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and shares information
              about you when you use our shift coordination platform (&ldquo;the Service&rdquo;).
            </p>
            <p className="mt-3">
              If you have questions or requests regarding your privacy, contact us at{' '}
              <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">support@wdwshiftx.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">2. Information We Collect</h2>

            <h3 className="font-semibold text-text mt-4 mb-2">A. Information You Provide Directly</h3>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Account information:</strong> Display name, email address, and hashed password when you register</li>
              <li><strong>Profile information:</strong> Phone number (optional), notification preferences, time zone, date and time format preferences</li>
              <li><strong>Shift and request data:</strong> Shift offers and requests you post, including dates, times, shift titles, and details</li>
              <li><strong>Communications:</strong> Comments, direct messages you exchange with other board members (including any reactions and read status), and flags submitted through the platform</li>
              <li><strong>OAuth information:</strong> If you sign in via Google, Facebook, or LinkedIn, we receive your name and email address from that provider</li>
              <li><strong>Support communications:</strong> Messages you send to our support team</li>
            </ul>

            <h3 className="font-semibold text-text mt-4 mb-2">B. Information Collected Automatically</h3>
            <p>When you use the Service, we and our service providers automatically collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Log data:</strong> IP address, browser type and version, pages visited, timestamps, referring URLs, and error logs</li>
              <li><strong>Device information:</strong> Device type, operating system, and browser settings</li>
              <li><strong>Usage data:</strong> Features you use, actions you take, and time spent on the Service</li>
              <li><strong>Cookies and similar technologies:</strong> Session identifiers and functional cookies needed to keep you logged in (see Section 6)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">3. How We Use Your Information</h2>
            <p>We use your information for the following purposes:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>To create and manage your account and provide the Service</li>
              <li>To display your shift posts and profile information to other approved members of your boards</li>
              <li>To send transactional emails (email verification, password reset, board approval notifications, calendar sync)</li>
              <li>To moderate the platform, investigate reports, and enforce our Terms of Service</li>
              <li>To detect, prevent, and respond to fraud, abuse, and security incidents</li>
              <li>To respond to your support requests and communications</li>
              <li>To comply with our legal obligations</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> use your information for advertising, sell it to data brokers,
              or share it for third-party marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">4. Information Sharing &amp; Disclosure</h2>
            <p>We do not sell, rent, or trade your personal information. We may share your information only in the following circumstances:</p>

            <h3 className="font-semibold text-text mt-4 mb-2">Within the Platform</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Your <strong>display name and shift posts</strong> are visible to all approved members of the boards you belong to</li>
              <li>Your <strong>direct messages</strong> are visible only to the other participant in that conversation. They are not visible to other board members or board moderators. Messages are stored on our servers so conversations sync across your devices, and may be reviewed by WDWShiftX when investigating a flag, abuse report, or suspected violation of our Terms of Service</li>
              <li>Deleting a chat removes it from <strong>your</strong> view only — the other participant retains their copy of the conversation</li>
              <li>Your <strong>display name</strong> is associated with your comments, flags, and interest marks as visible to moderators and post owners</li>
            </ul>

            <h3 className="font-semibold text-text mt-4 mb-2">Service Providers</h3>
            <p className="mt-2">
              We share data with third-party service providers who assist us in operating the Service.
              These providers are contractually bound to use your data only as directed by us and to
              maintain appropriate security. See Section 5 for a full list.
            </p>

            <h3 className="font-semibold text-text mt-4 mb-2">Legal Requirements</h3>
            <p className="mt-2">
              We may disclose your information if required to do so by law, subpoena, court order, or
              other governmental authority, or if we believe in good faith that disclosure is necessary
              to protect the rights, property, or safety of WDWShiftX, our users, or the public.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">5. Third-Party Service Providers</h2>
            <p>We use the following third-party services. Each processes your data in accordance with their own privacy policies:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Supabase</strong> (supabase.com) — database hosting, authentication, and real-time data sync. Data stored on AWS infrastructure in the United States.</li>
              <li><strong>Vercel</strong> (vercel.com) — application hosting and content delivery.</li>
              <li><strong>Resend</strong> (resend.com) — transactional email delivery (verification, password reset, board notifications).</li>
              <li><strong>Google</strong> (google.com) — optional OAuth sign-in and calendar sync. If used, Google shares your name and email with us.</li>
              <li><strong>Facebook / Meta</strong> (meta.com) — optional OAuth sign-in. If used, Meta shares your name and email with us.</li>
              <li><strong>LinkedIn</strong> (linkedin.com) — optional OAuth sign-in. If used, LinkedIn shares your name and email with us.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">6. Cookies &amp; Similar Technologies</h2>
            <p>We use the following types of cookies:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Session cookies:</strong> Required to keep you logged in while you use the Service. These are deleted when you close your browser or log out.</li>
              <li><strong>Preference cookies:</strong> Store your display preferences (dark mode, time format, timezone) locally on your device.</li>
              <li><strong>Security cookies:</strong> Used to detect and prevent fraud and unauthorized access.</li>
            </ul>
            <p className="mt-3">
              We do not use tracking pixels, cross-site tracking, or advertising cookies. You can instruct
              your browser to refuse all cookies; however, some features of the Service may not function
              properly without cookies.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">7. Data Security</h2>
            <p>
              We implement industry-standard technical and organizational measures to protect your
              personal information, including:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Encrypted connections (HTTPS/TLS) for all data in transit</li>
              <li>Passwords stored using bcrypt hashing — never in plain text</li>
              <li>Row-level security (RLS) policies on our database ensuring users can only access data they are authorized to see</li>
              <li>Access controls limiting staff access to personal data on a need-to-know basis</li>
            </ul>
            <p className="mt-3">
              No system is completely secure. We cannot guarantee absolute security of your information.
              If you believe your account has been compromised, contact us immediately at{' '}
              <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">support@wdwshiftx.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">8. Data Retention</h2>
            <p>We retain your information for the following periods:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Account and profile data:</strong> Retained while your account is active and for up to 30 days after you request deletion or deactivate your account</li>
              <li><strong>Shift and request posts:</strong> Deleted immediately upon account deactivation; expired posts are archived for up to 90 days before permanent deletion</li>
              <li><strong>Server log files:</strong> Retained for up to 90 days</li>
              <li><strong>Support communications:</strong> Retained for up to 2 years after your last interaction</li>
            </ul>
            <p className="mt-3">
              Upon verified deletion, all personal data is permanently removed within 30 days.
              Anonymized, aggregated statistics (such as total post counts) that cannot be linked back
              to you may be retained indefinitely.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">9. Your Rights &amp; Choices</h2>
            <p>Regardless of where you live, you have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correct:</strong> Update inaccurate information through your Profile page or by contacting us</li>
              <li><strong>Delete:</strong> Request deletion of your account and personal data (see our <Link href="/data-deletion" className="text-primary hover:underline">Data Deletion page</Link>)</li>
              <li><strong>Opt out of email notifications:</strong> Adjust notification preferences in your profile settings</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">support@wdwshiftx.com</a>.
              We will respond within 30 days. We may need to verify your identity before processing your request.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">10. Children&apos;s Privacy</h2>
            <p>
              The Service is intended for users who are <strong>18 years of age or older</strong>.
              We do not knowingly collect personal information from anyone under 18. If we discover
              that a user under 18 has created an account, we will promptly delete their account and
              all associated data.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. When we make material changes, we will
              notify you by email to the address associated with your account before the changes take
              effect, and we will update the &ldquo;Last updated&rdquo; date at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">12. Contact Us</h2>
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy or our data
              practices, please contact us at{' '}
              <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">support@wdwshiftx.com</a>.
              We will respond to all privacy requests within 30 days.
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-border">
          <p className="text-xs text-text/40 text-center">
            WDWShiftX is operated by Digital Elegance LLC and is not affiliated with, sponsored by, or endorsed by any employer or organization whose employees may use the Service.
          </p>
        </div>
      </div>
    </div>
  )
}
