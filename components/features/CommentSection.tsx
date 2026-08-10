'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { MessageSquare, Star, ChevronDown, User, Edit, Trash2, Flag, X, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Modal } from '@/components/ui/Modal'
import { FlagModal } from '@/components/features/FlagModal'
import { createClient } from '@/lib/supabase/client'
import { isSampleId, sampleComments } from '@/lib/tour/sample-data'
import { cn } from '@/lib/utils'
import type { CommentPostType } from '@/lib/database.types'
import { notifyInterest, notifyComment } from '@/app/actions/notifications'
import { startConversation } from '@/app/actions/messages'

const QUICK_INTEREST_BODY = "I'm interested!"

interface CommentData {
  id: string
  user_id: string | null
  display_name: string
  body: string
  is_interested: boolean
  created_at: string
  updated_at: string
}

interface CommentSectionProps {
  postType: CommentPostType
  postId: string
  isOwner: boolean
  currentUserId?: string
  commentCount: number
  interestedCount: number
  boardId?: string
  actions?: React.ReactNode
  /** Rendered first in the pill row, before Comments — shifts use this for
   * their "I'll take this" claim control (requests have no equivalent). */
  leadingAction?: React.ReactNode
  /** Accordion content shown directly under the pill row — shifts use this for
   * the owner's list of interested claimants. Caller owns the open/closed
   * state (it's driven by a pill in `leadingAction`). */
  expandedPanel?: React.ReactNode
  /** Off for shifts — "I'll take this" replaces marking interest there.
   * Requests have no claim system, so they keep it. Default true. */
  showInterest?: boolean
  /** Post owner's user id — enables the "Message" pill for non-owners */
  ownerUserId?: string | null
  openCommentsTick?: number
  interestTick?: number
  messageTick?: number
}

