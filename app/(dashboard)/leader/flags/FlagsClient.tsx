'use client'

import { useState } from 'react'
import { Flag, CheckCircle, Trash2, Eye, Clock, LayoutGrid, User, MessageSquare, Hash } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { createClient } from '@/lib/supabase/client'
import { resolveFlag as resolveFlagAction } from '@/app/actions/flags'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { UserLink } from '@/components/ui/UserLink'
import type { PreferredTime } from '@/lib/database.types'

const ET = 'America/New_York'

const TIME_LABELS: Record<PreferredTime, string> = {
  morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', late: 'Late Night',
}

interface FlagItem {
  id: string
  target_type: string
  target_id: string
  reason: string
  status: string
  created_at: string
  flagged_by_user_id: string | null
  users: { display_name: string | null } | null
}

type FlaggedContent =
  | { kind: 'shift';   data: { shift_title: string; start_time: string; end_time: string; board_name: string; details: string | null; created_by: string } }
  | { kind: 'request'; data: { requested_date: string; preferred_times: PreferredTime[]; board_name: string; details: string | null; created_by: string } }
  | { kind: 'comment'; data: { body: string; post_type: string; author: string | null } }
  | { kind: 'user';    data: { display_name: string | null; email: string; role: string } }
  | { kind: 'board';   data: { name: string } }
  | { kind: 'gone' }
  | { kind: 'error';   message: string }

interface FlagsClientProps {
  flags: FlagItem[]
  currentUserId: string
}

