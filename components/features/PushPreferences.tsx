'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Checkbox } from '@/components/ui/Checkbox'
import { Radio } from '@/components/ui/Radio'
import type { PushMode } from '@/lib/database.types'

export interface PushPrefsValue {
  push_mode: PushMode
  push_comments: boolean
  push_messages: boolean
  push_wall_posts: boolean
  push_shift_activity: boolean
}

export const DEFAULT_PUSH_PREFS: PushPrefsValue = {
  push_mode: 'all',
  push_comments: true,
  push_messages: true,
  push_wall_posts: true,
  push_shift_activity: true,
}

const MODES: { value: PushMode; label: string; hint: string }[] = [
  { value: 'all', label: 'All notifications', hint: 'Every alert below (default)' },
  { value: 'some', label: 'Only some', hint: 'Choose exactly which alerts you get' },
  { value: 'none', label: 'None', hint: 'No push alerts at all' },
]

const CATEGORIES: { key: Exclude<keyof PushPrefsValue, 'push_mode'>; label: string; hint: string }[] = [
  { key: 'push_wall_posts', label: 'New posts on the Wall', hint: 'A shift offer or request is posted in a board you belong to' },
  { key: 'push_comments', label: 'Comments on my posts', hint: 'Someone comments on or shows interest in your post or a thread you joined' },
  { key: 'push_messages', label: 'Direct messages', hint: 'Someone sends you a message' },
  { key: 'push_shift_activity', label: 'Shift activity', hint: 'Matches, claims, and trade updates on your shifts' },
]

/**
 * Which push alerts this account receives. Saves instantly (not part of the
 * profile Save button) and applies server-side, across all of the user's
 * devices — separate from the per-device on/off in PushNotificationsToggle.
 */
export function PushPreferences({ userId, initial }: { userId: string; initial: PushPrefsValue }) {
  const supabase = createClient()
  const [prefs, setPrefs] = useState<PushPrefsValue>(initial)
  const [error, setError] = useState<string | null>(null)

  const save = async (next: PushPrefsValue) => {
    const previous = prefs
    setPrefs(next)
    setError(null)
    const { error: updateError } = await supabase.from('users').update(next).eq('id', userId)
    if (updateError) {
      setPrefs(previous)
      setError('Could not save your notification preferences. Please try again.')
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-text">Which push alerts do you want?</p>
      <p className="text-xs text-text/50 mb-2">
        When you turn on push, you get all notifications by default. Change that here anytime.
      </p>
      <div role="radiogroup" aria-label="Push notification preference" className="space-y-1.5">
        {MODES.map(m => (
          <label key={m.value} className="flex items-start gap-2.5 cursor-pointer min-h-0">
            <Radio
              name="push_mode"
              className="mt-0.5"
              checked={prefs.push_mode === m.value}
              onChange={() => save({ ...prefs, push_mode: m.value })}
            />
            <span>
              <span className="text-sm text-text">{m.label}</span>
              <span className="block text-xs text-text/50">{m.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {prefs.push_mode === 'some' && (
        <div className="mt-3 ml-6 space-y-2 border-l border-border pl-4">
          {CATEGORIES.map(c => (
            <label key={c.key} className="flex items-start gap-2.5 cursor-pointer min-h-0">
              <Checkbox
                className="mt-0.5"
                checked={prefs[c.key]}
                onChange={e => save({ ...prefs, [c.key]: e.target.checked })}
              />
              <span>
                <span className="text-sm text-text">{c.label}</span>
                <span className="block text-xs text-text/50">{c.hint}</span>
              </span>
            </label>
          ))}
          <p className="text-xs text-text/50">
            Account alerts (board approvals, role changes, announcements from your Mods) are always sent unless you choose None.
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-warning">{error}</p>}
    </div>
  )
}
