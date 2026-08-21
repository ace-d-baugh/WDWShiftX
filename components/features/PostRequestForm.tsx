'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { requestSchema } from '@/lib/validations/shifts'
import { Button } from '@/components/ui/Button'
import { Plus, Save, X, ArrowLeft } from 'lucide-react'
import type { PreferredTime } from '@/lib/database.types'
import { notifyRequestPosted } from '@/app/actions/notifications'
import { formatInTimeZone } from 'date-fns-tz'

const ET = 'America/New_York'
const todayET = () => formatInTimeZone(new Date(), ET, 'yyyy-MM-dd')

const TIME_OPTIONS: { value: PreferredTime; label: string; desc: string }[] = [
  { value: 'morning',   label: 'Morning',    desc: '6am–12pm'  },
  { value: 'afternoon', label: 'Afternoon',  desc: '12pm–6pm'  },
  { value: 'evening',   label: 'Evening',    desc: '6pm–12am'  },
  { value: 'late',      label: 'Late Night', desc: '12am–6am'  },
]

interface Board { id: string; name: string }

type RequestForm = {
  request_title: string
  board_id: string
  requested_date: string
  preferred_times: PreferredTime[]
  details: string
}

const blank = (board_id = ''): RequestForm => ({
  request_title: 'Shift Wanted', board_id, requested_date: '',
  preferred_times: [], details: '',
})

export interface RequestInitialData {
  request_title: string
  board_id: string | null
  requested_date: string
  preferred_times: PreferredTime[]
  details: string | null
}

interface PostRequestFormProps {
  userId: string
  displayName: string
  onSuccess?: () => void
  requestId?: string
  initialData?: RequestInitialData
}

function isTouched(f: RequestForm) {
  return !!f.requested_date || f.preferred_times.length > 0 || !!f.details ||
    (f.request_title !== 'Shift Wanted' && !!f.request_title)
}

