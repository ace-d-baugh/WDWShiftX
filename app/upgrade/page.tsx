import {
  ArrowRight, Check, X, Star, Clock, RefreshCw, Camera, ShieldCheck, Sparkles,
} from 'lucide-react'
import { AnimateIn } from '@/components/landing/AnimateIn'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { Footer } from '@/components/landing/Footer'
import { CheckoutButton } from '@/components/features/CheckoutButton'
import { createServerClient } from '@/lib/supabase/server'
import { getMembership, isProTier } from '@/lib/auth/session'
import { optionalServerEnv } from '@/lib/env'
import { PRO_PLANS, TIER_COMPARISON } from '@/lib/pricing'
import { THEMES } from '@/lib/theme'

export const metadata = {
  title: 'WDWShiftX Pro – Put Your Schedule on Autopilot',
  description:
    'Instant shift-match alerts, a live wall, unlimited photo schedule imports, calendar sync, 4 premium themes, and zero ads. Pro from $4/month.',
}

// The everyday frustrations Pro removes — the "reasons" half of the pitch.
const PAIN_POINTS = [
  {
    icon: Clock,
    title: 'The good shifts vanish in minutes',
    body:
      "Someone posts the exact Saturday you need — and by the time you check the Wall, it's spoken for. Pro emails you the moment a match drops, so you claim the shift while everyone else is still asleep.",
  },
  {
    icon: RefreshCw,
    title: 'Your thumb deserves a break',
    body:
      'Stop pulling down to refresh. Pro\'s Wall streams new posts in real time — offers just appear the second they\'re posted. No more "did I miss something?"',
  },
  {
    icon: Camera,
    title: 'Four imports a month disappears fast',
    body:
      "Once you've snapped a printed schedule instead of typing it out, you won't want to go back. Pro makes Photo Schedule Import unlimited — every schedule, every week, on your calendar in seconds.",
  },
  {
    icon: ShieldCheck,
    title: 'Zero ads. Zero clutter.',
    body:
      "You're here to fix your week, not scroll past banners. Pro removes every ad from every page — nothing between you and your next shift.",
  },
]

const FAQS = [
  {
    q: 'How does the free trial work?',
    a: "The Monthly plan starts with 14 days free. You enter a card up front so there's no interruption when the trial ends, but nothing is charged until day 15 — cancel any time before then and you pay nothing at all. Stripe emails you a reminder before the first charge. One trial per account.",
  },
  {
    q: 'Can I cancel anytime?',
    a: "Yes — two clicks in the billing portal, no phone calls, no guilt trips. You keep Pro until the end of the period you've paid for, then drop back to Basic automatically.",
  },
  {
    q: 'What happens to my boards and shifts if I go back to Basic?',
    a: 'Nothing is deleted — ever. Your boards, shifts, messages, and calendar all stay exactly as they are. Your account simply returns to the standard limits: 4 photo imports a month, manual Wall refreshing, and standard ads.',
  },
  {
    q: 'How do the 3-month, 6-month, and annual plans work?',
    a: "You're billed once per period — $13.99 every 3 months, $26.99 every 6, or $47.99 a year — and the plan renews automatically until you cancel. Longer periods are the same Pro, just cheaper per month.",
  },
  {
    q: 'Is my payment information safe?',
    a: 'Payments are handled entirely by Stripe, the same processor used by Amazon and Shopify. Your card number never touches WDWShiftX servers, and we never see it.',
  },
  {
    q: 'Is Pro per board or per account?',
    a: 'Per account — one Pro subscription covers you across every board you belong to, at every workplace.',
  },
]

