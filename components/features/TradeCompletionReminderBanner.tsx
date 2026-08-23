'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

const STORAGE_KEY = 'wdwshiftx-trade-completion-reminder-dismissed'

/**
 * One-time Wall reminder about marking a traded/given-away shift completed
 * and clearing any ADOs for that day — dismissal remembered per device, same
 * pattern as PushPromptBanner.
 */
export function TradeCompletionReminderBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return
    } catch {}
    setVisible(true)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setVisible(false)
  }

  return (
    <div className="mb-5 p-3.5 rounded-lg bg-warning/10 border border-warning/20 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
        <p className="text-sm text-text/80 flex-1">
          <span className="font-bold text-warning">REMEMBER</span> — once you trade or give away your shift, be sure to mark it completed here and delete any ADO&apos;s you may have put in for that day.
        </p>
        <button
          onClick={dismiss}
          className="p-1.5 rounded-md text-text/40 hover:text-text hover:bg-text/5 transition-colors min-h-0 min-w-0 shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
