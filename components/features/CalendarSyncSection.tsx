'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Copy, Check, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getIcalFeedToken, resetIcalFeedToken } from '@/app/actions/calendar'

/**
 * Profile → Calendar Sync (Task 17, rendered for Pro/Trial members only).
 * The feed token is generated lazily on first open via RPC; the URL is the
 * only credential calendar apps get, so Reset invalidates every existing
 * subscription.
 */
export function CalendarSyncSection() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    getIcalFeedToken().then(result => {
      if (result.error) setError(result.error)
      setToken(result.token)
      setLoading(false)
    })
  }, [])

  const feedUrl = token ? `https://wdwshiftx.com/api/calendar/${token}.ics` : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the URL and copy it manually.')
    }
  }

  const handleReset = async () => {
    setResetting(true)
    setError(null)
    const result = await resetIcalFeedToken()
    setResetting(false)
    setResetConfirm(false)
    if (result.error) { setError(result.error); return }
    setToken(result.token)
  }

  return (
    <div id="calendar-sync" className="card shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-secondary/20 rounded-full flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-accent font-bold text-text flex items-center gap-2">
            Calendar Sync
            <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-0.5 rounded">Pro</span>
          </h2>
          <p className="text-xs text-text/50">See your shifts in Google, Apple, or Outlook calendars — updates automatically</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text/50">Loading your feed URL…</p>
      ) : !token ? (
        !error && <p className="text-sm text-text/50">Calendar sync is available on the Pro plan.</p>
      ) : (
        <div className="space-y-4">
          {/* Feed URL */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">Your personal feed URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={feedUrl}
                onFocus={e => e.target.select()}
                className="input text-xs bg-primary-light/20 text-text/70 flex-1 min-w-0"
              />
              <Button type="button" size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 shrink-0">
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="mt-1 text-xs text-text/40">
              Anyone with this URL can see your shift calendar — treat it like a password.
            </p>
          </div>

          {/* Setup instructions live on Help & Support */}
          <p className="text-sm text-text/60">
            Need help subscribing? See the{' '}
            <Link href="/help#calendar-sync" className="text-primary hover:underline">
              step-by-step guides for Google Calendar, Apple Calendar, and Outlook
            </Link>{' '}
            in Help &amp; Support.
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a href={`${feedUrl}?download=1`} className="btn btn-outline gap-1.5 text-sm px-4 py-2 min-h-0 h-9">
              <Download className="w-4 h-4" /> Download .ics
            </a>
            {!resetConfirm ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setResetConfirm(true)} className="gap-1.5">
                <RefreshCw className="w-4 h-4" /> Reset feed URL
              </Button>
            ) : (
              <div className="w-full p-3 rounded-md bg-warning/10 border border-warning/20 space-y-2">
                <p className="text-sm text-warning font-medium">
                  Resetting creates a new URL — every calendar currently subscribed to the old one will stop updating
                  and you&rsquo;ll need to re-subscribe with the new URL.
                </p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setResetConfirm(false)}>Cancel</Button>
                  <Button type="button" size="sm" variant="danger" loading={resetting} onClick={handleReset} className="gap-1.5">
                    <RefreshCw className="w-4 h-4" /> Yes, Reset URL
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
