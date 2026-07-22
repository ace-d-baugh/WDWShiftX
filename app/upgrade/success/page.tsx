import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Check, Star } from 'lucide-react'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { Footer } from '@/components/landing/Footer'
import { createServerClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/auth/session'

export const metadata = {
  title: "Welcome to Pro – WDWShiftX",
  robots: { index: false, follow: false },
}

// Stripe redirects here after checkout. The webhook is what actually grants
// Pro, and it can land a beat after this page renders — so this page never
// asserts the upgrade is finished, it reports whatever the DB currently says.
export const dynamic = 'force-dynamic'

const PERKS = [
  'Instant match alerts the moment a shift fits your request',
  'A live Wall — new posts appear without refreshing',
  'Unlimited photo schedule imports',
  'Calendar sync with Google, Apple, and Outlook',
  'Four premium themes',
  'Every ad, gone',
]

export default async function UpgradeSuccessPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/upgrade/success')

  const [{ data: profile }, membership] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', user.id).single(),
    getMembership(supabase),
  ])

  const isTrial = membership.tier === 'Trial'
  const active = membership.tier === 'Pro' || isTrial

  const trialEnds = membership.trialEndsAt
    ? new Date(membership.trialEndsAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LandingHeader displayName={profile?.display_name ?? user.email ?? 'Account'} />

      <section className="flex-1 px-4 py-20">
        <div className="max-w-xl mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
            <Star className="w-8 h-8 text-success" />
          </div>

          <h1 className="font-accent text-3xl md:text-4xl font-bold text-text mb-4">
            {active
              ? isTrial
                ? "Your free trial is live 🎉"
                : "You're Pro. Welcome aboard 🎉"
              : 'Payment received — finishing up'}
          </h1>

          <p className="text-text/70 mb-8">
            {active ? (
              <>
                Thanks for supporting WDWShiftX
                {profile?.display_name ? `, ${profile.display_name}` : ''}. Everything below is
                switched on right now.
                {isTrial && trialEnds && (
                  <>
                    {' '}
                    Your trial runs through <strong className="text-text">{trialEnds}</strong>, and
                    your first payment happens the day after. Cancel any time before then and you
                    won&apos;t be charged.
                  </>
                )}
              </>
            ) : (
              <>
                Stripe has your payment. Your account can take a few seconds to flip over — refresh
                this page shortly, or check your profile. If it still looks wrong in a few minutes,
                email us and we&apos;ll sort it immediately.
              </>
            )}
          </p>

          {active && (
            <ul className="text-left inline-block mb-10 space-y-2">
              {PERKS.map(perk => (
                <li key={perk} className="flex items-start gap-2.5 text-sm text-text/80">
                  <Check className="w-4 h-4 text-success shrink-0 mt-0.5" aria-hidden="true" />
                  {perk}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/wall" className="btn btn-primary gap-2 group">
              Go to The Wall
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link href="/profile#membership" className="btn btn-outline">
              View Membership
            </Link>
          </div>

          <p className="text-xs text-text/50 mt-8">
            A receipt is on its way to your email. You can download invoices any time from{' '}
            <Link href="/profile#membership" className="underline hover:text-text">
              Manage Billing
            </Link>
            .
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
