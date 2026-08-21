'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { parseISO } from 'date-fns'
import { ArrowLeft, Eye, EyeOff, Flag, MoreVertical, Send, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FlagModal } from '@/components/features/FlagModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Avatar } from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/client'
import { getSettings } from '@/lib/settings'
import { sendMessage, markConversationRead, reactToMessage, deleteConversation } from '@/app/actions/messages'
import { cn } from '@/lib/utils'
import type { MessageReaction } from '@/lib/database.types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const MAX_MESSAGE_LENGTH = 1000
const PICKER_WIDTH = 236 // 6 reaction buttons + padding; used to clamp to the viewport

// The star renders as the site's yellow star icon rather than an emoji
const REACTION_EMOJI: Record<Exclude<MessageReaction, 'star'>, string> = {
  thumbs_up: '👍',
  laugh: '😂',
  surprise: '😮',
  sad: '😢',
  mad: '😠',
}
const REACTION_LABELS: Record<MessageReaction, string> = {
  thumbs_up: 'Thumbs Up',
  laugh: 'Laugh',
  surprise: 'Surprise',
  sad: 'Sad',
  mad: 'Mad',
  star: 'Star',
}
const REACTION_OPTIONS = Object.keys(REACTION_LABELS) as MessageReaction[]

function ReactionIcon({ reaction, className }: { reaction: MessageReaction; className?: string }) {
  if (reaction === 'star') {
    return (
      <Star
        className={cn('w-4 h-4 text-secondary-accent', className)}
        fill="#ffea80"
        strokeWidth={0}
      />
    )
  }
  return <span className={cn('text-base leading-none', className)}>{REACTION_EMOJI[reaction]}</span>
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  body: string
  reaction: MessageReaction | null
  created_at: string
}

interface ConversationClientProps {
  conversationId: string
  currentUserId: string
  otherUserId: string | null
  otherName: string
  otherAvatarUrl: string | null
  otherLastReadAt: string | null
  initialMessages: Message[]
}

