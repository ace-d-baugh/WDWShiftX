import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Privacy Policy – WDWShiftX' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text/60 hover:text-text mb-8 min-h-0 min-w-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="font-accent text-3xl font-bold text-text mb-2">Privacy Policy</h1>
        <p className="text-text/50 text-sm mb-8">Last updated: January 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-text/80">
          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Account info:</strong> Display name, email address, password (hashed)</li>
              <li><strong>Profile info:</strong> Phone number (optional), notification preferences</li>
              <li><strong>Shift data:</strong> Shifts and requests you post on the board</li>
              <li><strong>Proficiencies:</strong> Work locations and roles you specify</li>
            </ul>
            <p className="mt-3"><strong>We never store your HubID or PERNER.</strong> These are used only for in-browser format verification during registration and are discarded immediately.</p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>To provide and operate the shift trading service</li>
              <li>To display your posts to other verified Cast Members</li>
              <li>To send notifications (if enabled) about relevant shifts</li>
              <li>To moderate the platform and enforce our Terms of Service</li>
              <li>To improve the service based on usage patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">3. Information Sharing</h2>
            <p>We do not sell, trade, or rent your personal information. Your display name and shift posts are visible to other registered Cast Members. We may share information with:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Service providers (Supabase for database hosting)</li>
              <li>Law enforcement when required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">4. Data Security</h2>
            <p>We implement industry-standard security measures including encrypted connections (HTTPS), password hashing, and row-level security policies. However, no system is completely secure.</p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">5. Data Retention</h2>
            <p>We retain your account data while your account is active. Deactivated accounts are soft-deleted (is_active = false). Expired shift posts are archived. You may request complete data deletion by contacting us.</p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Opt out of notifications at any time in your profile settings</li>
            </ul>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">7. Cookies</h2>
            <p>We use session cookies to keep you logged in. No third-party tracking cookies are used.</p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">8. Changes to Privacy Policy</h2>
            <p>We may update this policy periodically. Significant changes will be communicated to registered users.</p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-border">
          <p className="text-xs text-text/40 text-center">
            WDWShiftX is not affiliated with, authorized by, endorsed by, or in any way officially connected with The Walt Disney Company.
          </p>
        </div>
      </div>
    </div>
  )
}
