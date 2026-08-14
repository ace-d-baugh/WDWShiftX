'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  Settings, LayoutGrid, Users, BarChart3, Trophy, CheckCircle, Search, UserCog,
  UserMinus, Crown, UserRound, Ghost, UserX, UserCheck, MoreVertical,
  Pencil, Trash2, UserPlus, Pause, Play,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { setBoardActive, setUserActive } from '@/app/actions/admin'
import {
  removeUserFromBoard, updateBoardName, deleteBoard, regenerateInviteCode, toggleInviteCode,
} from '@/app/actions/boards'
import { InviteModal } from '@/components/features/InviteModal'
import { Input } from '@/components/ui/Input'
import { slugify } from '@/lib/slug'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Modal } from '@/components/ui/Modal'
import { BOARD_ROLE_LABEL, GLOBAL_ROLE_LABEL } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { AdminCharts, type PostStats } from './AdminCharts'
import { AdminLeaderboard } from './AdminLeaderboard'
import type { GlobalRole, BoardRole } from '@/lib/database.types'

type AdminTab = 'boards' | 'users' | 'charts' | 'leaderboard'

export interface Board {
  id: string
  name: string
  slug: string
  invite_code: string
  invite_code_enabled: boolean
  is_active: boolean
  created_at: string
  member_count: number
}

export interface UserRow {
  id: string
  display_name: string | null
  role: string
  is_active: boolean
  created_at: string
  /** Non-hidden memberships (approved + pending). 0 means a registered user
   *  who never landed on any board — the "fell through the cracks" case. */
  board_count: number
}

interface BoardMembership {
  userBoardId: string
  boardId: string
  boardName: string
  boardSlug: string
  role: BoardRole
}

interface ReassignCandidate {
  userId: string
  displayName: string
}

type RemoveTarget = {
  userBoardId: string
  boardId: string
  boardName: string
  role: BoardRole
  userId: string
  displayName: string
}

interface AdminClientProps {
  boards: Board[]
  users: UserRow[]
  adminId: string
  postStats: PostStats | null
}

/** Site role at a glance, replacing the old text badge so the row reads name-first. */
const roleIcon: Record<GlobalRole, { Icon: typeof Crown; className: string }> = {
  Admin: { Icon: Crown,     className: 'text-warning' },
  User:  { Icon: UserRound, className: 'text-primary' },
  Guest: { Icon: Ghost,     className: 'text-text/40' },
}

const boardRoleVariant: Record<BoardRole, 'user' | 'mod' | 'leader'> = {
  User: 'user', Mod: 'mod', Leader: 'leader',
}

const globalRoleOptions: GlobalRole[] = ['Guest', 'User', 'Admin']

