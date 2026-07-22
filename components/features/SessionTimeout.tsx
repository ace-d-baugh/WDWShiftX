'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TIMEOUT_MS      = 8 * 60 * 60 * 1000 // 8 hours of inactivity
const CHECK_INTERVAL  = 60 * 1000            // check every minute
const ACTIVITY_KEY    = 'wdwshiftx-last-activity'

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'] as const

export function SessionTimeout() {
  const router  = useRouter()
  const supabase = createClient()
  const timer   = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Throttled: mousemove/scroll fire constantly, and each stamp is a
    // synchronous localStorage write. 30s granularity vs an 8h timeout.
    let lastStamp = 0
    const stamp = () => {
      const now = Date.now()
      if (now - lastStamp < 30_000) return
      lastStamp = now
      localStorage.setItem(ACTIVITY_KEY, now.toString())
    }

    const check = async () => {
      const last = Number(localStorage.getItem(ACTIVITY_KEY) || 0)
      if (!last) { stamp(); return }
      if (Date.now() - last > TIMEOUT_MS) {
        if (timer.current) clearInterval(timer.current)
        await supabase.auth.signOut()
        router.push('/login?reason=session_expired')
      }
    }

    stamp()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, stamp, { passive: true }))
    timer.current = setInterval(check, CHECK_INTERVAL)

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, stamp))
      if (timer.current) clearInterval(timer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