export default async function UpgradePage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let displayName: string | null = null
  let alreadyPro = false
  if (user) {
    const [{ data: profile }, membership] = await Promise.all([
      supabase.from('users').select('display_name').eq('id', user.id).single(),
      getMembership(supabase),
    ])
    displayName = profile?.display_name ?? user.email ?? 'Account'
    alreadyPro = isProTier(membership)
  }

  // Checkout stays in "launching soon" mode until Stripe is configured —
  // the cards, copy, and comparison are real; only the buy button waits.
  const checkoutEnabled = Boolean(optionalServerEnv.STRIPE_SECRET_KEY)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LandingHeader displayName={displayName} />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-light via-background to-background pt-20 pb-16 px-4">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 h-[520px] w-[520px] rounded-full bg-primary/15 blur-3xl animate-blob" />
          <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-secondary/30 blur-3xl animate-blob" style={{ animationDelay: '3s' }} />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-2 text-sm font-medium mb-6">
              <Star className="w-4 h-4" />
              WDWShiftX Pro
            </span>
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            <h1 className="font-accent text-4xl md:text-6xl font-bold text-text mb-6 leading-tight">
              Stop Refreshing.{' '}
              <span className="text-primary relative inline-block">
                Start Swapping.
                <span
                  className="absolute -bottom-1 left-0 h-[3px] rounded-full bg-gradient-to-r from-primary via-secondary to-primary animate-expand-width"
                  style={{ animationDelay: '850ms' }}
                />
              </span>
            </h1>
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '320ms' }}>
            <p className="text-lg md:text-xl text-text/70 max-w-2xl mx-auto mb-8">
              Basic gets you on the board. Pro puts the board to work <em>for you</em> with
              instant match alerts, a live-updating Wall, and unlimited photo imports.{' '}
              <strong className="text-text">
                At less than the cost of a single coffee, picking up just one extra shift
                pays for the entire year.
              </strong>{' '}
              From <strong className="text-text">$4 a month</strong>.
            </p>
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '480ms' }}>
            <a href="#plans" className="btn btn-primary text-base px-8 py-3 min-h-0 h-12 gap-2 group inline-flex">
              See the Plans
              <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Pain points ── */}
      <section className="py-16 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <AnimateIn className="text-center mb-12">
            <h2 className="font-accent text-3xl md:text-4xl font-bold text-text mb-4">
              Sound Familiar?
            </h2>
            <p className="text-text/60 text-lg max-w-xl mx-auto">
              Four everyday frustrations. One upgrade.
            </p>
          </AnimateIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PAIN_POINTS.map((point, i) => (
              <AnimateIn key={point.title} delay={i * 90}>
                <div className="card border-l-4 border-l-primary h-full">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <point.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-accent text-lg font-bold text-text mb-2">{point.title}</h3>
                  <p className="text-text/60 text-sm leading-relaxed">{point.body}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing cards ── */}
      <section id="plans" className="py-16 px-4 bg-primary-light scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <AnimateIn className="text-center mb-12">
            <h2 className="font-accent text-3xl md:text-4xl font-bold text-text mb-4">
              Same Pro. Four Ways to Pay.
            </h2>
            <p className="text-text/60 text-lg max-w-xl mx-auto">
              Every plan unlocks everything. The only question is how much you&apos;d like to save.
            </p>
          </AnimateIn>

          {alreadyPro && (
            <AnimateIn className="mb-8">
              <div className="max-w-xl mx-auto text-center bg-success/30 border border-success/70 text-text rounded-xl px-5 py-4 text-sm font-medium">
                <Star className="w-4 h-4 inline -mt-0.5 mr-1.5" />
                You&apos;re already Pro — everything below is yours. Thank you for supporting WDWShiftX!
              </div>
            </AnimateIn>
          )}

          {/* Premium themes perk */}
          <AnimateIn className="mb-10">
            <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-2 text-sm text-text/70">
              <span className="font-medium text-text">Plus, make it yours — 4 premium themes:</span>
              {THEMES.filter(t => t.pro).map(t => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-text"
                  title={t.description}
                >
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/10"
                    style={{ backgroundColor: t.preview.bg }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.preview.accent }} />
                  </span>
                  {t.label}
                </span>
              ))}
            </div>
          </AnimateIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {PRO_PLANS.map((plan, i) => (
              <AnimateIn key={plan.key} delay={i * 90} className="h-full">
                <div
                  className={`card h-full flex flex-col relative ${
                    plan.featured
                      ? 'border-2 border-primary shadow-lg lg:-translate-y-2'
                      : 'border border-border'
                  }`}
                >
                  {plan.badge && (
                    <span
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide rounded-full px-3 py-1 ${
                        plan.featured ? 'bg-primary text-white' : 'bg-secondary text-text'
                      }`}
                    >
                      {plan.badge}
                    </span>
                  )}
                  <h3 className="font-accent text-lg font-bold text-text mt-2">{plan.name}</h3>
                  <p className="text-xs text-text/50 mb-4">{plan.hook}</p>
                  <div className="mb-1">
                    <span className="font-accent text-4xl font-bold text-text">{plan.perMonth}</span>
                    <span className="text-text/50 text-sm">/mo</span>
                  </div>
                  {plan.trialDays && !alreadyPro && (
                    <p className="text-xs font-medium text-success mb-2">
                      Start with {plan.trialDays} days free
                    </p>
                  )}
                  <p className="text-xs text-text/50 mb-6 flex-1">{plan.finePrint}</p>
                  {checkoutEnabled ? (
                    <CheckoutButton
                      planKey={plan.key}
                      loggedIn={Boolean(user)}
                      featured={plan.featured}
                      label={
                        plan.trialDays && !alreadyPro
                          ? 'Start Free Trial'
                          : `Go Pro${plan.name === 'Monthly' ? '' : ` · ${plan.name}`}`
                      }
                    />
                  ) : (
                    <button
                      disabled
                      className="btn btn-outline w-full opacity-50 cursor-not-allowed"
                      title="Pro subscriptions open at launch"
                    >
                      Launching Soon
                    </button>
                  )}
                </div>
              </AnimateIn>
            ))}
          </div>

          <AnimateIn className="text-center mt-8">
            <p className="text-xs text-text/50">
              Prices in USD. Cancel anytime — you keep Pro through the period you&apos;ve paid for.
              {!checkoutEnabled && ' Subscriptions open at launch.'}
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* ── Comparison table ── */}
      <section className="py-16 px-4 bg-background">
        <div className="max-w-3xl mx-auto">
          <AnimateIn className="text-center mb-12">
            <h2 className="font-accent text-3xl md:text-4xl font-bold text-text mb-4">
              Basic vs Pro, Side by Side
            </h2>
            <p className="text-text/60 text-lg">
              Basic is genuinely useful. Pro is genuinely effortless.
            </p>
          </AnimateIn>
          <AnimateIn>
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-primary-light/40">
                    <th className="text-left px-5 py-3 font-medium text-text">Feature</th>
                    <th className="px-4 py-3 font-medium text-text/70 w-28">Basic</th>
                    <th className="px-4 py-3 font-accent font-bold text-primary w-28">Pro ⭐</th>
                  </tr>
                </thead>
                <tbody>
                  {TIER_COMPARISON.map(row => (
                    <tr key={row.feature} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 text-text/80">
                        {row.feature}
                        {row.comingSoon && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            Pro Preview
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {typeof row.basic === 'boolean' ? (
                          row.basic
                            ? <Check className="w-4 h-4 text-success inline" aria-label="Included" />
                            : <X className="w-4 h-4 text-text/25 inline" aria-label="Not included" />
                        ) : (
                          <span className="text-text/60 text-xs">{row.basic}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center bg-primary-light/20">
                        {typeof row.pro === 'boolean' ? (
                          row.pro
                            ? <Check className="w-4 h-4 text-success inline" aria-label="Included" />
                            : <X className="w-4 h-4 text-text/25 inline" aria-label="Not included" />
                        ) : (
                          <span className="text-text font-medium text-xs">{row.pro}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 px-4 bg-primary-light">
        <div className="max-w-2xl mx-auto">
          <AnimateIn className="text-center mb-10">
            <h2 className="font-accent text-3xl font-bold text-text mb-3">Fair Questions</h2>
            <p className="text-text/60">The stuff you&apos;d want to know before paying anyone anything.</p>
          </AnimateIn>
          <AnimateIn>
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
              {FAQS.map(faq => (
                <details key={faq.q} className="group">
                  <summary className="flex items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-text cursor-pointer list-none hover:bg-primary-light/30 transition-colors">
                    {faq.q}
                    <Sparkles className="w-4 h-4 text-text/30 shrink-0 group-open:text-primary transition-colors" />
                  </summary>
                  <p className="px-5 pb-5 text-sm text-text/70 leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="relative overflow-hidden py-20 px-4 bg-primary">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 right-1/4 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-blob" />
          <div className="absolute -bottom-20 left-1/4 h-48 w-48 rounded-full bg-white/5 blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <AnimateIn>
            <h2 className="font-accent text-3xl md:text-4xl font-bold text-white mb-4">
              Your Next Shift Trade Could Take Ten Seconds
            </h2>
            <p className="text-white/80 text-lg mb-8">
              For the price of one coffee a month, WDWShiftX watches the board so you don&apos;t have to.
            </p>
            <a
              href="#plans"
              className="inline-flex items-center gap-2 bg-white text-primary font-bold rounded-md px-8 py-3 text-base hover:bg-white/90 hover:scale-105 transition-all duration-200 group"
            >
              Pick Your Plan
              <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
            </a>
          </AnimateIn>
        </div>
      </section>

      <Footer />
    </div>
  )
}