export function AdminClient({ boards: initBoards, users: initUsers, adminId, postStats }: AdminClientProps) {
  const supabase = createClient()
  const [tab, setTab] = useState<AdminTab>('users')
  const [boards, setBoards] = useState(initBoards)
  const [users, setUsers] = useState(initUsers)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Users tab filters
  const [userSearch, setUserSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [zeroBoardsOnly, setZeroBoardsOnly] = useState(false)

  // Per-user board membership accordion
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [membershipsByUser, setMembershipsByUser] = useState<Record<string, BoardMembership[] | 'loading' | 'error'>>({})

  // Remove-from-board confirmation (with last-Admin reassignment flow)
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [needsReassignment, setNeedsReassignment] = useState(false)
  const [reassignCandidates, setReassignCandidates] = useState<ReassignCandidate[] | 'loading' | null>(null)
  const [reassignToUserId, setReassignToUserId] = useState('')

  // Boards tab: the same invite / rename / delete controls the board header on
  // /boards/[slug] offers, so the Overlord panel isn't a second, weaker UI.
  const [inviteBoard, setInviteBoard] = useState<Board | null>(null)
  const [renameBoard, setRenameBoard] = useState<{ id: string; name: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteBoardTarget, setDeleteBoardTarget] = useState<{ id: string; name: string } | null>(null)
  const [boardActionLoading, setBoardActionLoading] = useState(false)

  useEffect(() => { setRenameValue(renameBoard?.name ?? '') }, [renameBoard])

  const handleRenameBoard = async () => {
    if (!renameBoard) return
    setBoardActionLoading(true)
    const res = await updateBoardName(renameBoard.id, renameValue)
    setBoardActionLoading(false)
    if (res.error) { setError(res.error); return }
    const trimmed = renameValue.trim()
    setBoards(prev => prev.map(b => b.id === renameBoard.id ? { ...b, name: trimmed, slug: slugify(trimmed) } : b))
    setRenameBoard(null)
    showSuccess('Board renamed.')
  }

  const handleDeleteBoard = async () => {
    if (!deleteBoardTarget) return
    setBoardActionLoading(true)
    const res = await deleteBoard(deleteBoardTarget.id)
    setBoardActionLoading(false)
    if (res.error) { setError(res.error); return }
    setBoards(prev => prev.filter(b => b.id !== deleteBoardTarget.id))
    setDeleteBoardTarget(null)
    showSuccess('Board deleted.')
  }

  const handleToggleInviteCode = async (): Promise<{ error?: string }> => {
    if (!inviteBoard) return { error: 'No board selected.' }
    const next = !inviteBoard.invite_code_enabled
    const res = await toggleInviteCode(inviteBoard.id, next)
    if (res.error) return res
    setInviteBoard(prev => prev ? { ...prev, invite_code_enabled: next } : null)
    setBoards(prev => prev.map(b => b.id === inviteBoard.id ? { ...b, invite_code_enabled: next } : b))
    return {}
  }

  const handleRegenerateInvite = async (): Promise<{ code?: string; error?: string }> => {
    if (!inviteBoard) return { error: 'No board selected.' }
    const res = await regenerateInviteCode(inviteBoard.id)
    if (res.error || !res.code) return res
    setInviteBoard(prev => prev ? { ...prev, invite_code: res.code! } : null)
    setBoards(prev => prev.map(b => b.id === inviteBoard.id ? { ...b, invite_code: res.code! } : b))
    return { code: res.code }
  }

  // Row overflow menus. One piece of state for both tabs — only ever one is
  // open — positioned fixed and portalled so a card's rounded overflow can't
  // clip it (same trap ShiftCard's ⋮ menu works around).
  const [rowMenu, setRowMenu] = useState<
    { kind: 'user' | 'board'; id: string; top: number; right: number } | null
  >(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const openRowMenu = (kind: 'user' | 'board', id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setRowMenu(prev =>
      prev?.id === id && prev.kind === kind
        ? null
        : { kind, id, top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) }
    )
  }
  const closeRowMenu = () => setRowMenu(null)

  // A fixed menu can't track the button underneath it — close on any scroll,
  // matching the other ⋮ menus in the app.
  useEffect(() => {
    if (!rowMenu) return
    const close = () => setRowMenu(null)
    document.addEventListener('scroll', close, { passive: true, capture: true })
    return () => document.removeEventListener('scroll', close, { capture: true })
  }, [rowMenu])

  // Tab indicator animation
  const tabRefs = useRef<Map<AdminTab, HTMLButtonElement | null>>(new Map())
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const [indicatorReady, setIndicatorReady] = useState(false)

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  useEffect(() => {
    const measure = () => {
      const btn = tabRefs.current.get(tab)
      if (btn) {
        setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth })
        setIndicatorReady(true)
      }
    }
    measure()
    // On mobile the tab buttons themselves animate width (icon-only <->
    // icon+label+count), so this first measurement can land mid-transition.
    // Re-measure once that settles so the underline doesn't stay stranded at
    // the pre-transition position.
    const t = window.setTimeout(measure, 320)
    return () => window.clearTimeout(t)
  }, [tab])

  const zeroBoardsCount = useMemo(() => users.filter(u => u.board_count === 0).length, [users])

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (userSearch && !(u.display_name ?? '').toLowerCase().includes(userSearch.toLowerCase())) return false
      if (filterRole && u.role !== filterRole) return false
      if (zeroBoardsOnly && u.board_count !== 0) return false
      return true
    })
  }, [users, userSearch, filterRole, zeroBoardsOnly])

  const toggleBoardActive = async (id: string, current: boolean) => {
    setProcessing(id)
    const { error: e } = await setBoardActive(id, !current)
    if (e) { setError(e) } else {
      setBoards(prev => prev.map(b => b.id === id ? { ...b, is_active: !current } : b))
      showSuccess(current ? 'Board paused.' : 'Board resumed.')
    }
    setProcessing(null)
  }

  const toggleUserActive = async (id: string, current: boolean) => {
    if (id === adminId) return
    setProcessing(id)
    const { error: e } = await setUserActive(id, !current)
    if (e) { setError(e) } else {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !current } : u))
      showSuccess(current ? 'User deactivated.' : 'User reactivated.')
    }
    setProcessing(null)
  }

  const loadMemberships = async (userId: string) => {
    setMembershipsByUser(prev => ({ ...prev, [userId]: 'loading' }))
    const { data, error: e } = await supabase
      .from('user_boards')
      .select('id, board_id, role, boards(name, slug)')
      .eq('user_id', userId)
      .eq('is_approved', true)
      .eq('is_hidden', false)
    if (e || !data) {
      setMembershipsByUser(prev => ({ ...prev, [userId]: 'error' }))
      return
    }
    const list: BoardMembership[] = (data as unknown as {
      id: string; board_id: string; role: BoardRole
      boards: { name: string; slug: string } | null
    }[]).map(row => ({
      userBoardId: row.id,
      boardId: row.board_id,
      boardName: row.boards?.name ?? '',
      boardSlug: row.boards?.slug ?? '',
      role: row.role,
    }))
    setMembershipsByUser(prev => ({ ...prev, [userId]: list }))
  }

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) { next.delete(userId) } else { next.add(userId) }
      return next
    })
    if (!membershipsByUser[userId]) loadMemberships(userId)
  }

  const loadReassignCandidates = async (boardId: string, excludeUserId: string) => {
    setReassignCandidates('loading')
    const { data, error: e } = await supabase
      .from('user_boards')
      .select('user_id, users(display_name)')
      .eq('board_id', boardId)
      .eq('is_approved', true)
      .eq('is_hidden', false)
      .neq('user_id', excludeUserId)
    if (e || !data) { setReassignCandidates([]); return }
    setReassignCandidates((data as unknown as { user_id: string; users: { display_name: string | null } | null }[])
      .map(row => ({ userId: row.user_id, displayName: row.users?.display_name ?? 'Unnamed member' })))
  }

  const openRemove = (membership: BoardMembership, userId: string, displayName: string) => {
    setRemoveTarget({
      userBoardId: membership.userBoardId,
      boardId: membership.boardId,
      boardName: membership.boardName,
      role: membership.role,
      userId,
      displayName,
    })
    setRemoveError(null)
    setNeedsReassignment(false)
    setReassignCandidates(null)
    setReassignToUserId('')
  }

  const closeRemove = () => {
    setRemoveTarget(null)
    setRemoveError(null)
    setNeedsReassignment(false)
    setReassignCandidates(null)
    setReassignToUserId('')
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoveLoading(true)
    setRemoveError(null)
    const result = await removeUserFromBoard(
      removeTarget.userBoardId,
      needsReassignment ? (reassignToUserId || undefined) : undefined
    )
    setRemoveLoading(false)

    if (result.requiresReassignment) {
      setNeedsReassignment(true)
      loadReassignCandidates(removeTarget.boardId, removeTarget.userId)
      return
    }
    if (result.error) { setRemoveError(result.error); return }

    setMembershipsByUser(prev => {
      const list = prev[removeTarget.userId]
      if (!Array.isArray(list)) return prev
      return { ...prev, [removeTarget.userId]: list.filter(m => m.userBoardId !== removeTarget.userBoardId) }
    })
    // The promoted replacement's own cached membership list (if already
    // loaded elsewhere) is now stale — drop it so a re-expand refetches.
    if (needsReassignment && reassignToUserId) {
      setMembershipsByUser(prev => {
        const next = { ...prev }
        delete next[reassignToUserId]
        return next
      })
    }
    setBoards(prev => prev.map(b => b.id === removeTarget.boardId ? { ...b, member_count: Math.max(0, b.member_count - 1) } : b))
    setUsers(prev => prev.map(u => u.id === removeTarget.userId ? { ...u, board_count: Math.max(0, u.board_count - 1) } : u))
    showSuccess(`Removed ${removeTarget.displayName} from ${removeTarget.boardName}.`)
    closeRemove()
  }

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode; count: number | null }[] = [
    { key: 'boards', label: 'Boards', icon: <LayoutGrid className="w-4 h-4" />, count: boards.length },
    { key: 'users',  label: 'Users',  icon: <Users className="w-4 h-4" />,     count: users.length },
    { key: 'charts', label: 'Stats',  icon: <BarChart3 className="w-4 h-4" />, count: null },
    { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="w-4 h-4" />, count: null },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-accent text-2xl font-bold text-text flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" /> Overlord Panel
        </h1>
        <p className="text-sm text-text/60">Manage boards and users</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">
          {error}
          <button className="ml-2 underline text-xs" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-md bg-success/10 border border-success/20 text-success text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />{success}
        </div>
      )}

      {/* Tabs — on mobile, only the active tab shows its label + count; the
          rest collapse to just their icon so all four fit comfortably. The
          label+count sits in its own grid track that tweens between 0fr and
          1fr (the same width-reveal trick used for grid-rows elsewhere in
          this app), which is what makes the icon-only <-> full swap animate
          instead of snapping. Unaffected at sm+, where every tab is full. */}
      <div className="relative flex justify-between border-b border-border mb-6">
        {tabs.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              ref={el => { tabRefs.current.set(t.key, el) }}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-3 text-sm font-medium whitespace-nowrap min-h-0 transition-colors',
                'sm:flex-1 sm:justify-center sm:px-4',
                active ? 'text-primary' : 'text-text/50 hover:text-text'
              )}
            >
              {/* Icon — always visible; the zero-boards dot lives here too so
                  it stays visible even when the label collapses away. */}
              <span className="relative shrink-0 flex items-center justify-center">
                {t.icon}
                {t.key === 'users' && zeroBoardsCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-warning"
                    title={`${zeroBoardsCount} user${zeroBoardsCount === 1 ? '' : 's'} on 0 boards`}
                    aria-label={`${zeroBoardsCount} user${zeroBoardsCount === 1 ? '' : 's'} on 0 boards`}
                  />
                )}
              </span>

              <span className={cn(
                'grid transition-[grid-template-columns] duration-300 ease-spring',
                active ? 'grid-cols-[1fr]' : 'grid-cols-[0fr] sm:grid-cols-[1fr]'
              )}>
                {/* min-w-0 is load-bearing: grid items default to min-width:auto,
                    which would stop this from ever shrinking past its content. */}
                <span className="min-w-0 overflow-hidden flex items-center gap-1.5">
                  <span className="truncate">{t.label}</span>
                  {t.count !== null && (
                    <span
                      className={cn(
                        'text-xs font-bold rounded-full px-2 py-0.5 leading-none shrink-0',
                        active ? 'bg-primary text-white' : 'bg-text/10 text-text/50'
                      )}
                    >
                      {t.count}
                    </span>
                  )}
                </span>
              </span>
            </button>
          )
        })}
        <div
          className={cn('absolute bottom-0 h-0.5 bg-primary', indicatorReady && 'transition-all duration-200 ease-in-out')}
          style={{ left: indicator.left, width: indicator.width }}
        />
      </div>

      {/* Boards Tab */}
      {tab === 'boards' && (
        <div className="space-y-2">
          {boards.length === 0 ? (
            <p className="text-sm text-text/50 italic text-center py-8">No boards yet.</p>
          ) : (
            boards.map(b => (
              <div key={b.id} className="card flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                  {b.is_active ? (
                    <Link href={`/boards/${b.slug}`} className="font-medium text-text hover:text-primary hover:underline transition-colors min-h-0 min-w-0 truncate">
                      {b.name}
                    </Link>
                  ) : (
                    <p className="font-medium text-text/40 line-through truncate">{b.name}</p>
                  )}
                  <span
                    className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-[11px] font-semibold leading-none shrink-0 tabular-nums bg-primary/15 text-primary"
                    title={`${b.member_count} member${b.member_count === 1 ? '' : 's'}`}
                  >
                    {b.member_count}
                  </span>
                  {!b.is_active && <span className="badge text-xs bg-warning/20 text-warning">Inactive</span>}
                  {!b.invite_code_enabled && b.is_active && <span className="badge text-xs bg-text/10 text-text/50">Code Paused</span>}
                </div>

                {/* Mirrors the board header on /boards/[slug]: Invite and
                    rename inline from sm up, folded into the ⋮ on mobile —
                    Delete joins them there too, alongside its own always-visible
                    trash icon. Pause lives in the ⋮ only, at every size (see
                    the menu below for why). */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setInviteBoard(b)}
                    className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold bg-info text-text dark:text-[#2F2040] px-3.5 py-1.5 rounded-full leading-none hover:bg-info/80 transition-colors min-h-0 min-w-0"
                    title="Invite link & QR code"
                  >
                    <UserPlus className="w-3 h-3" /> Invite
                  </button>
                  <button
                    onClick={() => setRenameBoard({ id: b.id, name: b.name })}
                    className="hidden sm:block p-1 text-text/40 hover:text-primary min-h-0 min-w-0"
                    title="Rename board"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteBoardTarget({ id: b.id, name: b.name })}
                    className="p-1 text-text/40 hover:text-warning min-h-0 min-w-0"
                    title="Delete board"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => openRowMenu('board', b.id, e)}
                    className="p-1 rounded text-text/40 hover:text-text hover:bg-primary-light/50 transition-colors min-h-0 min-w-0"
                    aria-label="More options"
                    aria-haspopup="menu"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="p-4 bg-primary-light/40 rounded-lg space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                className="input text-sm h-9"
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
              >
                <option value="">All Roles</option>
                {globalRoleOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none" />
                <input
                  className="input pl-9 text-sm h-9"
                  placeholder="Search by name..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>
            </div>

            {zeroBoardsCount > 0 && (
              <label className="flex items-center gap-2 cursor-pointer min-h-0 w-fit">
                <Checkbox
                  checked={zeroBoardsOnly}
                  onChange={e => setZeroBoardsOnly(e.target.checked)}
                />
                <span className="text-sm text-warning font-medium">
                  Show only users with 0 boards ({zeroBoardsCount})
                </span>
              </label>
            )}
          </div>

          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-text/50 italic text-center py-8">No users match.</p>
            ) : (
              filteredUsers.map(u => {
                const isExpanded = expandedUsers.has(u.id)
                const memberships = membershipsByUser[u.id]
                const displayName = u.display_name ?? 'this user'
                return (
                  <div key={u.id} className="card">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Site role, icon-only — the label lives in the tooltip */}
                        {(() => {
                          const { Icon, className } = roleIcon[u.role as GlobalRole] ?? roleIcon.User
                          const label = GLOBAL_ROLE_LABEL[u.role as GlobalRole] ?? u.role
                          return (
                            <span role="img" aria-label={label} title={label} className="inline-flex shrink-0">
                              <Icon className={cn('w-4 h-4', className)} aria-hidden="true" />
                            </span>
                          )
                        })()}

                        <p className={cn('font-medium truncate', u.is_active ? 'text-text' : 'text-text/40 line-through')}>
                          {u.display_name ?? <span className="italic text-text/40">No display name</span>}
                        </p>

                        {/* Board count doubles as the accordion toggle — the old
                            chevron on the right did the same job twice over. */}
                        <button
                          type="button"
                          onClick={() => toggleUserExpanded(u.id)}
                          aria-expanded={isExpanded}
                          aria-label={`${u.board_count} board${u.board_count === 1 ? '' : 's'} — ${isExpanded ? 'collapse' : 'expand'}`}
                          title={u.board_count === 0 ? 'Not on any board yet' : 'Show boards'}
                          className={cn(
                            'inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full',
                            'text-[11px] font-semibold leading-none shrink-0 tabular-nums transition-colors',
                            'cursor-pointer min-h-0',
                            u.board_count === 0
                              ? 'bg-warning/20 text-warning hover:bg-warning/30'
                              : 'bg-primary/15 text-primary hover:bg-primary/25',
                            isExpanded && 'ring-1 ring-primary/40'
                          )}
                        >
                          {u.board_count}
                        </button>

                        {!u.is_active && <span className="badge text-xs bg-warning/20 text-warning shrink-0">Inactive</span>}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {u.id === adminId ? (
                          <span className="text-xs text-text/40 italic">You</span>
                        ) : (
                          <>
                            {/* Full controls from sm up; everything collapses to ⋮ below it */}
                            <Link
                              href={`/admin/users/${u.id}`}
                              className="hidden sm:flex items-center gap-1 text-xs text-primary hover:text-primary/70 px-2 py-1 rounded border border-primary/30 hover:bg-primary-light transition-colors min-h-0"
                            >
                              <UserCog className="w-3.5 h-3.5" />Edit
                            </Link>
                            <button
                              onClick={() => toggleUserActive(u.id, u.is_active)}
                              disabled={processing === u.id}
                              className={cn(
                                'badge text-xs cursor-pointer min-h-0 min-w-0 transition-colors',
                                'hidden sm:inline-flex items-center gap-1',
                                u.is_active
                                  ? 'bg-warning/20 text-warning hover:bg-warning/30'
                                  : 'bg-success/20 text-success hover:bg-success/30'
                              )}
                            >
                              {u.is_active
                                ? <><UserX className="w-3.5 h-3.5" />Deactivate</>
                                : <><UserCheck className="w-3.5 h-3.5" />Reactivate</>}
                            </button>
                            <button
                              onClick={e => openRowMenu('user', u.id, e)}
                              className="sm:hidden p-1 rounded text-text/40 hover:text-text hover:bg-primary-light/50 transition-colors min-h-0 min-w-0"
                              aria-label="More options"
                              aria-haspopup="menu"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                        {memberships === 'loading' && (
                          <p className="text-xs text-text/50 italic">Loading boards...</p>
                        )}
                        {memberships === 'error' && (
                          <p className="text-xs text-warning">Failed to load boards.</p>
                        )}
                        {Array.isArray(memberships) && memberships.length === 0 && (
                          <p className="text-xs text-text/50 italic">Not a member of any board.</p>
                        )}
                        {Array.isArray(memberships) && memberships.map(m => (
                          <div key={m.userBoardId} className="flex items-center justify-between gap-2">
                            <Link
                              href={`/boards/${m.boardSlug}`}
                              className="text-sm text-text hover:text-primary hover:underline truncate min-h-0 min-w-0"
                            >
                              {m.boardName}
                            </Link>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant={boardRoleVariant[m.role]} className="text-xs">{BOARD_ROLE_LABEL[m.role]}</Badge>
                              <button
                                onClick={() => openRemove(m, u.id, displayName)}
                                className="p-1 text-text/40 hover:text-warning min-h-0 min-w-0"
                                aria-label={`Remove ${displayName} from ${m.boardName}`}
                                title="Remove from board"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {tab === 'charts' && <AdminCharts stats={postStats} boards={boards} />}
      {tab === 'leaderboard' && <AdminLeaderboard boards={boards} />}

      {/* ── Remove-from-board confirmation / last-Admin reassignment ────── */}
      {removeTarget && (
        <Modal
          open
          onClose={closeRemove}
          size="sm"
          title={needsReassignment ? 'Promote a Replacement Admin' : 'Remove from Board?'}
        >
          {removeError && (
            <div className="mb-3 p-2.5 rounded-md bg-warning/10 border border-warning/20 text-warning text-xs">
              {removeError}
            </div>
          )}

          {!needsReassignment ? (
            <>
              <p className="text-sm text-text/70 mb-4">
                Remove <strong>{removeTarget.displayName}</strong> from <strong>{removeTarget.boardName}</strong>?
                {removeTarget.role === 'Leader' && ' They are an Admin of this board.'}{' '}
                This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={closeRemove}>Cancel</Button>
                <Button variant="danger" size="sm" loading={removeLoading} onClick={handleRemove}>Remove</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-text/70 mb-3">
                <strong>{removeTarget.displayName}</strong> is the only Admin on <strong>{removeTarget.boardName}</strong>.
                Choose another member to promote to Admin before removing them.
              </p>
              {reassignCandidates === 'loading' && (
                <p className="text-xs text-text/50 italic mb-3">Loading members...</p>
              )}
              {Array.isArray(reassignCandidates) && reassignCandidates.length === 0 && (
                <p className="text-xs text-warning mb-3">
                  No other members on this board to promote. Add another member before removing the only Admin.
                </p>
              )}
              {Array.isArray(reassignCandidates) && reassignCandidates.length > 0 && (
                <select
                  className="input text-sm mb-4"
                  value={reassignToUserId}
                  onChange={e => setReassignToUserId(e.target.value)}
                >
                  <option value="">Select a member...</option>
                  {reassignCandidates.map(c => (
                    <option key={c.userId} value={c.userId}>{c.displayName}</option>
                  ))}
                </select>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={closeRemove}>Cancel</Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={removeLoading}
                  disabled={!reassignToUserId}
                  onClick={handleRemove}
                >
                  Promote &amp; Remove
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ── Row ⋮ menus — fixed + portalled so a card can't clip them ────── */}
      {mounted && rowMenu && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={closeRowMenu} />
          <div
            role="menu"
            style={{ position: 'fixed', top: rowMenu.top, right: rowMenu.right }}
            className="w-48 rounded-lg border border-border bg-card shadow-xl z-50 py-1 overflow-hidden"
          >
            {rowMenu.kind === 'user' ? (() => {
              const u = users.find(x => x.id === rowMenu.id)
              if (!u) return null
              return (
                <>
                  <Link
                    href={`/admin/users/${u.id}`}
                    onClick={closeRowMenu}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text/80 hover:bg-primary-light/50 hover:text-text transition-colors"
                  >
                    <UserCog className="w-3.5 h-3.5 shrink-0" /> Edit
                  </Link>
                  <button
                    onClick={() => { closeRowMenu(); toggleUserActive(u.id, u.is_active) }}
                    className={cn(
                      'flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors',
                      u.is_active ? 'text-warning hover:bg-warning/10' : 'text-success hover:bg-success/10'
                    )}
                  >
                    {u.is_active
                      ? <><UserX className="w-3.5 h-3.5 shrink-0" /> Deactivate</>
                      : <><UserCheck className="w-3.5 h-3.5 shrink-0" /> Reactivate</>}
                  </button>
                </>
              )
            })() : (() => {
              const b = boards.find(x => x.id === rowMenu.id)
              if (!b) return null
              return (
                <>
                  {/* Invite, Rename and Delete are inline from sm up — here
                      for mobile only (Delete keeps its always-visible trash
                      icon too; this just gives it a second, menu-based path
                      alongside Invite and Rename). Pause lives only here, at
                      every size — it's the safety-net path, not the everyday
                      one. */}
                  <button
                    onClick={() => { closeRowMenu(); setInviteBoard(b) }}
                    className="sm:hidden flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-text/80 hover:bg-primary-light/50 hover:text-text transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5 shrink-0" /> Invite
                  </button>
                  <button
                    onClick={() => { closeRowMenu(); setRenameBoard({ id: b.id, name: b.name }) }}
                    className="sm:hidden flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-text/80 hover:bg-primary-light/50 hover:text-text transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 shrink-0" /> Rename
                  </button>
                  <button
                    onClick={() => { closeRowMenu(); toggleBoardActive(b.id, b.is_active) }}
                    className={cn(
                      'flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors',
                      b.is_active ? 'text-warning hover:bg-warning/10' : 'text-success hover:bg-success/10'
                    )}
                  >
                    {b.is_active
                      ? <><Pause className="w-3.5 h-3.5 shrink-0" /> Pause</>
                      : <><Play className="w-3.5 h-3.5 shrink-0" /> Resume</>}
                  </button>
                  <button
                    onClick={() => { closeRowMenu(); setDeleteBoardTarget({ id: b.id, name: b.name }) }}
                    className="sm:hidden flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-warning hover:bg-warning/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete
                  </button>
                </>
              )
            })()}
          </div>
        </>,
        document.body
      )}

      {/* ── Boards tab: rename ──────────────────────────────────────────── */}
      <Modal open={!!renameBoard} onClose={() => setRenameBoard(null)} title="Rename Board" size="sm">
        <div className="space-y-4">
          <Input
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRenameBoard() }}
            maxLength={32}
            autoFocus
          />
          <p className="text-xs text-warning">
            Renaming changes the board&apos;s URL, which invalidates existing invite links.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setRenameBoard(null)}>Cancel</Button>
            <Button size="sm" className="flex-1" loading={boardActionLoading} onClick={handleRenameBoard}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* ── Boards tab: delete ──────────────────────────────────────────── */}
      <Modal open={!!deleteBoardTarget} onClose={() => setDeleteBoardTarget(null)} title="Delete Board?" size="sm">
        {deleteBoardTarget && (
          <div className="space-y-4">
            <p className="text-sm text-text/70">
              You are about to permanently delete <strong>{deleteBoardTarget.name}</strong>.
            </p>
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 space-y-1.5">
              <p className="text-sm font-semibold text-warning">Every member loses access immediately.</p>
              <p className="text-xs text-text/70">
                The board, all its posts, and all comments disappear for everyone. This cannot be undone.
                To take a board out of circulation without destroying it, use Pause instead.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setDeleteBoardTarget(null)}>Cancel</Button>
              <Button variant="danger" size="sm" className="flex-1 gap-1" loading={boardActionLoading} onClick={handleDeleteBoard}>
                <Trash2 className="w-3.5 h-3.5" /> Delete for Everyone
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Boards tab: invite link & QR ────────────────────────────────── */}
      {inviteBoard && (
        <InviteModal
          open
          onClose={() => setInviteBoard(null)}
          boardName={inviteBoard.name}
          boardSlug={inviteBoard.slug}
          inviteCode={inviteBoard.invite_code}
          inviteCodeEnabled={inviteBoard.invite_code_enabled}
          isLeader
          onToggleEnabled={handleToggleInviteCode}
          onRegenerate={handleRegenerateInvite}
        />
      )}
    </div>
  )
}
