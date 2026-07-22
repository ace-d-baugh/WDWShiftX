'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

// Tied to the same env var that gates the AdSense script itself (Task 12),
// rather than a separate hardcoded flag, so the two can't drift out of sync.
// Before AdSense, the only cookies WDWShiftX set were Supabase Auth session
// cookies — "strictly necessary" and exempt from consent requirements under
// GDPR/ePrivacy and CCPA — so there was nothing to ask consent for.
const COOKIE_BANNER_ENABLED = Boolean(process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID)

const STORAGE_KEY = 'wdwshiftx-cookie-consent'

function isGoogleCmpRegion(): boolean {
  return document.cookie.split('; ').some(c => c === 'wdwshiftx-region=eea' || c === 'wdwshiftx-region=us')
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!COOKIE_BANNER_ENABLED) return
    // Google's ad-consent CMP handles EEA/UK/CH and U.S. visitors instead —
    // showing both would mean two consent prompts for the same person.
    if (isGoogleCmpRegion()) return
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  const respond = (choice: 'accepted' | 'declined') => {
    try { localStorage.setItem(STORAGE_KEY, choice) } catch {}
    setVisible(false)
  }

  if (!COOKIE_BANNER_ENABLED || !visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] bg-card border-t border-border shadow-lg animate-slide-up">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
        <p className="text-sm text-text/70 flex-1">
          We use cookies to keep you signed in and, for Basic-tier users, to show ads. See our{' '}
          <Link href="/privacy" className="text-primary underline hover:text-primary/70">Privacy Policy</Link> for details.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => respond('declined')}>Decline</Button>
          <Button variant="primary" size="sm" onClick={() => respond('accepted')}>Accept All</Button>
        </div>
      </div>
    </div>
  )
}
