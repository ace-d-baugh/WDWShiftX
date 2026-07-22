import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { getPublicShowAds } from '@/lib/auth/session'
import { AdRail } from '@/components/features/AdRail'

export const metadata = { title: 'Privacy Policy' }

export default async function PrivacyPage() {
  const showAds = await getPublicShowAds(createServerClient())

  return (
    <AdRail showAds={showAds} hasBottomNav={false}>
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text/60 hover:text-text mb-8 min-h-0 min-w-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="font-accent text-3xl font-bold text-text mb-2">Privacy Policy</h1>
        <p className="text-text/50 text-sm mb-8">Last updated: June 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-text/80">

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">1. Introduction &amp; Data Controller</h2>
            <p>
              This Privacy Policy explains how Digital Elegance LLC d/b/a WDWShiftX (&ldquo;WDWShiftX,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and shares information about you
              when you use our shift coordination platform (&ldquo;the Service&rdquo;).
            </p>
            <p className="mt-3">
              Digital Elegance LLC is the data controller responsible for your personal information.
              If you have questions or requests regarding your privacy, contact us at{' '}
              <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">support@wdwshiftx.com</a>.
            </p>
            <p className="mt-3">
              By using the Service, you agree to the collection and use of information in accordance
              with this Policy. If you do not agree, please do not use the Service.
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
              <li><strong>Payment information:</strong> Billing details collected by Stripe when you subscribe to Pro (we do not store full card numbers — see Section 8)</li>
              <li><strong>OAuth information:</strong> If you sign in via Google, Facebook, or LinkedIn, we receive your name and email address from that provider</li>
              <li><strong>Support communications:</strong> Messages you send to our support team</li>
            </ul>

            <h3 className="font-semibold text-text mt-4 mb-2">B. Information Collected Automatically</h3>
            <p>When you use the Service, we and our service providers automatically collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Log data:</strong> IP address, browser type and version, pages visited, timestamps, referring URLs, and error logs</li>
              <li><strong>Device information:</strong> Device type, operating system, and browser settings</li>
              <li><strong>Usage data:</strong> Features you use, actions you take, and time spent on the Service</li>
              <li><strong>Cookies and similar technologies:</strong> Session identifiers and functional cookies needed to keep you logged in (see Section 7)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">3. How We Use Your Information</h2>
            <p>We use your information for the following purposes:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>To create and manage your account and provide the Service</li>
              <li>To display your shift posts and profile information to other approved members of your boards</li>
              <li>To send transactional emails (email verification, password reset, shift match alerts, board approval notifications)</li>
              <li>To send SMS notifications if you have opted in as a Pro member</li>
              <li>To process subscription payments and manage your billing</li>
              <li>To moderate the platform, investigate reports, and enforce our Terms of Service</li>
              <li>To detect, prevent, and respond to fraud, abuse, and security incidents</li>
              <li>To improve and develop the Service based on aggregated, anonymized usage patterns</li>
              <li>To respond to your support requests and communications</li>
              <li>To comply with our legal obligations</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> use your information for external advertising, sell it to data
              brokers, or share it for third-party marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">4. Legal Basis for Processing (GDPR)</h2>
            <p>
              If you are located in the European Economic Area (EEA) or United Kingdom, we process your
              personal data under the following legal bases:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Contract:</strong> Processing necessary to provide the Service you have registered for (account management, shift coordination, billing)</li>
              <li><strong>Legitimate interests:</strong> Fraud prevention, security, platform integrity, and improving the Service — where our interests do not override your rights</li>
              <li><strong>Consent:</strong> SMS notifications and any optional marketing communications — you may withdraw consent at any time</li>
              <li><strong>Legal obligation:</strong> Where we must process data to comply with applicable law or respond to valid legal process</li>
            </ul>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">5. Information Sharing &amp; Disclosure</h2>
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
              maintain appropriate security. See Section 6 for a full list.
            </p>

            <h3 className="font-semibold text-text mt-4 mb-2">Legal Requirements</h3>
            <p className="mt-2">
              We may disclose your information if required to do so by law, subpoena, court order, or
              other governmental authority, or if we believe in good faith that disclosure is necessary
              to protect the rights, property, or safety of WDWShiftX, our users, or the public.
            </p>

            <h3 className="font-semibold text-text mt-4 mb-2">Business Transfers</h3>
            <p className="mt-2">
              In the event of a merger, acquisition, sale of assets, or bankruptcy, your information
              may be transferred as part of that transaction. We will notify you via email before your
              information is transferred and becomes subject to a different privacy policy.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">6. Third-Party Service Providers</h2>
            <p>We use the following third-party services. Each processes your data in accordance with their own privacy policies:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Supabase</strong> (supabase.com) — database hosting, authentication, and real-time data sync. Data stored on AWS infrastructure in the United States.</li>
              <li><strong>Vercel</strong> (vercel.com) — application hosting and global content delivery.</li>
              <li><strong>Stripe</strong> (stripe.com) — payment processing for Pro subscriptions. Stripe is PCI-DSS compliant. We never see or store your full card number.</li>
              <li><strong>Resend / Amazon SES</strong> (resend.com) — transactional email delivery (verification, password reset, shift notifications).</li>
              <li><strong>Twilio</strong> (twilio.com) — SMS delivery for Pro tier match notifications. Your phone number is shared with Twilio only if you opt in to SMS.</li>
              <li><strong>Google</strong> (google.com) — optional OAuth sign-in. If used, Google shares your name and email with us.</li>
              <li><strong>Facebook / Meta</strong> (meta.com) — optional OAuth sign-in. If used, Meta shares your name and email with us.</li>
              <li><strong>LinkedIn</strong> (linkedin.com) — optional OAuth sign-in. If used, LinkedIn shares your name and email with us.</li>
              <li><strong>Google AdSense</strong> (google.com/adsense) — advertising shown to Basic (free) tier users. AdSense may set cookies and collect usage data for ad personalization. Pro members do not see ads and are not subject to AdSense data collection.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">7. Cookies &amp; Tracking Technologies</h2>
            <p>We use the following types of cookies and similar technologies:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Session cookies:</strong> Required to keep you logged in while you use the Service. These are deleted when you close your browser or log out.</li>
              <li><strong>Preference cookies:</strong> Store your display preferences (dark mode, time format, timezone) locally on your device.</li>
              <li><strong>Security cookies:</strong> Used to detect and prevent fraud and unauthorized access.</li>
              <li><strong>Third-party cookies (Basic tier only):</strong> Google AdSense may set cookies for ad personalization. You can manage these through our cookie consent banner or your browser settings.</li>
            </ul>
            <p className="mt-3">
              We do not use tracking pixels, cross-site tracking, or behavioral advertising cookies for
              our own marketing. You can instruct your browser to refuse all cookies or to indicate when
              a cookie is being sent; however, some features of the Service may not function properly
              without cookies.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">8. Payment Information</h2>
            <p>
              All payment processing is handled by <strong>Stripe</strong>, a PCI-DSS Level 1 certified
              payment processor. When you subscribe to Pro, your payment card details are entered
              directly into Stripe&apos;s secure environment. We do not receive, transmit, or store your
              full card number, CVV, or banking credentials.
            </p>
            <p className="mt-3">
              We retain records of your subscription status, billing cycle, and transaction amounts for
              accounting and customer support purposes. These records are retained for 7 years to comply
              with tax and financial record-keeping requirements.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">9. SMS &amp; Email Communications</h2>

            <h3 className="font-semibold text-text mt-4 mb-2">Transactional Emails</h3>
            <p>
              We send transactional emails as part of operating the Service, including email address
              verification, password reset, board approval notifications, shift match alerts (Pro tier),
              and billing receipts. These emails are necessary for the Service and cannot be opted out
              of while your account is active.
            </p>

            <h3 className="font-semibold text-text mt-4 mb-2">SMS Notifications (Pro Tier)</h3>
            <p className="mt-2">
              If you are a Pro member and opt in to SMS notifications, your phone number is shared with
              Twilio to deliver shift match alerts. You may opt out at any time by replying STOP to any
              message or by disabling SMS in your profile settings. Up to 30 messages per month may be
              sent. Message and data rates may apply.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">10. Data Security</h2>
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
            <p className="mt-3">
              <strong>Data Breach Notification:</strong> In the event of a data breach that is likely
              to result in a risk to your rights and freedoms, we will notify affected users and
              applicable regulators within the timeframes required by applicable law (72 hours under
              GDPR; as soon as reasonably practicable under US state laws).
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">11. Data Retention</h2>
            <p>We retain your information for the following periods:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Account and profile data:</strong> Retained while your account is active and for up to 30 days after you request deletion or deactivate your account</li>
              <li><strong>Shift and request posts:</strong> Deleted immediately upon account deactivation; expired posts are archived for up to 90 days before permanent deletion</li>
              <li><strong>Payment and transaction records:</strong> Retained for 7 years to comply with tax and financial record-keeping obligations</li>
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
            <h2 className="font-accent text-xl font-bold text-text mb-3">12. Your Rights &amp; Choices</h2>

            <h3 className="font-semibold text-text mt-4 mb-2">All Users</h3>
            <p>Regardless of where you live, you have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correct:</strong> Update inaccurate information through your Profile page or by contacting us</li>
              <li><strong>Delete:</strong> Request deletion of your account and personal data (see our <Link href="/data-deletion" className="text-primary hover:underline">Data Deletion page</Link>)</li>
              <li><strong>Opt out of SMS:</strong> Reply STOP to any text message or disable in your profile settings</li>
              <li><strong>Opt out of email notifications:</strong> Adjust notification preferences in your profile settings</li>
            </ul>

            <h3 className="font-semibold text-text mt-4 mb-2">California Residents (CCPA)</h3>
            <p className="mt-2">California residents have additional rights under the California Consumer Privacy Act:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Right to Know:</strong> The categories and specific pieces of personal information we collect, use, disclose, and sell (we do not sell personal information)</li>
              <li><strong>Right to Delete:</strong> Request deletion of personal information we have collected from you, subject to certain exceptions</li>
              <li><strong>Right to Opt-Out of Sale:</strong> We do not sell personal information, so no opt-out is required</li>
              <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your CCPA rights</li>
              <li><strong>Shine the Light:</strong> California Civil Code Section 1798.83 permits California residents to request information about our disclosure of personal information to third parties for their direct marketing purposes. We do not share personal information for third-party direct marketing.</li>
            </ul>

            <h3 className="font-semibold text-text mt-4 mb-2">EEA &amp; UK Residents (GDPR / UK GDPR)</h3>
            <p className="mt-2">If you are located in the European Economic Area or United Kingdom, you also have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Data portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong>Restrict processing:</strong> Request that we limit how we use your data in certain circumstances</li>
              <li><strong>Object:</strong> Object to processing based on legitimate interests</li>
              <li><strong>Withdraw consent:</strong> Where processing is based on consent, withdraw it at any time without affecting prior processing</li>
              <li><strong>Lodge a complaint:</strong> File a complaint with your local data protection authority (DPA)</li>
            </ul>

            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">support@wdwshiftx.com</a>.
              We will respond within 30 days (or 45 days for complex requests). We may need to verify
              your identity before processing your request.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">13. Children&apos;s Privacy</h2>
            <p>
              The Service is intended for users who are <strong>18 years of age or older</strong>.
              We do not knowingly collect personal information from anyone under 18. If we discover
              that a user under 18 has created an account, we will promptly delete their account and
              all associated data. If you believe a minor has provided us with personal information,
              please contact us at{' '}
              <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">support@wdwshiftx.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">14. International Data Transfers</h2>
            <p>
              WDWShiftX is operated from the United States. If you access the Service from outside the
              United States, your information will be transferred to and processed in the United States,
              where data protection laws may differ from those in your country.
            </p>
            <p className="mt-3">
              Our key infrastructure providers (Supabase on AWS, Vercel) store data primarily in the
              United States. By using the Service, you consent to the transfer of your information to
              the United States. Where required by law (such as GDPR), we rely on appropriate transfer
              mechanisms including Standard Contractual Clauses (SCCs).
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">15. Do Not Track</h2>
            <p>
              Some browsers send &ldquo;Do Not Track&rdquo; (DNT) signals to websites. Because there is no
              industry-standard interpretation of DNT signals, we do not currently alter our data
              collection practices in response to DNT signals. However, we do not engage in cross-site
              behavioral tracking.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">16. Third-Party Links</h2>
            <p>
              The Service may contain links to third-party websites. We are not responsible for the
              privacy practices or content of those sites. We encourage you to review the privacy
              policies of any third-party site you visit.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">17. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. When we make material changes, we will
              notify you by email to the address associated with your account at least 14 days before
              the changes take effect, and we will update the &ldquo;Last updated&rdquo; date at the top of
              this page.
            </p>
            <p className="mt-3">
              Your continued use of the Service after the effective date of any update constitutes your
              acceptance of the updated Policy. We encourage you to review this Policy periodically.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">18. Contact Us</h2>
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy or our data
              practices, please contact us:
            </p>
            <ul className="list-none mt-3 space-y-1">
              <li><strong>Privacy inquiries:</strong> <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">support@wdwshiftx.com</a></li>
              <li><strong>DMCA / Copyright:</strong> <a href="mailto:dmca@wdwshiftx.com" className="text-primary hover:underline">dmca@wdwshiftx.com</a></li>
              <li><strong>Company:</strong> Digital Elegance LLC d/b/a WDWShiftX</li>
            </ul>
            <p className="mt-3">
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
    </AdRail>
  )
}
