'use client'

import { useState } from 'react'
import { Flag, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

interface FlagItem {
  id: string
  target_type: string
  target_id: string
  reason: string
  status: string
  created_at: string
  users: { display_name: string } | null
}

interface FlagsClientProps {
  flags: FlagItem[]
  resolverId: string
}

export function FlagsClient({ flags: initialFlags, resolverId }: FlagsClientProps) {
  const supabase = createClient()
  const [flags, setFlags] = useState(initialFlags)
  const [processing, setProcessing] = useState<string | null>(null)

  const resolveFlag = async (id: string, action: 'resolved' | 'dismissed') => {
    setProcessing(id)
    await (supabase as any).from('flags').update({
      status: action,
      resolved_by_user_id: resolverId,
    } as any).eq('id', id)
    setFlags(prev => prev.filter(f => f.id !== id))
    setProcessing(null)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-accent text-2xl font-bold text-text flex items-center gap-2">
          <Flag className="w-6 h-6 text-warning" /> Flag Queue
        </h1>
        <p className="text-sm text-text/60">
          {flags.length === 0 ? 'No pending flags. Board is clean!' : `${flags.length} flag${flags.length !== 1 ? 's' : ''} pending review`}
        </p>
      </div>

      {flags.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
          <p className="font-accent text-xl font-bold text-text">All Clear!</p>
          <p className="text-text/50 text-sm mt-1">No flags to review right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {flags.map(flag => (
            <div key={flag.id} className="card border-l-4 border-l-warning">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-warning/20 text-warning text-xs capitalize">{flag.target_type}</span>
                    <span className="text-xs text-text/40">
                      {formatDistanceToNow(parseISO(flag.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-text">Reason: {flag.reason}</p>
                  <p className="text-xs text-text/50 mt-0.5">
                    Flagged by: {flag.users?.display_name ?? 'Anonymous'}
                  </p>
                  <p className="text-xs text-text/40 mt-0.5 font-mono break-all">ID: {flag.target_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="danger"
                  loading={processing === flag.id}
                  onClick={() => resolveFlag(flag.id, 'resolved')}
                  className="gap-1 min-h-0 h-9 px-3 text-xs"
                >
                  <XCircle className="w-3.5 h-3.5" /> Remove Post
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={processing === flag.id}
                  onClick={() => resolveFlag(flag.id, 'dismissed')}
                  className="gap-1 min-h-0 h-9 px-3 text-xs"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Dismiss Flag
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
