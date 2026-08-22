'use client'

import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  lookupBoardByCode, confirmJoinBoard,
  updateBoardName, toggleInviteCode, regenerateInviteCode,
  deleteBoard, leaveBoard,
} from '@/app/actions/boards'
import { Badge } from '@/components/ui/Badge'
import { BOARD_ROLE_LABEL } from '@/lib/roles'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { InviteModal } from '@/components/features/InviteModal'
import {
  LayoutGrid, X, Pencil, UserPlus, Trash2, Check,
  Users, MoreVertical,
} from 'lucide-react'
import type { BoardRole } from '@/lib/database.types'

interface BoardEntry {
  userBoardId: string
  board_id: string
  name: string
  slug: string
  role: BoardRole
  is_approved: boolean
  invite_code: string
  invite_code_enabled: boolean
}


interface MyBoardsSectionProps {
  userId: string
  /** Show the invite-code "Join a Board" input. Off by default. Many users
   * register directly instead of via an invite link and never get assigned
   * to a board — profile and onboarding both turn this on so they can join
   * with a code. Codes only ever resolve to one of WDWShiftX's two
   * pre-seeded boards, since board creation is disabled. */
  showJoin?: boolean
}

const roleVariant: Record<BoardRole, 'user' | 'mod' | 'leader'> = {
  User: 'user', Mod: 'mod', Leader: 'leader',
}