export function ConversationClient({
  conversationId,
  currentUserId,
  otherUserId,
  otherName,
  otherAvatarUrl,
  otherLastReadAt,
  initialMessages,
}: ConversationClientProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState(initialMessages)
  const [otherLastRead, setOtherLastRead] = useState(otherLastReadAt)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Header ⋮ menu (flag user / delete chat)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [flagOpen, setFlagOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reaction picker: portalled + viewport-clamped so it's never cut off at
  // the screen edge when a short message puts the star near the left side
  const [picker, setPicker] = useState<{ messageId: string; top: number; left: number } | null>(null)

  const openPicker = (messageId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (picker?.messageId === messageId) { setPicker(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const left = Math.max(8, Math.min(centerX - PICKER_WIDTH / 2, window.innerWidth - PICKER_WIDTH - 8))
    setPicker({ messageId, top: rect.bottom + 4, left })
  }

  // Close the picker on any scroll (it's fixed-positioned)
  useEffect(() => {
    if (!picker) return
    const close = () => setPicker(null)
    document.addEventListener('scroll', close, { passive: true, capture: true })
    return () => document.removeEventListener('scroll', close, { capture: true })
  }, [picker])

  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const [tz, setTz] = useState('America/New_York')
  useEffect(() => { const s = getSettings(); setTimeFormat(s.timeFormat); setTz(s.timezone) }, [])

  // The realtime INSERT and the sendMessage response can both deliver the
  // same message — appendMessage dedupes by id.
  const appendMessage = useCallback((msg: Message) => {
    setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
  }, [])

  // Mark read + tell the other side immediately. The broadcast lets their
  // open thread flip read receipts instantly (no WAL round-trip needed);
  // the postgres_changes binding below stays as the fallback. refresh()
  // re-renders the layout so the Navbar unread badge clears live.
  const markReadAndAnnounce = useCallback(async () => {
    const at = new Date().toISOString()
    await markConversationRead(conversationId)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'read',
      payload: { userId: currentUserId, at },
    })
    router.refresh()
  }, [conversationId, currentUserId, router])

  // Re-fetch on mount. The server-rendered props can be stale: Next's
  // client-side router cache re-serves a previously rendered page for up to
  // 30s, which is how a thread could open showing no new messages. The
  // fresh fetch is authoritative; anything realtime delivered meanwhile is
  // kept.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [msgsRes, partsRes] = await Promise.all([
        supabase
          .from('messages')
          .select('id, conversation_id, sender_id, body, reaction, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
        supabase
          .from('conversation_participants')
          .select('user_id, last_read_at, hidden_at')
          .eq('conversation_id', conversationId),
      ])
      if (cancelled) return
      const me = partsRes.data?.find(p => p.user_id === currentUserId)
      if (msgsRes.data) {
        // Respect a prior chat delete: only messages after my hidden_at
        const cutoff = me?.hidden_at ? new Date(me.hidden_at).getTime() : null
        const fresh = (msgsRes.data as Message[]).filter(
          m => cutoff === null || new Date(m.created_at).getTime() > cutoff
        )
        setMessages(prev => {
          const ids = new Set(fresh.map(m => m.id))
          return [...fresh, ...prev.filter(m => !ids.has(m.id))]
        })
      }
      const other = partsRes.data?.find(p => p.user_id !== currentUserId)
      if (other) setOtherLastRead(other.last_read_at)
    })()
    return () => { cancelled = true }
  }, [supabase, conversationId, currentUserId])

  // Opening the thread marks it read (and announces it)
  useEffect(() => {
    markReadAndAnnounce()
  }, [markReadAndAnnounce])

  // Track the newest message timestamp for the incremental poll below
  const latestCreatedAtRef = useRef<string | null>(null)
  useEffect(() => {
    latestCreatedAtRef.current = messages.length > 0 ? messages[messages.length - 1].created_at : null
  }, [messages])

  // Poll fallback (4s, only while the tab is visible): realtime events can
  // lag or drop — e.g. the events pipeline picks up newly published tables
  // lazily — so the open thread must still converge on its own: new
  // messages appear and the other side's read state advances within a few
  // seconds regardless of realtime health.
  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return
      const [partsRes, msgsRes] = await Promise.all([
        supabase
          .from('conversation_participants')
          .select('user_id, last_read_at')
          .eq('conversation_id', conversationId)
          .neq('user_id', currentUserId),
        (() => {
          let q = supabase
            .from('messages')
            .select('id, conversation_id, sender_id, body, reaction, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })
          const after = latestCreatedAtRef.current
          if (after) q = q.gt('created_at', after)
          return q
        })(),
      ])

      const other = partsRes.data?.[0]
      if (other?.last_read_at) {
        const at = other.last_read_at
        setOtherLastRead(prev =>
          !prev || new Date(at).getTime() > new Date(prev).getTime() ? at : prev
        )
      }

      const fresh = (msgsRes.data ?? []) as Message[]
      if (fresh.length > 0) {
        let gotIncoming = false
        for (const m of fresh) {
          appendMessage(m)
          if (m.sender_id !== currentUserId) gotIncoming = true
        }
        if (gotIncoming) markReadAndAnnounce()
      }
    }
    const id = setInterval(tick, 4000)
    return () => clearInterval(id)
  }, [supabase, conversationId, currentUserId, appendMessage, markReadAndAnnounce])

  useEffect(() => {
    const channel = supabase
      .channel(`realtime:messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as Message
          appendMessage(msg)
          // Reading it live — mark read so the sender's receipt flips and
          // our own navbar badge never accumulates while the thread is open
          if (msg.sender_id !== currentUserId) markReadAndAnnounce()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          // Reaction changes from the other side
          const msg = payload.new as Message
          setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, reaction: msg.reaction } : m)))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          // Read receipt fallback: the other participant's last_read_at moved
          const row = payload.new as { user_id: string; last_read_at: string | null }
          if (row.user_id !== currentUserId) setOtherLastRead(row.last_read_at)
        }
      )
      .on('broadcast', { event: 'read' }, ({ payload }) => {
        // Instant read receipt from the other side's open thread
        const data = payload as { userId: string; at: string }
        if (data.userId !== currentUserId) {
          setOtherLastRead(prev =>
            !prev || new Date(data.at).getTime() > new Date(prev).getTime() ? data.at : prev
          )
        }
      })
      .subscribe()

    channelRef.current = channel
    return () => {
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [supabase, conversationId, currentUserId, appendMessage, markReadAndAnnounce])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError(null)
    const result = await sendMessage(conversationId, trimmed)
    if (result.error) {
      setError(result.error)
    } else {
      setBody('')
      if (result.message) appendMessage(result.message)
    }
    setSending(false)
  }

  // Optimistic reaction with rollback — RLS is the real gate
  const handleReact = async (messageId: string, reaction: MessageReaction) => {
    setPicker(null)
    const previous = messages.find(m => m.id === messageId)?.reaction ?? null
    if (previous === reaction) return
    setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, reaction } : m)))
    const result = await reactToMessage(messageId, reaction)
    if (result.error) {
      setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, reaction: previous } : m)))
      setError(result.error)
    }
  }

  const isReadByOther = (m: Message) =>
    !!otherLastRead && new Date(m.created_at).getTime() <= new Date(otherLastRead).getTime()

  const pickerMessage = picker ? messages.find(m => m.id === picker.messageId) : undefined

  const timePat = timeFormat === '24h' ? 'MMM d, HH:mm' : 'MMM d, h:mm a'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col" style={{ minHeight: 'calc(100vh - 12rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <Link
          href="/messages"
          className="p-1.5 rounded-md text-text/50 hover:text-text hover:bg-primary-light/50 transition-colors min-h-0 min-w-0"
          aria-label="Back to messages"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Avatar avatarUrl={otherAvatarUrl} displayName={otherName} size={32} />
        <h1 className="font-accent text-lg font-bold text-text truncate">{otherName}</h1>

        {/* ⋮ menu: flag the other user / delete this chat */}
        <div className="ml-auto relative shrink-0">
          <button
            type="button"
            onClick={() => setHeaderMenuOpen(o => !o)}
            className="p-1.5 rounded-md text-text/40 hover:text-text hover:bg-primary-light/50 transition-colors min-h-0 min-w-0"
            aria-label="Conversation options"
            aria-haspopup="menu"
            aria-expanded={headerMenuOpen}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {headerMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setHeaderMenuOpen(false)} />
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-card shadow-xl z-50 py-1 overflow-hidden"
              >
                {otherUserId && (
                  <button
                    className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors text-text/80 hover:bg-primary-light/50 hover:text-text"
                    onClick={() => { setFlagOpen(true); setHeaderMenuOpen(false) }}
                  >
                    <Flag className="w-3.5 h-3.5 shrink-0" /> Flag User
                  </button>
                )}
                <button
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors text-warning hover:bg-warning/10"
                  onClick={() => { setConfirmDelete(true); setHeaderMenuOpen(false) }}
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete Chat
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 py-4 space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-text/40 text-center py-8">
            No messages yet — say hi!
          </p>
        ) : (
          messages.map(m => {
            const mine = m.sender_id === currentUserId
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className="max-w-[80%] sm:max-w-[70%]">
                  <div className={cn('flex items-center gap-1.5', mine && 'justify-end')}>
                    {/* Own message: their reaction shows to the left of the bubble */}
                    {mine && m.reaction && (
                      <span className="shrink-0" title={`${otherName} reacted: ${REACTION_LABELS[m.reaction]}`}>
                        <ReactionIcon reaction={m.reaction} />
                      </span>
                    )}

                    <div
                      className={cn(
                        'px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words',
                        mine
                          ? 'bg-primary text-white rounded-br-md'
                          : 'bg-primary-light text-text rounded-bl-md'
                      )}
                    >
                      {m.body}
                    </div>

                    {/* Their message: star opens the reaction picker */}
                    {!mine && (
                      <button
                        type="button"
                        onClick={e => openPicker(m.id, e)}
                        className="p-1 rounded-full hover:bg-primary-light/60 transition-colors min-h-0 min-w-0 shrink-0"
                        aria-label={m.reaction ? `Change reaction (currently ${REACTION_LABELS[m.reaction]})` : 'React to this message'}
                      >
                        {m.reaction
                          ? <ReactionIcon reaction={m.reaction} />
                          : <Star className="w-4 h-4 text-secondary-accent" />}
                      </button>
                    )}
                  </div>

                  <p
                    className={cn(
                      'flex items-center gap-1 text-[10px] text-text/35 mt-0.5 px-1',
                      mine && 'justify-end'
                    )}
                  >
                    {mine && (
                      isReadByOther(m)
                        ? <Eye className="w-3 h-3" aria-label="Read" />
                        : <EyeOff className="w-3 h-3" aria-label="Not read yet" />
                    )}
                    {formatInTimeZone(parseISO(m.created_at), tz, timePat)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reaction picker — portalled to body and clamped to the viewport so
          it never gets cut off at the screen edges */}
      {mounted && picker && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPicker(null)} />
          <div
            style={{ position: 'fixed', top: picker.top, left: picker.left, width: PICKER_WIDTH }}
            className="z-50 flex items-center justify-between px-1.5 py-1 rounded-full border border-border bg-card shadow-xl"
          >
            {REACTION_OPTIONS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => handleReact(picker.messageId, r)}
                className={cn(
                  'p-1.5 rounded-full transition-colors min-h-0 min-w-0 hover:bg-primary-light',
                  pickerMessage?.reaction === r && 'bg-primary-light'
                )}
                aria-label={REACTION_LABELS[r]}
                title={REACTION_LABELS[r]}
              >
                <ReactionIcon reaction={r} />
              </button>
            ))}
          </div>
        </>,
        document.body
      )}

      {/* Composer */}
      <form onSubmit={handleSend} className="pt-3 border-t border-border">
        {error && <p className="text-xs text-warning mb-2">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            className="input text-sm resize-none h-16 flex-1"
            placeholder={`Message ${otherName}...`}
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
          />
          <Button
            type="submit"
            size="sm"
            loading={sending}
            disabled={!body.trim()}
            aria-label="Send message"
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {body.length >= MAX_MESSAGE_LENGTH - 100 && (
          <p className="text-[11px] text-text/40 mt-1 text-right">
            {body.length} / {MAX_MESSAGE_LENGTH}
          </p>
        )}
      </form>

      <FlagModal
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        targetType="user"
        targetId={otherUserId ?? ''}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Chat"
        message="This clears the conversation from your Messages — the other person keeps their copy. If either of you messages again, the chat comes back without the old messages."
        confirmLabel="Delete"
        onConfirm={async () => {
          setConfirmDelete(false)
          const result = await deleteConversation(conversationId)
          if (result.error) { setError(result.error); return }
          router.push('/messages')
          router.refresh()
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
