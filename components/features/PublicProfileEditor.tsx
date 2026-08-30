'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Save, CheckCircle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { ContactMethodsEditor, validateContactMethodDrafts, type ContactMethodDraft } from '@/components/features/ContactMethodsEditor'
import { MONTH_NAMES, daysInMonth } from '@/lib/birthday'

const BIO_MAX_LENGTH = 1000
const CURRENT_YEAR = new Date().getFullYear()

interface PublicProfileEditorProps {
  sessionUserId: string
  initialBio: string | null
  initialBirthdayMonth: number | null
  initialBirthdayDay: number | null
  initialBirthdayYear: number | null
  initialContactMethods: ContactMethodDraft[]
}

export function PublicProfileEditor({
  sessionUserId,
  initialBio,
  initialBirthdayMonth,
  initialBirthdayDay,
  initialBirthdayYear,
  initialContactMethods,
}: PublicProfileEditorProps) {
  const supabase = createClient()

  const [bio, setBio] = useState(initialBio ?? '')
  const [month, setMonth] = useState<number | null>(initialBirthdayMonth)
  const [day, setDay] = useState<number | null>(initialBirthdayDay)
  const [year, setYear] = useState<number | null>(initialBirthdayYear)
  const [contactRows, setContactRows] = useState<ContactMethodDraft[]>(initialContactMethods)
  const [contactErrors, setContactErrors] = useState<Record<number, string>>({})

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxDay = daysInMonth(month, year)

  const handleSave = async () => {
    setError(null)
    setSaveSuccess(false)

    const validRows = contactRows.filter(r => r.value.trim())
    const errors = validateContactMethodDrafts(validRows)
    if (Object.keys(errors).length > 0) {
      setContactErrors(errors)
      return
    }
    setContactErrors({})

    setSaving(true)
    try {
      const { error: userError } = await supabase
        .from('users')
        .update({
          bio: bio.trim() || null,
          birthday_month: month,
          birthday_day: day,
          birthday_year: year,
        })
        .eq('id', sessionUserId)
      if (userError) throw userError

      // Simplest safe approach for a low-row-count list: replace wholesale
      // rather than 3-way diffing inserts/updates/deletes.
      const { error: deleteError } = await supabase
        .from('user_contact_methods')
        .delete()
        .eq('user_id', sessionUserId)
      if (deleteError) throw deleteError

      if (validRows.length > 0) {
        const { error: insertError } = await supabase
          .from('user_contact_methods')
          .insert(validRows.map((row, index) => ({
            user_id: sessionUserId,
            type: row.type,
            value: row.value.trim(),
            sort_order: index,
          })))
        if (insertError) throw insertError
      }

      setContactRows(validRows)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save public profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-accent font-bold text-text">Public Profile</h2>
          <p className="text-xs text-text/50">What other users see when they click your name</p>
        </div>
        <Link
          href={`/users/${sessionUserId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
        >
          View <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">{error}</div>
      )}
      {saveSuccess && (
        <div className="p-3 rounded-md bg-success/10 border border-success/20 text-success text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> Public profile saved!
        </div>
      )}

      {/* Birthday */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">Birthday</label>
        <p className="text-xs text-text/40 mb-2">Show as much or as little as you like — leave any part blank.</p>
        <div className="flex gap-2">
          <select
            value={month ?? ''}
            onChange={e => {
              const next = e.target.value ? Number(e.target.value) : null
              setMonth(next)
              if (day && next && day > daysInMonth(next, year)) setDay(null)
            }}
            className="input text-sm h-9 py-0 flex-1"
          >
            <option value="">Month</option>
            {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
          </select>
          <select
            value={day ?? ''}
            onChange={e => setDay(e.target.value ? Number(e.target.value) : null)}
            className="input text-sm h-9 py-0 w-24"
          >
            <option value="">Day</option>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={year ?? ''}
            onChange={e => setYear(e.target.value ? Number(e.target.value) : null)}
            className="input text-sm h-9 py-0 w-28"
          >
            <option value="">Year</option>
            {Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">Bio</label>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value.slice(0, BIO_MAX_LENGTH))}
          rows={4}
          placeholder="Tell other users a little about yourself..."
          className="input placeholder:text-text/50 resize-none"
        />
        <p className="mt-1 text-xs text-text/40 text-right">{bio.length} / {BIO_MAX_LENGTH}</p>
      </div>

      {/* Contact methods */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">Contact Methods</label>
        <p className="text-xs text-text/40 mb-2">A blank list just shows &ldquo;hasn&rsquo;t shared this&rdquo; on your public page.</p>
        <ContactMethodsEditor rows={contactRows} onChange={setContactRows} errors={contactErrors} />
      </div>

      <Button onClick={handleSave} loading={saving} size="sm" className="gap-1.5">
        <Save className="w-4 h-4" /> Save Public Profile
      </Button>
    </div>
  )
}
