'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ChevronDown, LayoutGrid, MessageSquare, Search, SquarePen, Trash2, User } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { createClient } from '@/lib/supabase/client'
import { startConversation, deleteConversation } from '@/app/actions/messages'
import { isSampleId, sampleConversations, useSampleMode } from '@/lib/tour/sample-data'
import { cn } from '@/lib/utils'

export interface ConversationSummary {
  conversation_id: string
  other_user_id: string | null
  other_display_name: string | null
  last_message_body: string | null
  last_message_at: string | null
  last_message_sender_id: string | null
  unread_count: number
}

interface BoardMate {
  user_id: string
  display_name: string | null
  board_ids: string[]
}

interface BoardOption {
  id: string
  name: string
}

interface MessagesClientProps {
  currentUserId: string
  initialConversations: ConversationSummary[]
}

function MateRow({ member, startingWith, onStart }: {
  member: BoardMate
  startingWith: string | null
  onStart: (userId: string) => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onStart(member.user_id)}
        disabled={startingWith !== null}
        className="flex items-center gap-3 w-full text-left px-2 py-2.5 rounded-md hover:bg-primary-light/50 transition-colors disabled:opacity-60 min-h-0"
      >
        <span className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-primary" />
        </span>
        <span className="text-sm font-medium text-text flex-1 truncate">
          {member.display_name ?? 'Unnamed User'}
        </span>
        {startingWith === member.user_id && <LoadingSpinner size="sm" />}
      </button>
    </li>
  )
}

