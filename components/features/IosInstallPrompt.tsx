'use client'

import { useEffect, useState } from 'react'
import { Share, PlusSquare, Smartphone, BellRing, X } from 'lucide-react'
import { needsIosInstallForPush, isIosSafari } from '@/lib/push'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'wdwshiftx-ios-install-dismissed'

interface IosInstallPromptProps {
  /**
   * banner — dismissible nudge for the Wall (dismissal remembered per device).
   * inline — always-visible walkthrough for Welcome step 3 and Profile.
   */
  variant?: 'banner' | 'inline'
}

/**
 * Task 23: iOS 16.4+ supports web push, but only for PWAs opened from the
 * Home Screen — a fact almost no user knows. This walkthrough appears only
 * in iOS browser tabs (where the Push API is absent) and walks through the
 * two-step install. Once the app is opened from the Home Screen, the Push
 * API exists and the regular prompts (PushPromptBanner / profile toggle)
 * take over.
 */
export function IosInstallPrompt({ variant = 'banner' }: IosInstallPromptProps) {
  const [visible, setVisible] = useState(false)
  const [inSafari, setInSafari] = useState(true)

  useEffect(() => {
    if (!needsIosInstallForPush()) return
    if (variant === 'banner') {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return
      } catch {}
    }
    setInSafari(isIosSafari())
    setVisible(true)
  }, [variant])

  if (!visible) return null

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setVisible(false)
  }

  const steps = [
    ...(inSafari ? [] : [{
      icon: Smartphone,
      text: <>Open <strong>wdwshiftx.com</strong> in <strong>Safari</strong> (installing works best from there)</>,
    }]),
    {
      icon: Share,
      text: <>Tap the <strong>Share</strong> button in Safari&rsquo;s toolbar</>,
    },
    {
      icon: PlusSquare,
      text: <>Scroll down and choose <strong>&ldquo;Add to Home Screen&rdquo;</strong></>,
    },
    {
      icon: BellRing,
      text: <>Open <strong>WDWShiftX</strong> from your Home Screen and turn on notifications when asked</>,
    },
  ]

  return (
    <div className={cn(
      'rounded-lg border border-info/20 bg-info/10 p-3.5',
      variant === 'banner' && 'mb-5 animate-fade-in-up'
    )}>
      <div className="flex items-start gap-3">
        <Smartphone className="w-4 h-4 text-info shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text">
            Get instant shift alerts on your iPhone
          </p>
          <p className="text-xs text-text/60 mt-0.5 mb-2.5">
            Shifts go to whoever hears about them first. Add WDWShiftX to your Home Screen
            (takes ~20 seconds, iOS 16.4 or newer) and push notifications start working.
          </p>
          <ol className="space-y-1.5">
            {steps.map((step, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-text/80">
                <span className="w-4 h-4 rounded-full bg-info/20 text-info font-bold text-[10px] flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <step.icon className="w-3.5 h-3.5 text-info shrink-0" />
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </div>
        {variant === 'banner' && (
          <button
            onClick={dismiss}
            className="p-1.5 rounded-md text-text/40 hover:text-text hover:bg-text/5 transition-colors min-h-0 min-w-0 shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