export function CommentSection({
  postType,
  postId,
  isOwner,
  currentUserId,
  commentCount,
  interestedCount,
  boardId,
  actions,
  leadingAction,
  expandedPanel,
  showInterest = true,
  ownerUserId,
  openCommentsTick,
  interestTick,
  messageTick,
}: CommentSectionProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [commentsOpen, setCommentsOpen] = useState(false)
  const [interestedOpen, setInterestedOpen] = useState(false)
  const [comments, setComments] = useState<CommentData[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [body, setBody] = useState('')
  const [isInterested, setIsInterested] = useState(false)
  const [replyToName, setReplyToName] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [flagCommentId, setFlagCommentId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const fetchComments = useCallback(async (): Promise<CommentData[]> => {
    // Tour demo posts exist only in memory — there is nothing to query for,
    // and asking would just return an empty thread.
    if (isSampleId(postId)) {
      const canned = sampleComments(postId)
      setComments(canned)
      return canned
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('id, user_id, body, is_interested, created_at, updated_at, users(display_name)')
        .eq('post_type', postType)
        .eq('post_id', postId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      if (error) throw error
      const mapped = (data ?? []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        user_id: c.user_id as string | null,
        display_name: (c.users as { display_name: string } | null)?.display_name ?? 'Former User',
        body: c.body as string,
        is_interested: c.is_interested as boolean,
        created_at: c.created_at as string,
        updated_at: c.updated_at as string,
      }))
      setComments(mapped)
      return mapped
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load comments.')
      return comments ?? []
    } finally {
      setLoading(false)
    }
  }, [supabase, postType, postId, comments])

  // External triggers from the three-dot card menu.
  // Deps are intentionally minimal — we only want these to fire when the tick
  // increments, not on every re-render of the other values they read.
  useEffect(() => {
    if (!openCommentsTick) return
    setCommentsOpen(true)
    if (comments === null) fetchComments() // eslint-disable-line react-hooks/exhaustive-deps
  }, [openCommentsTick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showInterest && interestTick && !isOwner && currentUserId && !posting) handleInterestedPillClick() // eslint-disable-line react-hooks/exhaustive-deps
  }, [interestTick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (messageTick && !isOwner && currentUserId && ownerUserId) handleMessage() // eslint-disable-line react-hooks/exhaustive-deps
  }, [messageTick]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleComments = () => {
    setCommentsOpen(prev => {
      const next = !prev
      if (next && comments === null) fetchComments()
      return next
    })
  }

  const toggleInterestedList = () => {
    setInterestedOpen(prev => {
      const next = !prev
      if (next && comments === null) fetchComments()
      return next
    })
  }

  // Non-owner quick action: one click registers interest via an auto-generated
  // comment, so the bottom pill is a real action and not just a duplicate of
  // the composer's "Interested?" toggle. Clicking again asks for confirmation
  // since un-marking deletes that comment.
  const handleInterestedPillClick = async () => {
    if (isOwner) {
      toggleInterestedList()
      return
    }
    if (isSampleId(postId)) return
    if (!currentUserId || posting) return
    setPosting(true)
    setError(null)
    try {
      const list = comments ?? (await fetchComments())
      const existing = list.find(
        c => c.user_id === currentUserId && c.is_interested && c.body === QUICK_INTEREST_BODY
      )
      if (existing) {
        setConfirmRemoveId(existing.id)
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('comments').insert({
        post_type: postType,
        post_id: postId,
        user_id: currentUserId,
        body: QUICK_INTEREST_BODY,
        is_interested: true,
      })
      if (error) {
        // A duplicate insert (double-click, or another tab already marked
        // interest) hits the DB's unique index — treat it as already-interested
        // rather than surfacing a raw constraint error.
        if (error.code === '23505') {
          await fetchComments()
          return
        }
        throw error
      }
      await fetchComments()
      // Fire-and-forget — notify the post owner without blocking the UI
      notifyInterest({ postId, postType })
        .catch(err => console.error('[interest] notify failed:', err))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark interested.')
    } finally {
      setPosting(false)
    }
  }

  // Open (or create) the in-app conversation with the post owner.
  // Errors (e.g. no longer sharing a board) show in the card's error area.
  const [messaging, setMessaging] = useState(false)
  const handleMessage = async () => {
    if (isSampleId(postId)) return
    if (!ownerUserId || !currentUserId || messaging) return
    setMessaging(true)
    setError(null)
    const result = await startConversation(ownerUserId)
    if (result.conversationId) {
      router.push(`/messages/${result.conversationId}`)
    } else {
      setError(result.error ?? 'Could not open the conversation.')
      setMessaging(false)
    }
  }

  const handleConfirmRemoveInterest = async () => {
    if (!confirmRemoveId) return
    await handleDelete(confirmRemoveId)
    setConfirmRemoveId(null)
  }

  const startReply = (c: CommentData) => {
    setReplyToName(c.display_name)
    setBody(`@${c.display_name} `)
    textareaRef.current?.focus()
  }

  const startEdit = (c: CommentData) => {
    setEditingId(c.id)
    setEditBody(c.body)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Nothing on a tour demo post is writable — it has no row to attach to.
    if (isSampleId(postId)) return
    if (!currentUserId || !body.trim()) return
    setPosting(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('comments').insert({
        post_type: postType,
        post_id: postId,
        user_id: currentUserId,
        body: body.trim(),
        is_interested: isOwner ? false : isInterested,
      })
      if (error) throw error
      const wasInterested = !isOwner && isInterested
      setBody('')
      setIsInterested(false)
      setReplyToName(null)
      await fetchComments()
      // Fire-and-forget notifications. An interest-marking comment pings just
      // the owner ("is interested"); a plain comment pushes the owner and
      // everyone else in the thread. Either way, never blocks the UI.
      if (wasInterested) {
        notifyInterest({ postId, postType })
          .catch(err => console.error('[interest] notify failed:', err))
      } else {
        notifyComment({ postId, postType })
          .catch(err => console.error('[comment] notify failed:', err))
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post comment.')
    } finally {
      setPosting(false)
    }
  }

  const handleSaveEdit = async (id: string) => {
    if (!editBody.trim()) return
    setPosting(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('comments').update({ body: editBody.trim() }).eq('id', id)
      if (error) throw error
      setEditingId(null)
      await fetchComments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save comment.')
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setPosting(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('comments').update({ is_active: false }).eq('id', id)
      await fetchComments()
    } finally {
      setPosting(false)
    }
  }

  const interestedUsers = useMemo(() => {
    const map = new Map<string, CommentData>()
    ;(comments ?? [])
      .filter(c => c.is_interested && c.user_id)
      .forEach(c => map.set(c.user_id as string, c))
    return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
  }, [comments])

  const displayCommentCount = comments ? comments.length : commentCount
  const displayInterestedCount = comments
    ? new Set(comments.filter(c => c.is_interested && c.user_id).map(c => c.user_id)).size
    : interestedCount

  const myInterest = !!currentUserId && (comments ?? []).some(
    c => c.user_id === currentUserId && c.is_interested && c.body === QUICK_INTEREST_BODY
  )

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-3 mt-3 border-t border-border">
        <div data-tour="card-actions" className="flex items-center gap-2">
          {leadingAction}
          <button
            type="button"
            onClick={toggleComments}
            data-tour="card-comments"
            data-tour-open={String(commentsOpen)}
            className="badge bg-text/10 text-text/70 hover:bg-primary-light cursor-pointer inline-flex items-center gap-1 transition-colors shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Comments </span>({displayCommentCount})
            <ChevronDown className={cn('w-3 h-3 transition-transform', commentsOpen && 'rotate-180')} />
          </button>
          {showInterest && (
            <button
              type="button"
              onClick={handleInterestedPillClick}
              disabled={isOwner ? false : !currentUserId || posting}
              className={cn(
                'badge inline-flex items-center gap-1 transition-colors shrink-0',
                isOwner
                  ? 'bg-secondary-accent/20 text-text hover:bg-secondary-accent/30 cursor-pointer'
                  : myInterest
                    ? 'bg-secondary-accent/20 text-text cursor-default'
                    : currentUserId
                      ? 'bg-text/10 text-text/60 hover:bg-primary-light cursor-pointer'
                      : 'bg-text/10 text-text/50 cursor-default'
              )}
            >
              {(displayInterestedCount > 0 || myInterest)
                ? <Star className="w-3.5 h-3.5 text-secondary-accent" fill="#ffea80" strokeWidth={0} />
                : <Star className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Interested </span>({displayInterestedCount})
              {isOwner && <ChevronDown className={cn('w-3 h-3 transition-transform', interestedOpen && 'rotate-180')} />}
            </button>
          )}
          {!isOwner && currentUserId && ownerUserId && (
            <button
              type="button"
              onClick={handleMessage}
              disabled={messaging}
              className="badge bg-text/10 text-text/70 hover:bg-primary-light cursor-pointer inline-flex items-center gap-1 transition-colors shrink-0 disabled:opacity-60"
              title="Message the poster"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Message</span>
            </button>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-1">
            {actions}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-warning mt-1.5">{error}</p>}

      {expandedPanel}

      {showInterest && interestedOpen && isOwner && (
        <div className="mt-3 p-3 bg-primary-light/40 rounded-lg">
          {loading && comments === null ? (
            <div className="flex justify-center py-2"><LoadingSpinner size="sm" /></div>
          ) : interestedUsers.length === 0 ? (
            <p className="text-xs text-text/50">No one has marked interest yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {interestedUsers.map(u => (
                <li key={u.user_id} className="flex items-center gap-2 text-sm text-text">
                  <Star className="w-3.5 h-3.5 text-secondary-accent shrink-0" fill="#ffea80" strokeWidth={0} />
                  {u.display_name}
                  <span className="text-xs text-text/40">{formatDistanceToNow(parseISO(u.created_at), { addSuffix: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Mounted even while closed: driver.js resolves a step's target before
          running that step's hooks, so the tour can only expand this section if
          it is already in the DOM. Renders nothing until it is opened. */}
      <div data-tour="card-comments-panel">
        {commentsOpen && (
          <div className="mt-3 space-y-3">
            {currentUserId && (
              <form onSubmit={handleSubmit} className="space-y-2">
                {replyToName && (
                  <div className="flex items-center gap-2 text-xs text-text/50">
                    Replying to <span className="font-medium text-text">{replyToName}</span>
                    <button
                      type="button"
                      onClick={() => { setReplyToName(null); setBody('') }}
                      className="text-text/40 hover:text-warning"
                      aria-label="Cancel reply"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  className="input text-sm resize-none h-16"
                  placeholder="Write a comment..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  maxLength={500}
                />
                <div className="flex items-center justify-between gap-2">
                  {!isOwner && showInterest ? (
                    <button
                      type="button"
                      onClick={() => setIsInterested(v => !v)}
                      className={cn(
                        'badge inline-flex items-center gap-1 cursor-pointer transition-colors',
                        isInterested ? 'bg-secondary-accent/30 text-text' : 'bg-text/10 text-text/60'
                      )}
                    >
                      {isInterested
                        ? <Star className="w-3 h-3 text-secondary-accent" fill="#ffea80" strokeWidth={0} />
                        : <Star className="w-3 h-3" />} Interested?
                    </button>
                  ) : <span />}
                  <Button
                    type="submit"
                    size="sm"
                    loading={posting}
                    disabled={!body.trim()}
                    className="text-xs px-3 py-1 min-h-0 h-8"
                  >
                    Submit
                  </Button>
                </div>
              </form>
            )}

            {loading && comments === null ? (
              <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>
            ) : (comments ?? []).length === 0 ? (
              <p className="text-xs text-text/40 text-center py-2">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {(comments ?? []).map(c => (
                  <li key={c.id} className="text-sm border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-text/50 flex-wrap">
                        <User className="w-3 h-3" />
                        <span className="font-medium text-text">{c.display_name}</span>
                        {c.is_interested && (
                          <span className="inline-flex items-center gap-0.5 text-primary">
                            <Star className="w-3 h-3 text-secondary-accent" fill="#ffea80" strokeWidth={0} /> Interested
                          </span>
                        )}
                        <span>&bull; {formatDistanceToNow(parseISO(c.created_at), { addSuffix: true })}</span>
                        {c.updated_at !== c.created_at && <span>(edited)</span>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {currentUserId && c.user_id !== currentUserId && (
                          <button
                            type="button"
                            onClick={() => setFlagCommentId(c.id)}
                            className="text-text/30 hover:text-warning"
                            aria-label="Flag comment"
                          >
                            <Flag className="w-3 h-3" />
                          </button>
                        )}
                        {c.user_id === currentUserId && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(c)}
                              className="text-text/30 hover:text-primary"
                              aria-label="Edit comment"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              className="text-text/30 hover:text-warning"
                              aria-label="Delete comment"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {editingId === c.id ? (
                      <div className="mt-1 space-y-1.5">
                        <textarea
                          className="input text-sm resize-none h-14"
                          value={editBody}
                          onChange={e => setEditBody(e.target.value)}
                          maxLength={500}
                        />
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            loading={posting}
                            onClick={() => handleSaveEdit(c.id)}
                            className="text-xs px-2 py-1 min-h-0 h-7"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                            className="text-xs px-2 py-1 min-h-0 h-7"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-text/80 mt-1">{c.body}</p>
                    )}

                    {currentUserId && editingId !== c.id && (
                      <button
                        type="button"
                        onClick={() => startReply(c)}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        Reply
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <FlagModal
        open={flagCommentId !== null}
        onClose={() => setFlagCommentId(null)}
        targetType="comment"
        targetId={flagCommentId ?? ''}
        boardId={boardId}
      />

      <Modal open={confirmRemoveId !== null} onClose={() => setConfirmRemoveId(null)} title="Remove interest?" size="sm">
        <p className="text-sm text-text/70 mb-4">
          This will delete your &quot;{QUICK_INTEREST_BODY}&quot; comment and remove your interest from this post.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirmRemoveId(null)} className="flex-1">
            Cancel
          </Button>
          <Button type="button" variant="danger" loading={posting} onClick={handleConfirmRemoveInterest} className="flex-1">
            Remove
          </Button>
        </div>
      </Modal>
    </>
  )
}