export function MessagesClient({ currentUserId, initialConversations }: MessagesClientProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [conversations, setConversations] = useState(initialConversations)

  // Two demo threads while the tour runs — one unread, one you answered last —
  // so the walkthrough has an unread badge and a "You:" preview to point at
  // even on an account with no correspondence yet. Memory only.
  const sampleMode = useSampleMode()
  const displayConversations = useMemo(
    () => (sampleMode ? [...sampleConversations(currentUserId), ...conversations] : conversations),
    [sampleMode, conversations, currentUserId]
  )

  // "Start a chat" directory
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [boardMates, setBoardMates] = useState<BoardMate[] | null>(null)
  const [search, setSearch] = useState('')
  const [startingWith, setStartingWith] = useState<string | null>(null)
  const [directoryError, setDirectoryError] = useState<string | null>(null)

  // Board filter (only shown when the user belongs to 2+ boards). null = "All
  // Boards", which groups the list by board (accordion) instead of a flat list.
  const [myBoards, setMyBoards] = useState<BoardOption[] | null>(null)
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  const [collapsedBoards, setCollapsedBoards] = useState<Set<string>>(new Set())
  const [boardFilterOpen, setBoardFilterOpen] = useState(false)

  // Chat delete (per-user hide)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const refreshList = useCallback(async () => {
    const { data } = await supabase.rpc('get_conversations')
    if (data) setConversations(data)
  }, [supabase])

  // Re-fetch on mount: Next's client-side router cache can re-serve a stale
  // page render (same root cause as the "empty chat" bug), so the server
  // props are treated as a starting point only.
  useEffect(() => {
    refreshList()
  }, [refreshList])

  // Any message change in my conversations (RLS-filtered) → refresh the list
  useEffect(() => {
    const channel = supabase
      .channel('realtime:messages:list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => refreshList()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, refreshList])

  const openDirectory = async () => {
    setDirectoryOpen(true)
    setSearch('')
    setBoardFilterOpen(false)
    setDirectoryError(null)
    if (boardMates === null) {
      const [matesRes, boardsRes] = await Promise.all([
        supabase.rpc('get_messageable_users'),
        // Only boards the user is explicitly on (hidden auto-admin rows excluded)
        supabase
          .from('user_boards')
          .select('board_id, boards(name)')
          .eq('user_id', currentUserId)
          .eq('is_approved', true)
          .eq('is_hidden', false),
      ])
      if (matesRes.error) { setDirectoryError(matesRes.error.message); return }
      setBoardMates(matesRes.data ?? [])
      const boards = (boardsRes.data ?? [])
        .map(b => ({ id: b.board_id, name: (b.boards as unknown as { name: string } | null)?.name ?? 'Board' }))
        .sort((a, b) => a.name.localeCompare(b.name))
      setMyBoards(boards)
      setSelectedBoardId(null) // default: All Boards
      setCollapsedBoards(new Set())
    }
  }

  const selectBoard = (boardId: string | null) => {
    setSelectedBoardId(boardId)
    setBoardFilterOpen(false)
  }

  const toggleBoardCollapsed = (boardId: string) => {
    setCollapsedBoards(prev => {
      const next = new Set(prev)
      if (next.has(boardId)) next.delete(boardId)
      else next.add(boardId)
      return next
    })
  }

  const boardFilterLabel = selectedBoardId === null
    ? 'All Boards'
    : myBoards?.find(b => b.id === selectedBoardId)?.name ?? 'Board'

  const handleStartChat = async (userId: string) => {
    if (startingWith) return
    setStartingWith(userId)
    setDirectoryError(null)
    const result = await startConversation(userId)
    if (result.conversationId) {
      router.push(`/messages/${result.conversationId}`)
    } else {
      setDirectoryError(result.error ?? 'Could not start the chat.')
      setStartingWith(null)
    }
  }

  // Optimistic removal; the server hides the chat for this user only
  const handleDeleteChat = async () => {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setConfirmDeleteId(null)
    setDeleteError(null)
    setConversations(prev => prev.filter(c => c.conversation_id !== id))
    const result = await deleteConversation(id)
    if (result.error) {
      setDeleteError(result.error)
      refreshList()
    } else {
      router.refresh() // update the navbar unread badge
    }
  }

  const searchedMates = (boardMates ?? []).filter(m =>
    (m.display_name ?? '').toLowerCase().includes(search.trim().toLowerCase())
  )

  // A specific board is picked → flat list scoped to it.
  const filteredMates = selectedBoardId === null
    ? searchedMates
    : searchedMates.filter(m => m.board_ids.includes(selectedBoardId))

  // "All Boards" with 2+ boards → group into a collapsible section per board
  // instead of one undifferentiated list. Boards with no matches are hidden.
  const showGroupedByBoard = selectedBoardId === null && myBoards !== null && myBoards.length > 1
  const groupedByBoard = showGroupedByBoard
    ? myBoards!
        .map(board => ({ board, members: searchedMates.filter(m => m.board_ids.includes(board.id)) }))
        .filter(group => group.members.length > 0)
    : []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-accent text-2xl font-bold text-text">Messages</h1>
        <button
          type="button"
          onClick={openDirectory}
          data-tour="msg-start"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-primary bg-primary-light hover:bg-primary-light/70 transition-colors min-h-0 min-w-0"
        >
          <SquarePen className="w-4 h-4" />
          Start a chat
        </button>
      </div>

      {deleteError && <p className="text-xs text-warning mb-2">{deleteError}</p>}

      {displayConversations.length === 0 ? (
        <div className="card text-center py-10">
          <MessageSquare className="w-8 h-8 mx-auto text-text/20 mb-3" />
          <p className="text-sm font-medium text-text/70">No conversations yet</p>
          <p className="text-xs text-text/50 mt-1 max-w-sm mx-auto">
            Use <span className="font-medium">Start a chat</span> above, or open the menu on
            someone&apos;s shift or request on the Wall and choose <span className="font-medium">Message</span>.
          </p>
        </div>
      ) : (
        <ul data-tour="msg-list" className="card divide-y divide-border p-0 overflow-hidden">
          {displayConversations.map(c => {
            const name = c.other_display_name ?? 'Former User'
            const isMine = c.last_message_sender_id === currentUserId
            const preview = c.last_message_body
              ? `${isMine ? 'You: ' : ''}${c.last_message_body}`
              : 'No messages yet'
            const unread = c.unread_count > 0
            return (
              <li
                key={c.conversation_id}
                data-tour="msg-row"
                data-tour-sample={isSampleId(c.conversation_id) ? 'true' : undefined}
                className="relative"
              >
                <Link
                  href={`/messages/${c.conversation_id}`}
                  className="flex items-center gap-3 pl-4 pr-12 py-3.5 hover:bg-primary-light/40 transition-colors"
                >
                  <span className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm truncate', unread ? 'font-bold text-text' : 'font-medium text-text/90')}>
                        {name}
                      </span>
                      {c.last_message_at && (
                        <span className="text-[11px] text-text/40 shrink-0">
                          {formatDistanceToNow(parseISO(c.last_message_at), { addSuffix: true })}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-2 mt-0.5">
                      <span className={cn('text-xs truncate', unread ? 'text-text/80 font-medium' : 'text-text/50')}>
                        {preview}
                      </span>
                      {unread && (
                        <span data-tour="msg-unread" className="flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-warning text-white text-xs font-bold leading-none shrink-0">
                          {c.unread_count > 99 ? '99+' : c.unread_count}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => { if (!isSampleId(c.conversation_id)) setConfirmDeleteId(c.conversation_id) }}
                  data-tour="msg-delete"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-text/30 hover:text-warning hover:bg-warning/10 transition-colors min-h-0 min-w-0"
                  aria-label={`Delete chat with ${name}`}
                  title="Delete chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Start-a-chat directory: everyone who shares a board with you */}
      <Modal open={directoryOpen} onClose={() => setDirectoryOpen(false)} title="Start a chat" size="sm">
        {/* Board filter — hidden when the user only belongs to one board */}
        {myBoards !== null && myBoards.length > 1 && (
          <div className="relative mb-2">
            <button
              type="button"
              onClick={() => setBoardFilterOpen(o => !o)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-text/80 hover:bg-primary-light/40 transition-colors min-h-0"
              aria-haspopup="listbox"
              aria-expanded={boardFilterOpen}
            >
              <LayoutGrid className="w-4 h-4 text-text/40 shrink-0" />
              <span className="flex-1 text-left truncate">{boardFilterLabel}</span>
              <ChevronDown className={cn('w-4 h-4 text-text/40 transition-transform', boardFilterOpen && 'rotate-180')} />
            </button>

            {boardFilterOpen && (
              <div
                role="listbox"
                className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-border bg-card shadow-xl py-1 max-h-52 overflow-y-auto"
              >
                <button
                  type="button"
                  onClick={() => selectBoard(null)}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm font-medium text-text hover:bg-primary-light/50 transition-colors min-h-0"
                >
                  <span className={cn(
                    'w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
                    selectedBoardId === null ? 'border-primary' : 'border-border'
                  )}>
                    {selectedBoardId === null && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </span>
                  All Boards
                </button>
                <div className="my-1 border-t border-border" />
                {myBoards.map(b => {
                  const checked = selectedBoardId === b.id
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => selectBoard(b.id)}
                      className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-text/80 hover:bg-primary-light/50 transition-colors min-h-0"
                    >
                      <span className={cn(
                        'w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
                        checked ? 'border-primary' : 'border-border'
                      )}>
                        {checked && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </span>
                      <span className="truncate">{b.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/30 pointer-events-none" />
          <input
            type="text"
            className="input text-sm pl-9"
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {directoryError && <p className="text-xs text-warning mb-2">{directoryError}</p>}

        <div className="max-h-72 overflow-y-auto -mx-2">
          {boardMates === null ? (
            <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
          ) : showGroupedByBoard ? (
            groupedByBoard.length === 0 ? (
              <p className="text-xs text-text/50 text-center py-6">
                {boardMates.length === 0
                  ? 'No one to message yet — you can chat with members of your boards.'
                  : 'No one matches your search.'}
              </p>
            ) : (
              <div className="space-y-1">
                {groupedByBoard.map(({ board, members }) => {
                  const collapsed = collapsedBoards.has(board.id)
                  return (
                    <div key={board.id}>
                      <button
                        type="button"
                        onClick={() => toggleBoardCollapsed(board.id)}
                        className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-text/50 hover:text-text/80 transition-colors min-h-0"
                      >
                        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', collapsed && '-rotate-90')} />
                        <span className="truncate">{board.name}</span>
                        <span className="text-text/30 normal-case font-normal">({members.length})</span>
                      </button>
                      {!collapsed && (
                        <ul>
                          {members.map(m => (
                            <MateRow key={m.user_id} member={m} startingWith={startingWith} onStart={handleStartChat} />
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          ) : filteredMates.length === 0 ? (
            <p className="text-xs text-text/50 text-center py-6">
              {boardMates.length === 0
                ? 'No one to message yet — you can chat with members of your boards.'
                : 'No one matches your search or board filter.'}
            </p>
          ) : (
            <ul>
              {filteredMates.map(m => (
                <MateRow key={m.user_id} member={m} startingWith={startingWith} onStart={handleStartChat} />
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete Chat"
        message="This clears the conversation from your Messages — the other person keeps their copy. If either of you messages again, the chat comes back without the old messages."
        confirmLabel="Delete"
        onConfirm={handleDeleteChat}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