export function PostRequestForm({ userId, displayName, onSuccess, requestId, initialData }: PostRequestFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!requestId

  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [serverError, setServerError] = useState<string | null>(null)

  const firstForm: RequestForm = initialData ? {
    request_title:   initialData.request_title,
    board_id:        initialData.board_id ?? '',
    requested_date:  initialData.requested_date,
    preferred_times: initialData.preferred_times as PreferredTime[],
    details:         initialData.details ?? '',
  } : blank()

  const [forms, setForms] = useState<RequestForm[]>([firstForm])
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>[]>([{}])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('user_boards').select('board_id, boards(id, name)')
        .eq('user_id', userId).eq('is_approved', true)
      const list = (data ?? [])
        .map((ub: { board_id: string; boards: Board | null }) => ub.boards)
        .filter((b): b is Board => !!b)
        .sort((a, b) => a.name.localeCompare(b.name))
      setBoards(list)
      if (!isEdit && list.length === 1) {
        setForms(prev => prev.map(f => f.board_id ? f : { ...f, board_id: list[0].id }))
      }
      setDataLoading(false)
    }
    load()
  }, [userId, isEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (i: number, name: string, value: unknown) => {
    setForms(prev => prev.map((f, idx) => idx === i ? { ...f, [name]: value } : f))
    setFormErrors(prev => prev.map((e, idx) => idx === i ? { ...e, [name]: undefined } : e))
  }

  const onChange = (i: number) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setField(i, e.target.name, e.target.value)
  }

  const toggleTime = (i: number, t: PreferredTime) => {
    setForms(prev => prev.map((f, idx) => idx !== i ? f : {
      ...f,
      preferred_times: f.preferred_times.includes(t)
        ? f.preferred_times.filter(x => x !== t)
        : [...f.preferred_times, t],
    }))
    setFormErrors(prev => prev.map((e, idx) => idx === i ? { ...e, preferred_times: undefined } : e))
  }

  const addForm = () => {
    setForms(prev => [...prev, blank(prev[prev.length - 1].board_id)])
    setFormErrors(prev => [...prev, {}])
  }

  const removeForm = (i: number) => {
    setForms(prev => prev.filter((_, idx) => idx !== i))
    setFormErrors(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    const newErrors: Record<string, string | undefined>[] = forms.map(() => ({}))
    let hasErrors = false

    forms.forEach((f, i) => {
      if (i > 0 && !isTouched(f)) return
      const result = requestSchema.safeParse(f)
      if (!result.success) {
        result.error.errors.forEach(err => {
          const field = err.path[0] as string
          if (!newErrors[i][field]) newErrors[i][field] = err.message
        })
        hasErrors = true
      }
    })

    if (hasErrors) { setFormErrors(newErrors); return }

    setLoading(true)
    try {
      if (isEdit) {
        const f = forms[0]
        const { error } = await supabase.from('requests').update({
          request_title: f.request_title, board_id: f.board_id,
          requested_date: f.requested_date, preferred_times: f.preferred_times,
          details: f.details || null,
        }).eq('id', requestId!).eq('user_id', userId)
        if (error) throw error
      } else {
        for (const [i, f] of forms.entries()) {
          if (i > 0 && !isTouched(f)) continue
          const { data: inserted, error } = await supabase.from('requests').insert({
            created_by: displayName, user_id: userId,
            request_title: f.request_title, board_id: f.board_id,
            requested_date: f.requested_date, preferred_times: f.preferred_times,
            details: f.details || null, is_active: true,
          }).select('id').single()
          if (error) throw error
          notifyRequestPosted({ requestId: inserted.id })
            .catch(err => console.error('[post-request] match notify failed:', err))
        }
      }
      onSuccess?.()
      router.push('/wall?tab=requests')
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : isEdit ? 'Failed to update request.' : 'Failed to post request.')
    } finally {
      setLoading(false)
    }
  }

  if (dataLoading) return <div className="card shadow-sm flex items-center justify-center py-12 text-text/50">Loading...</div>

  if (boards.length === 0) return (
    <div className="card shadow-sm py-8 text-center text-sm text-text/60">
      You haven&apos;t joined any boards yet.{' '}
      <a href="/profile#my-boards" className="text-primary underline">Join or create a board</a> first.
    </div>
  )

  const submitCount = forms.filter((f, i) => i === 0 || isTouched(f)).length

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {serverError && (
        <div className="p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">{serverError}</div>
      )}

      {forms.map((f, i) => {
        const errs = formErrors[i] ?? {}
        const partial = i > 0 && isTouched(f) && Object.keys(errs).some(k => errs[k])

        return (
          <div key={i} className="card shadow-sm">
            {(forms.length > 1 || isEdit) && (
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                <span className="text-sm font-semibold text-text">
                  {isEdit ? 'Request Details' : `Request ${i + 1}`}
                </span>
                {i > 0 && (
                  <button type="button" onClick={() => removeForm(i)}
                    className="flex items-center gap-1 text-xs text-warning hover:text-warning/80 min-h-0 min-w-0 transition-colors">
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
            )}

            {partial && (
              <div className="mb-3 p-2.5 rounded-md bg-warning/10 border border-warning/20 text-warning text-xs">
                Please complete all required fields or remove this request.
              </div>
            )}

            <div className="space-y-4">
              {/* Board — hidden when user has only one board (auto-selected).
                  First row, matching PostShiftForm's field order. */}
              {boards.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Board <span className="text-warning">*</span></label>
                  <select name="board_id" value={f.board_id} onChange={onChange(i)}
                    className={`input ${errs.board_id ? 'border-warning' : ''}`}>
                    <option value="">Select board...</option>
                    {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {errs.board_id && <p className="mt-1 text-xs text-warning">{errs.board_id}</p>}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">Title <span className="text-warning">*</span></label>
                <input name="request_title" type="text" value={f.request_title} onChange={onChange(i)}
                  maxLength={35}
                  className={`input placeholder:text-text/30 ${errs.request_title ? 'border-warning' : ''}`}
                  placeholder="Shift Wanted" />
                {errs.request_title && <p className="mt-1 text-xs text-warning">{errs.request_title}</p>}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">Date Needed <span className="text-warning">*</span></label>
                <input name="requested_date" type="date" value={f.requested_date} onChange={onChange(i)}
                  min={todayET()}
                  className={`input ${errs.requested_date ? 'border-warning' : ''}`} />
                {errs.requested_date && <p className="mt-1 text-xs text-warning">{errs.requested_date}</p>}
              </div>

              {/* Preferred Times */}
              <div>
                <p className="text-sm font-medium text-text mb-2">Preferred Time(s) <span className="text-warning">*</span></p>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_OPTIONS.map(t => (
                    <button key={t.value} type="button" onClick={() => toggleTime(i, t.value)}
                      className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-colors ${
                        f.preferred_times.includes(t.value)
                          ? 'border-primary bg-primary-light text-primary'
                          : 'border-border text-text/60 hover:border-primary/50'
                      }`}>
                      <span className="text-sm font-medium">{t.label}</span>
                      <span className="text-xs opacity-70">{t.desc}</span>
                    </button>
                  ))}
                </div>
                {errs.preferred_times && <p className="mt-1 text-xs text-warning">{errs.preferred_times}</p>}
              </div>

              {/* Details */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">Details (optional)</label>
                <textarea name="details" value={f.details} onChange={onChange(i)}
                  className="input h-20 resize-none" placeholder="Any additional details..." maxLength={500} />
              </div>
            </div>
          </div>
        )
      })}

      {!isEdit && (
        <button type="button" onClick={addForm}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/70 transition-colors min-h-0">
          <Plus className="w-4 h-4" /> Add Another Request
        </button>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="danger-outline" onClick={() => router.back()} className="gap-1.5 shrink-0">
          <ArrowLeft className="w-4 h-4" /> Cancel
        </Button>
        <Button type="submit" loading={loading} className="flex-1 gap-1.5">
          {isEdit
            ? <><Save className="w-4 h-4" /> Update Request</>
            : submitCount > 1
              ? <><Plus className="w-4 h-4" /> Post {submitCount} Requests</>
              : <><Plus className="w-4 h-4" /> Post Request</>}
        </Button>
      </div>
    </form>
  )
}
