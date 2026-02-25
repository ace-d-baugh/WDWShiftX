import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, RefreshCw, Gift, Clock, Shield, Users, Zap } from 'lucide-react'

export const metadata = {
  title: 'WDWShiftX – Shift Trading for Disney Cast Members',
  description: 'The smarter way for Disney Cast Members to trade, giveaway, and request shifts. Fast, safe, and built for the magic.',
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/logos/ShiftX-new.svg"
              alt="WDWShiftX Logo"
              width={120}
              height={40}
              priority
              className="h-10 w-auto"
            />
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="btn btn-outline text-sm px-4 py-2 min-h-0 h-10"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="btn btn-primary text-sm px-4 py-2 min-h-0 h-10"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-light via-white to-white pt-20 pb-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-2 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            Built for Disney Cast Members
          </div>
          <h1 className="font-accent text-4xl md:text-6xl font-bold text-text mb-6 leading-tight">
            Shift Trading,{' '}
            <span className="text-primary">Made Magical</span>
          </h1>
          <p className="text-lg md:text-xl text-text/70 max-w-2xl mx-auto mb-10">
            WDWShiftX is the fast, safe, and CM-verified platform for trading, giving away,
            and requesting shifts at Walt Disney World. No more group chat chaos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="btn btn-primary text-base px-8 py-3 min-h-0 h-12 gap-2"
            >
              Start Trading Shifts <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="btn btn-outline text-base px-8 py-3 min-h-0 h-12"
            >
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-accent text-3xl md:text-4xl font-bold text-text mb-4">
              Everything You Need
            </h2>
            <p className="text-text/60 text-lg max-w-xl mx-auto">
              A complete shift management solution designed specifically for Cast Members.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature: Shift Board */}
            <div className="card border-l-4 border-l-primary hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <RefreshCw className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-accent text-xl font-bold text-text mb-2">Shift Trading Board</h3>
              <p className="text-text/60 text-sm leading-relaxed">
                Browse and post shift offers in real-time. Filter by property, location, and role.
                Trades and giveaways clearly labeled.
              </p>
            </div>
            {/* Feature: Request Board */}
            <div className="card border-l-4 border-l-info hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center mb-4">
                <Gift className="w-5 h-5 text-info" />
              </div>
              <h3 className="font-accent text-xl font-bold text-text mb-2">Request Board</h3>
              <p className="text-text/60 text-sm leading-relaxed">
                Need a specific date off? Post a shift request and let other CMs reach out.
                Set preferred morning, afternoon, evening, or late time blocks.
              </p>
            </div>
            {/* Feature: Smart Filtering */}
            <div className="card border-l-4 border-l-success hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-success" />
              </div>
              <h3 className="font-accent text-xl font-bold text-text mb-2">Smart Filtering</h3>
              <p className="text-text/60 text-sm leading-relaxed">
                Filter shifts by your proficiency locations and roles. Only see what&apos;s relevant
                to you across all six Disney World properties.
              </p>
            </div>
            {/* Feature: Auto Expiry */}
            <div className="card border-l-4 border-l-accent hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
                <Clock className="w-5 h-5 text-text" />
              </div>
              <h3 className="font-accent text-xl font-bold text-text mb-2">Auto-Expiry</h3>
              <p className="text-text/60 text-sm leading-relaxed">
                Shift posts automatically expire 30 minutes before the shift starts.
                Request posts expire at end of day. No stale listings.
              </p>
            </div>
            {/* Feature: CM Verification */}
            <div className="card border-l-4 border-l-warning hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-warning" />
              </div>
              <h3 className="font-accent text-xl font-bold text-text mb-2">CM Verification</h3>
              <p className="text-text/60 text-sm leading-relaxed">
                HubID and PERNER verified at registration — never stored. Only real
                Cast Members can access the platform.
              </p>
            </div>
            {/* Feature: Community */}
            <div className="card border-l-4 border-l-secondary hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-secondary/30 flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-accent text-xl font-bold text-text mb-2">CM Community</h3>
              <p className="text-text/60 text-sm leading-relaxed">
                Built for CMs, by CMs. Leader oversight, flagging system, and moderation
                tools keep the board clean and trustworthy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Properties */}
      <section className="py-16 px-4 bg-primary-light">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-accent text-2xl md:text-3xl font-bold text-text mb-3">
            All Six Properties Covered
          </h2>
          <p className="text-text/60 mb-8">Find shifts across every park and resort area.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Magic Kingdom', 'EPCOT', 'Hollywood Studios', 'Animal Kingdom', 'Disney Springs', 'Resorts'].map((p) => (
              <span
                key={p}
                className="bg-white border border-primary/20 text-text rounded-full px-5 py-2 text-sm font-medium shadow-sm"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-accent text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Simplify Your Schedule?
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Join the WDWShiftX community today. Free for all Cast Members.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-white text-primary font-bold rounded-md px-8 py-3 text-base hover:bg-white/90 transition-colors"
          >
            Create Your Account <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-text text-white/60 py-8 px-4 mt-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Image
              src="/logos/ShiftX-new.svg"
              alt="WDWShiftX"
              width={100}
              height={32}
              className="h-8 w-auto brightness-0 invert opacity-60"
            />
            <div className="flex gap-6 text-sm">
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/login" className="hover:text-white transition-colors">Log In</Link>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-white/10 text-xs text-center text-white/40">
            <p>
              WDWShiftX is not affiliated with, authorized by, endorsed by, or in any way officially
              connected with The Walt Disney Company, Disney Enterprises, Inc., or any of its
              subsidiaries or affiliates. All Disney trademarks and intellectual property are
              property of their respective owners.
            </p>
            <p className="mt-2">© {new Date().getFullYear()} WDWShiftX. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
