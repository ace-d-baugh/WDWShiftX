import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { getPublicShowAds } from '@/lib/auth/session'
import { AdRail } from '@/components/features/AdRail'
import { INDUSTRIES } from '@/lib/landing/industries'

export const metadata = { title: 'About Us' }

export default async function AboutPage() {
  const showAds = await getPublicShowAds(createServerClient())

  return (
    <AdRail showAds={showAds} hasBottomNav={false}>
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text/60 hover:text-text mb-8 min-h-0 min-w-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="font-accent text-3xl font-bold text-text mb-2">About WDWShiftX</h1>
        <p className="text-text/50 text-sm mb-8">The shift trading board built for shift workers.</p>

        <div className="space-y-6 text-text/80 text-sm leading-relaxed">

          <section className="card shadow-sm">
            <h2 className="font-accent text-xl font-bold text-text mb-3">What we do</h2>
            <p>
              WDWShiftX replaces the messy, chaotic ways hourly teams swap shifts. Instead of
              tracking trades across fragmented group chats, buried text threads, or paper
              sign-up sheets in a breakroom, we give teams a dedicated, searchable board to
              organize their schedules — post a shift you need covered, request one you want
              to pick up, and keep it all on one calendar.
            </p>
          </section>

          <section className="card shadow-sm">
            <h2 className="font-accent text-xl font-bold text-text mb-3">Why we built it</h2>
            <p>
              Shift work requires constant flexibility. People need to pick up extra hours,
              cover for unexpected life events, and balance school or family. But when
              coordination happens via screenshots of paper schedules texted back and forth,
              things get missed. We built WDWShiftX because managing your livelihood
              shouldn&apos;t feel like a second job. Your schedule should just work.
            </p>
          </section>

          <section className="card shadow-sm">
            <h2 className="font-accent text-xl font-bold text-text mb-3">How it works</h2>
            <p>
              Anyone can spin up a board for their specific team, location, or department in
              seconds and share a secure invite code with their co-workers — no manager
              sign-off, no IT ticket. Once your team is in, anyone can post an offer, claim a
              shift, or coordinate directly on the Wall. Built-in moderation tools keep board
              admins in control of who joins and what gets posted, so the board stays as
              trustworthy as the people on it.
            </p>
          </section>

          <section className="card shadow-sm">
            <h2 className="font-accent text-xl font-bold text-text mb-3">Built for teams in:</h2>
            <div className="flex flex-wrap gap-3">
              {INDUSTRIES.map(industry => (
                <Link
                  key={industry.slug}
                  href={`/for/${industry.slug}`}
                  className="inline-block bg-background border border-primary/20 text-text rounded-full px-4 py-1.5 text-sm font-medium hover:border-primary/50 hover:shadow-sm transition-all duration-200 min-h-0 min-w-0"
                >
                  {industry.shortName}
                </Link>
              ))}
            </div>
            <p className="mt-4 text-text/60">
              …and any other workplace that runs on fixed shifts. If yours isn&apos;t listed,
              it still works — boards are workplace-agnostic.
            </p>
          </section>

          <section className="card shadow-sm">
            <h2 className="font-accent text-xl font-bold text-text mb-3">Who&apos;s behind WDWShiftX</h2>
            <p>
              WDWShiftX is operated by Digital Elegance LLC, a Florida-based company. WDWShiftX is an
              independent platform — it is not affiliated with, sponsored by, or endorsed by any
              specific employer, and all trademarks referenced on this site are the property of
              their respective owners.
            </p>
            <p className="mt-3">
              Have a question, feedback, or a workplace you&apos;d like to see supported? Visit our{' '}
              <Link href="/contact" className="text-primary hover:underline">Contact page</Link>.
            </p>
          </section>

          {/* CTA */}
          <section className="rounded-xl bg-primary text-center px-6 py-10">
            <h2 className="font-accent text-2xl font-bold text-white mb-2">
              Ready to fix your team&apos;s schedule?
            </h2>
            <p className="text-white/80 mb-6">
              Create a board for your workplace in under two minutes.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-white text-primary font-bold rounded-md px-8 py-3 text-base hover:bg-white/90 hover:scale-105 transition-all duration-200 group min-h-0"
            >
              Get Started
              <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </section>

        </div>
      </div>
    </div>
    </AdRail>
  )
}