export function FlagsClient({ flags: initialFlags, currentUserId }: FlagsClientProps) {
  const supabase = createClient()
  const [flags, setFlags] = useState(initialFlags)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewContent, setViewContent] = useState<FlaggedContent | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  const resolveFlag = async (flag: FlagItem, action: 'resolved' | 'dismissed') => {
    setProcessing(flag.id)
    setError(null)
    const { error: e } = await resolveFlagAction(flag.id, action)
    if (e) {
      setError(e)
    } else {
      setFlags(prev => prev.filter(f => f.id !== flag.id))
    }
    setProcessing(null)
  }

  const viewFlaggedContent = async (flag: FlagItem) => {
    setViewLoading(true)
    setViewContent(null)

    try {
      if (flag.target_type === 'post') {
        // Try shifts first
        const { data: shift } = await supabase
          .from('shifts')
          .select('shift_title, start_time, end_time, details, created_by, boards(name)')
          .eq('id', flag.target_id)
          .maybeSingle()

        if (shift) {
          setViewContent({
            kind: 'shift',
            data: {
              shift_title: shift.shift_title,
              start_time:  shift.start_time,
              end_time:    shift.end_time,
              details:     shift.details,
              created_by:  shift.created_by,
              board_name:  (shift.boards as { name: string } | null)?.name ?? '',
            },
          })
          return
        }

        // Fall back to requests
        const { data: request } = await supabase
          .from('requests')
          .select('requested_date, preferred_times, details, created_by, boards(name)')
          .eq('id', flag.target_id)
          .maybeSingle()

        if (request) {
          setViewContent({
            kind: 'request',
            data: {
              requested_date:  request.requested_date,
              preferred_times: request.preferred_times as PreferredTime[],
              details:         request.details,
              created_by:      request.created_by,
              board_name:      (request.boards as { name: string } | null)?.name ?? '',
            },
          })
          return
        }

        setViewContent({ kind: 'gone' })
        return
      }

      if (flag.target_type === 'comment') {
        const { data: comment } = await supabase
          .from('comments')
          .select('body, post_type, users(display_name)')
          .eq('id', flag.target_id)
          .maybeSingle()

        if (comment) {
          setViewContent({
            kind: 'comment',
            data: {
              body:      comment.body,
              post_type: comment.post_type,
              author:    (comment.users as { display_name: string | null } | null)?.display_name ?? null,
            },
          })
          return
        }

        setViewContent({ kind: 'gone' })
        return
      }

      if (flag.target_type === 'user') {
        const { data: usr } = await supabase
          .from('users')
          .select('display_name, email, role')
          .eq('id', flag.target_id)
          .maybeSingle()

        if (usr) {
          setViewContent({ kind: 'user', data: usr })
          return
        }

        setViewContent({ kind: 'gone' })
        return
      }

      if (flag.target_type === 'board') {
        const { data: board } = await supabase
          .from('boards')
          .select('name')
          .eq('id', flag.target_id)
          .maybeSingle()

        if (board) {
          setViewContent({ kind: 'board', data: board })
          return
        }

        setViewContent({ kind: 'gone' })
        return
      }

      setViewContent({ kind: 'error', message: `Unknown target type: ${flag.target_type}` })
    } catch (err) {
      setViewContent({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to load content.' })
    } finally {
      setViewLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-accent text-2xl font-bold text-text flex items-center gap-2">
          <Flag className="w-6 h-6 text-warning" /> Flag Queue
        </h1>
        <p className="text-sm text-text/60">
          {flags.length === 0
            ? 'No pending flags. Board is clean!'
            : `${flags.length} flag${flags.length !== 1 ? 's' : ''} pending review`}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">
          {error}
          <button className="ml-2 underline text-xs" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="badge bg-warning/20 text-warning text-xs capitalize">{flag.target_type}</span>
                    <span className="text-xs text-text/40">
                      {formatDistanceToNow(parseISO(flag.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-text">Reason: {flag.reason}</p>
                  <p className="text-xs text-text/50 mt-0.5">
                    Flagged by: <UserLink userId={flag.flagged_by_user_id} displayName={flag.users?.display_name ?? 'Anonymous'} currentUserId={currentUserId} />
                  </p>
                </div>
                <button
                  onClick={() => viewFlaggedContent(flag)}
                  disabled={viewLoading}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/70 px-2.5 py-1.5 rounded-lg border border-primary/30 hover:bg-primary-light transition-colors min-h-0 shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="danger"
                  loading={processing === flag.id}
                  onClick={() => resolveFlag(flag, 'resolved')}
                  className="gap-1 min-h-0 h-9 px-3 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {flag.target_type === 'comment' ? 'Remove Comment' : 'Remove Post'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={processing === flag.id}
                  onClick={() => resolveFlag(flag, 'dismissed')}
                  className="gap-1 min-h-0 h-9 px-3 text-xs"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Flagged Content Modal ─────────────────────────────────────────── */}
      <Modal
        open={viewContent !== null || viewLoading}
        onClose={() => setViewContent(null)}
        title="Flagged Content"
        size="md"
      >
        {viewLoading ? (
          <div className="flex justify-center py-8">
            <span className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : viewContent ? (
          <FlaggedContentView content={viewContent} />
        ) : null}
      </Modal>
    </div>
  )
}

// ── Content renderer ──────────────────────────────────────────────────────────

function FlaggedContentView({ content }: { content: FlaggedContent }) {
  if (content.kind === 'gone') {
    return (
      <p className="text-sm text-text/50 italic text-center py-4">
        This content has already been removed.
      </p>
    )
  }

  if (content.kind === 'error') {
    return <p className="text-sm text-warning">{content.message}</p>
  }

  if (content.kind === 'shift') {
    const d = content.data
    const start = formatInTimeZone(parseISO(d.start_time), ET, 'MMM d, yyyy · h:mm a')
    const end   = formatInTimeZone(parseISO(d.end_time),   ET, 'h:mm a zzz')
    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-primary-light/40 border border-border">
          <p className="text-xs font-medium text-primary/70 uppercase tracking-wide mb-1">Shift Offer</p>
          <p className="font-accent font-bold text-text text-lg leading-snug">{d.shift_title}</p>
        </div>
        <div className="space-y-2 text-sm">
          <Row icon={<Clock className="w-4 h-4 text-primary" />} label="Time">
            {start} → {end}
          </Row>
          <Row icon={<LayoutGrid className="w-4 h-4 text-primary" />} label="Board">
            {d.board_name}
          </Row>
          <Row icon={<User className="w-4 h-4 text-primary" />} label="Posted by">
            {d.created_by}
          </Row>
        </div>
        {d.details && (
          <p className="text-sm text-text/60 bg-primary-light/30 rounded-md px-3 py-2 italic">
            &ldquo;{d.details}&rdquo;
          </p>
        )}
      </div>
    )
  }

  if (content.kind === 'request') {
    const d = content.data
    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-accent/10 border border-border">
          <p className="text-xs font-medium text-text/50 uppercase tracking-wide mb-1">Shift Request</p>
          <p className="font-accent font-bold text-text text-lg">Shift Wanted</p>
        </div>
        <div className="space-y-2 text-sm">
          <Row icon={<Clock className="w-4 h-4 text-accent" />} label="Date">
            {formatInTimeZone(d.requested_date + 'T12:00:00Z', ET, 'EEEE, MMMM d, yyyy')}
          </Row>
          <Row icon={<Clock className="w-4 h-4 text-accent" />} label="Preferred times">
            {d.preferred_times.map(t => TIME_LABELS[t]).join(', ')}
          </Row>
          <Row icon={<LayoutGrid className="w-4 h-4 text-accent" />} label="Board">
            {d.board_name}
          </Row>
          <Row icon={<User className="w-4 h-4 text-accent" />} label="Requested by">
            {d.created_by}
          </Row>
        </div>
        {d.details && (
          <p className="text-sm text-text/60 bg-accent/10 rounded-md px-3 py-2 italic">
            &ldquo;{d.details}&rdquo;
          </p>
        )}
      </div>
    )
  }

  if (content.kind === 'comment') {
    const d = content.data
    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-text/5 border border-border">
          <p className="text-xs font-medium text-text/50 uppercase tracking-wide mb-1">Comment on a {d.post_type}</p>
          <p className="text-sm text-text/60 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {d.author ?? 'Unknown user'}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <MessageSquare className="w-4 h-4 text-text/40 shrink-0 mt-0.5" />
          <p className="text-text/80 leading-relaxed">{d.body}</p>
        </div>
      </div>
    )
  }

  if (content.kind === 'user') {
    const d = content.data
    return (
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-text/5 border border-border">
          <p className="text-xs font-medium text-text/50 uppercase tracking-wide mb-1">Flagged User</p>
          <p className="font-accent font-bold text-text text-lg">{d.display_name ?? '(no display name)'}</p>
        </div>
        <div className="space-y-2 text-sm">
          <Row icon={<User className="w-4 h-4 text-text/50" />} label="Email">{d.email}</Row>
          <Row icon={<Hash className="w-4 h-4 text-text/50" />} label="Role">{d.role}</Row>
        </div>
      </div>
    )
  }

  if (content.kind === 'board') {
    return (
      <div className="p-3 rounded-lg bg-text/5 border border-border">
        <p className="text-xs font-medium text-text/50 uppercase tracking-wide mb-1">Flagged Board</p>
        <p className="font-accent font-bold text-text text-lg flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary" />
          {content.data.name}
        </p>
      </div>
    )
  }

  return null
}

// Tiny layout helper
function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span className="text-text/50 shrink-0 w-24">{label}</span>
      <span className="text-text font-medium min-w-0">{children}</span>
    </div>
  )
}