export function MyBoardsSection({ userId, showJoin = false }: MyBoardsSectionProps) {
  const supabase = createClient()
  const [boards, setBoards] = useState<BoardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Join flow
  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null)
  const [pendingJoin, setPendingJoin] = useState<{ id: string; name: string } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Code modal
  const [codeBoard, setCodeBoard] = useState<BoardEntry | null>(null)

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Leave confirm
  const [leaveId, setLeaveId] = useState<string | null>(null)
  const [leaveName, setLeaveName] = useState<string>('')
  const [leaveLoading, setLeaveLoading] = useState(false)

  // Board action menu (three-dot dropdown)
  const [menuBoard, setMenuBoard] = useState<BoardEntry | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const loadBoards = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('user_boards')
      .select('id, board_id, role, is_approved, boards(id, name, slug, invite_code_enabled)')
      .eq('user_id', userId)
      .eq('is_hidden', false)
      .order('requested_at', { ascending: true })

    // invite_code is column-locked (S8) and comes from a membership-gated
    // function. This list includes boards the user is still *pending* on, and
    // the function deliberately returns nothing for those — a pending
    // applicant reading the code was the leak being closed.
    const approvedIds = (data ?? []).filter(r => r.is_approved).map(r => r.board_id as string)
    const codes = new Map<string, string>()
    if (approvedIds.length) {
      const { data: codeRows } = await supabase
        .rpc('get_board_invite_codes', { p_board_ids: approvedIds })
      for (const r of codeRows ?? []) codes.set(r.board_id, r.invite_code)
    }

    const list = (data ?? []).map((row: {
      id: string; board_id: string; role: BoardRole; is_approved: boolean;
      boards: { id: string; name: string; slug: string; invite_code_enabled: boolean } | null
    }) => ({
      userBoardId: row.id,
      board_id: row.board_id,
      name: row.boards?.name ?? '',
      slug: row.boards?.slug ?? '',
      role: row.role,
      is_approved: row.is_approved,
      invite_code: codes.get(row.board_id) ?? '',
      invite_code_enabled: row.boards?.invite_code_enabled ?? false,
    }))
    setBoards(list)
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => { loadBoards() }, [loadBoards])

  // ── Join ──────────────────────────────────────────────────────────────────

  const handleLookup = async () => {
    // 7 = legacy codes, 10 = current. Both remain valid.
    if (joinCode.length < 7 || joinCode.length > 10) {
      setJoinError('That invite code looks wrong — check it and try again.')
      return
    }
    setJoinError(null)
    setJoinLoading(true)
    const result = await lookupBoardByCode(joinCode)
    setJoinLoading(false)
    if (result.error) { setJoinError(result.error); return }
    if (result.board) setPendingJoin(result.board)
  }

  const handleConfirmJoin = async (confirmed: boolean) => {
    if (!pendingJoin) return
    setConfirmLoading(true)
    const result = await confirmJoinBoard(pendingJoin.id, confirmed)
    setConfirmLoading(false)
    setPendingJoin(null)
    setJoinCode('')
    if (result.error) {
      setJoinError(result.error)
    } else if (confirmed) {
      setJoinSuccess(`Your request to join "${pendingJoin.name}" has been sent. A moderator will review it shortly.`)
      setTimeout(() => setJoinSuccess(null), 8000)
      await loadBoards()
    }
  }

  // ── Inline rename ─────────────────────────────────────────────────────────

  const startEdit = (board: BoardEntry) => {
    setEditingId(board.board_id)
    setEditName(board.name)
  }

  const handleRename = async (boardId: string) => {
    setEditLoading(true)
    const result = await updateBoardName(boardId, editName)
    setEditLoading(false)
    if (result.error) { setError(result.error); return }
    setEditingId(null)
    await loadBoards()
  }

  // ── Code modal ────────────────────────────────────────────────────────────

  const handleToggleCode = async (): Promise<{ error?: string }> => {
    if (!codeBoard) return {}
    const nextEnabled = !codeBoard.invite_code_enabled
    const result = await toggleInviteCode(codeBoard.board_id, nextEnabled)
    if (result.error) return result
    setCodeBoard(prev => prev ? { ...prev, invite_code_enabled: nextEnabled } : null)
    setBoards(prev => prev.map(b => b.board_id === codeBoard.board_id ? { ...b, invite_code_enabled: nextEnabled } : b))
    return result
  }

  const handleRegen = async (): Promise<{ code?: string; error?: string }> => {
    if (!codeBoard) return {}
    const result = await regenerateInviteCode(codeBoard.board_id)
    if (result.error) return result
    const newCode = result.code!
    setCodeBoard(prev => prev ? { ...prev, invite_code: newCode } : null)
    setBoards(prev => prev.map(b => b.board_id === codeBoard.board_id ? { ...b, invite_code: newCode } : b))
    return result
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    const result = await deleteBoard(deleteId)
    setDeleteLoading(false)
    if (result.error) { setError(result.error); return }
    setDeleteId(null)
    await loadBoards()
  }

  // ── Leave ─────────────────────────────────────────────────────────────────

  const handleLeave = async () => {
    if (!leaveId) return
    setLeaveLoading(true)
    const result = await leaveBoard(leaveId)
    setLeaveLoading(false)
    if (result.error) { setError(result.error); return }
    setLeaveId(null)
    await loadBoards()
  }

  const MENU_MARGIN = 8
  // Rough guess before the menu has actually rendered (item count varies by
  // role) — corrected against the real measured size in the layout effect
  // below, so this only needs to be in the ballpark.
  const ESTIMATED_MENU_WIDTH = 180
  const ESTIMATED_MENU_HEIGHT = 220

  const openBoardMenu = (board: BoardEntry, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const left = Math.min(
      Math.max(rect.right - ESTIMATED_MENU_WIDTH, MENU_MARGIN),
      window.innerWidth - ESTIMATED_MENU_WIDTH - MENU_MARGIN
    )
    const top = rect.bottom + 4 + ESTIMATED_MENU_HEIGHT > window.innerHeight
      ? Math.max(rect.top - 4 - ESTIMATED_MENU_HEIGHT, MENU_MARGIN)
      : rect.bottom + 4
    setMenuPos({ top, left })
    setMenuBoard(board)
  }
  const closeBoardMenu = () => { setMenuBoard(null); setMenuPos(null) }

  // Correct the estimate against the menu's actual rendered size, so it
  // never overflows the viewport regardless of how many items it has.
  useLayoutEffect(() => {
    if (!menuBoard || !menuRef.current) return
    const el = menuRef.current
    const rect = el.getBoundingClientRect()
    const left = Math.min(Math.max(rect.left, MENU_MARGIN), window.innerWidth - rect.width - MENU_MARGIN)
    const top = Math.min(Math.max(rect.top, MENU_MARGIN), window.innerHeight - rect.height - MENU_MARGIN)
    if (left !== rect.left || top !== rect.top) {
      setMenuPos({ top, left })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuBoard])

  const approvedBoards = boards.filter(b => b.is_approved)
  const pendingBoards  = boards.filter(b => !b.is_approved)

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">
          {error}
          <button className="ml-2 underline text-xs" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Approved board list */}
      {loading ? (
        <p className="text-sm text-text/50">Loading boards...</p>
      ) : approvedBoards.length === 0 ? (
        <p className="text-sm text-text/50">You haven&apos;t joined any boards yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {approvedBoards.map(board => (
                <tr key={board.userBoardId} className="border-b border-border last:border-0 hover:bg-primary-light/10 transition-colors">
                  {/* Board name + role cell */}
                  <td className="px-3 py-2.5">
                    {editingId === board.board_id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          className="input text-sm flex-1 h-8"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(board.board_id); if (e.key === 'Escape') setEditingId(null) }}
                          autoFocus
                        />
                        <button onClick={() => handleRename(board.board_id)} disabled={editLoading} className="p-1 text-success hover:text-success/80 min-h-0 min-w-0" aria-label="Save">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-text/40 hover:text-text min-h-0 min-w-0" aria-label="Cancel">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 min-w-0">
                        <LayoutGrid className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <Link href={`/boards/${board.slug}`} className="font-medium text-text flex-1 hover:text-primary hover:underline transition-colors min-h-0 min-w-0 truncate">
                          {board.name}
                        </Link>
                      </div>
                    )}
                  </td>

                  {/* Actions cell: role pill + three-dot menu */}
                  <td className="px-3 py-2.5 align-top">
                    {editingId !== board.board_id && (
                      <div className="flex items-center justify-end gap-2">
                        <Badge variant={roleVariant[board.role]} className="text-xs shrink-0">{BOARD_ROLE_LABEL[board.role]}</Badge>
                        <button
                          onClick={e => openBoardMenu(board, e)}
                          className="p-1 text-text/40 hover:text-primary min-h-0 min-w-0"
                          aria-label="Board actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending requests */}
      {pendingBoards.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-text/50 mb-1.5 uppercase tracking-wide">Pending Requests</p>
          <ul className="space-y-1.5">
            {pendingBoards.map(board => (
              <li key={board.userBoardId} className="flex items-center gap-2 text-sm text-text/60">
                <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate">{board.name}</span>
                <Badge variant="pending" className="text-xs">Pending</Badge>
                <button
                  onClick={() => { setLeaveId(board.board_id); setLeaveName(board.name) }}
                  className="p-1 text-text/40 hover:text-warning min-h-0 min-w-0"
                  aria-label="Withdraw request"
                  title="Withdraw request"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Join with invite code (see showJoin prop) */}
      {showJoin && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-medium text-text/50 mb-2 uppercase tracking-wide">Join a Board</p>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                className="input placeholder-text/50 text-sm uppercase tracking-widest flex-1 h-9"
                placeholder="XXXXXXX"
                maxLength={10}
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') handleLookup() }}
              />
              <Button
                size="sm"
                loading={joinLoading}
                onClick={handleLookup}
                className="h-9 min-w-[56px]"
              >
                Join
              </Button>
            </div>
            {joinError && <p className="text-xs text-warning">{joinError}</p>}
            {joinSuccess && <p className="text-xs text-success">{joinSuccess}</p>}
          </div>
        </div>
      )}

      {/* ── Board Actions Dropdown ───────────────────────────────────────── */}
      {menuBoard && menuPos && (
        <>
          <div className="fixed inset-0 z-10" onClick={closeBoardMenu} />
          <div
            ref={menuRef}
            className="fixed z-20 bg-card border border-border rounded-lg shadow-lg min-w-[160px] py-1"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <Link
              href={`/boards/${menuBoard.slug}`}
              onClick={closeBoardMenu}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-primary-light/20"
            >
              <Users className="w-3.5 h-3.5 shrink-0" /> Members
            </Link>
            <button
              onClick={() => { setCodeBoard(menuBoard); closeBoardMenu() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-primary-light/20 text-left"
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" /> Invite
            </button>
            {menuBoard.role === 'Leader' && (
              <>
                <button
                  onClick={() => { startEdit(menuBoard); closeBoardMenu() }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-primary-light/20 text-left"
                >
                  <Pencil className="w-3.5 h-3.5 shrink-0" /> Rename
                </button>
                <button
                  onClick={() => { setDeleteId(menuBoard.board_id); closeBoardMenu() }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-warning hover:bg-warning/10 text-left"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete Board
                </button>
              </>
            )}
            <div className="border-t border-border my-1" />
            <button
              onClick={() => { setLeaveId(menuBoard.board_id); setLeaveName(menuBoard.name); closeBoardMenu() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-warning hover:bg-warning/10 text-left"
            >
              <X className="w-3.5 h-3.5 shrink-0" /> Leave Board
            </button>
          </div>
        </>
      )}

      {/* ── Join Confirmation Modal ──────────────────────────────────────── */}
      {pendingJoin && (
        <Modal open onClose={() => handleConfirmJoin(false)} size="sm">
          <h3 className="font-accent font-bold text-text text-lg mb-2">Join Board?</h3>
          <p className="text-sm text-text/70 mb-6">
            Do you want to request to join <strong>&ldquo;{pendingJoin.name}&rdquo;</strong>?
            A moderator will review your request.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => handleConfirmJoin(false)} loading={confirmLoading}>
              No
            </Button>
            <Button size="sm" onClick={() => handleConfirmJoin(true)} loading={confirmLoading}>
              Yes, Request to Join
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Code Modal (Leader) ──────────────────────────────────────────── */}
      {codeBoard && (
        <InviteModal
          open
          onClose={() => setCodeBoard(null)}
          boardName={codeBoard.name}
          boardSlug={codeBoard.slug}
          inviteCode={codeBoard.invite_code}
          inviteCodeEnabled={codeBoard.invite_code_enabled}
          isLeader={codeBoard.role === 'Leader'}
          onToggleEnabled={handleToggleCode}
          onRegenerate={handleRegen}
        />
      )}

      {/* ── Leave Board Confirmation Modal ──────────────────────────────── */}
      {leaveId && (
        <Modal open onClose={() => setLeaveId(null)} size="sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-warning/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <X className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h3 className="font-accent font-bold text-text text-lg">Leave Board?</h3>
              <p className="text-sm text-text/70 mt-1">
                Are you sure you want to leave <strong>{leaveName}</strong>?
              </p>
            </div>
          </div>
          <p className="text-xs text-text/50 mb-4">
            If you are the only Leader, you must transfer ownership to another member before leaving.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setLeaveId(null)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={leaveLoading} onClick={handleLeave} className="gap-1.5">
              Leave Board
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
      {deleteId && (
        <Modal open onClose={() => setDeleteId(null)} size="sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-warning/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <Trash2 className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h3 className="font-accent font-bold text-text text-lg">Delete Board?</h3>
              <p className="text-sm text-text/70 mt-1">
                This deletes the board, all posts, and all comments.
              </p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 space-y-1.5 mb-4">
            <p className="text-sm font-semibold text-warning">Every member loses access immediately.</p>
            <p className="text-xs text-text/70">
              This is not just for you — the board disappears for everyone on it. If you no longer
              want to run it, consider{' '}
              <Link href={`/boards/${boards.find(b => b.board_id === deleteId)?.slug ?? deleteId}`} className="text-primary underline hover:text-primary/80" onClick={() => setDeleteId(null)}>
                transferring leadership
              </Link>{' '}
              to someone else instead.
            </p>
          </div>
          <p className="text-xs text-text/40 font-medium mb-4">This takes effect immediately, with no way to undo it from here.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={deleteLoading} onClick={handleDelete} className="gap-1.5">
              <Trash2 className="w-4 h-4" /> Delete for Everyone
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
