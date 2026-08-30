'use client'

import { Plus, Trash2 } from 'lucide-react'
import { CONTACT_METHOD_META, CONTACT_METHOD_TYPES, validateContactValue } from '@/lib/contactMethods'
import type { ContactMethodType } from '@/lib/database.types'

export interface ContactMethodDraft {
  id?: string
  type: ContactMethodType
  value: string
}

interface ContactMethodsEditorProps {
  rows: ContactMethodDraft[]
  onChange: (rows: ContactMethodDraft[]) => void
  errors?: Record<number, string>
}

export function ContactMethodsEditor({ rows, onChange, errors }: ContactMethodsEditorProps) {
  const updateRow = (index: number, patch: Partial<ContactMethodDraft>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index))
  }

  const addRow = () => {
    onChange([...rows, { type: 'phone', value: '' }])
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const meta = CONTACT_METHOD_META[row.type]
        const error = errors?.[index]
        return (
          <div key={row.id ?? `new-${index}`} className="flex items-start gap-2">
            <select
              value={row.type}
              onChange={e => updateRow(index, { type: e.target.value as ContactMethodType })}
              className="input text-sm h-9 py-0 w-36 shrink-0"
            >
              {CONTACT_METHOD_TYPES.map(t => (
                <option key={t} value={t}>{CONTACT_METHOD_META[t].label}</option>
              ))}
            </select>
            <div className="flex-1 min-w-0">
              <input
                type={meta.inputType}
                value={row.value}
                onChange={e => updateRow(index, { value: e.target.value })}
                placeholder={meta.placeholder}
                className={`input placeholder:text-text/50 h-9 py-0 ${error ? 'border-warning' : ''}`}
              />
              {error && <p className="mt-1 text-xs text-warning">{error}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label="Remove contact method"
              className="shrink-0 h-9 w-9 flex items-center justify-center rounded-md text-text/50 hover:text-warning hover:bg-warning/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )
      })}

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <Plus className="w-4 h-4" /> Add contact method
      </button>
    </div>
  )
}

/** Validates every row, returning a map of index → error message for invalid ones. */
export function validateContactMethodDrafts(rows: ContactMethodDraft[]): Record<number, string> {
  const errors: Record<number, string> = {}
  rows.forEach((row, index) => {
    const error = validateContactValue(row.type, row.value)
    if (error) errors[index] = error
  })
  return errors
}
