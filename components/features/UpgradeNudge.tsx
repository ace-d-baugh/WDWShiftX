'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, X } from 'lucide-react'

const DISMISS_KEY = 'wdwshiftx-upgrade-nudge-dismissed'

/**
 * Soft upsell banner for Basic members — render only for the Basic tier.
 * Dismissal sticks for the browser session (sessionStorage), so it reappears
 * next visit without nagging within one.
 */
export function UpgradeNudge() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // sessionStorage isn't available during SSR — decide visibility on mount.
    try {
      setVisible(!sessionStorage.getItem(DISMISS_KEY))
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ }
  }

  return (
    <div className="mb-4 p-3 rounded-md bg-gradient-to-r from-primary/10 to-secondary/20 border border-primary/20 text-sm flex items-center justify-between gap-3">
      <p className="text-text/80 leading-snug">
        <Star className="w-4 h-4 text-primary inline -mt-0.5 mr-1" />
        <strong className="text-text">Pro</strong> gets you instant match alerts, a live Wall,
        unlimited photo imports, and zero ads — from <strong className="text-text">$4/mo</strong>.{' '}
        <Link href="/upgrade" className="text-primary font-medium underline min-h-0 min-w-0">
          See the plans
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="p-1 text-text/40 hover:text-text shrink-0 min-h-0 min-w-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
