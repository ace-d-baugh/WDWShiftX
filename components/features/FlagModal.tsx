'use client'

import { useState } from 'react'
import { Flag, CheckCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import type { FlagTargetType } from '@/lib/database.types'

const FLAG_REASONS = [
  'Spam or duplicate post',
  'Incorrect information',
  'Harassment or inappropriate content',
  'Not a real Disney Cast Member',
  'Other',
]

interface FlagModalProps {
  open: boolean
  onClose: () => void
  targetType: FlagTargetType
  targetId: string
}

export function FlagModal({ open, onClose, targetType, targetId }: FlagModalProps) {
  const supabase = createClient()
  const [reason, setReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleClose = () => {
    setReason('')
    setCustomReason('')
    setError(null)
    setSuccess(false)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const finalReason = reason === 'Other' ? customReason.trim() : reason
    if (!finalReason) {
      setError('Please select or enter a reason.')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: insertError } = await (supabase as any).from('flags').insert({
        flagged_by_user_id: user?.id ?? null,
        target_type: targetType,
        target_id: targetId,
        reason: finalReason,
        status: 'pending',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      if (insertError) throw insertError
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit flag.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Report Post" size="sm">
      {success ? (
        <div className="text-center py-4">
          <CheckCircle className="w-10 h-10 text-success mx-auto mb-3" />
          <p className="font-medium text-text">Report submitted</p>
          <p className="text-sm text-text/60 mt-1 mb-4">A leader will review this post.</p>
          <Button variant="outline" onClick={handleClose} className="w-full">Close</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">Reason for report</label>
            <div className="space-y-2">
              {FLAG_REASONS.map(r => (
                <label key={r} className="flex items-center gap-2 cursor-pointer min-h-0">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="text-primary min-h-0 min-w-0 h-4 w-4"
                  />
                  <span className="text-sm text-text/80">{r}</span>
                </label>
              ))}
            </div>
          </div>
          {reason === 'Other' && (
            <div>
              <textarea
                className="input h-20 resize-none"
                placeholder="Describe the issue..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                maxLength={500}
              />
            </div>
          )}
          {error && <p className="text-xs text-warning">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={loading} className="flex-1 gap-1">
              <Flag className="w-3 h-3" /> Submit Report
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
