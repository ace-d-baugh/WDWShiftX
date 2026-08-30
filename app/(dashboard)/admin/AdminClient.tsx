'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Settings, LayoutGrid, Users, BarChart3, Trophy, CheckCircle, Search, UserCog,
  UserMinus, Crown, UserRound, Ghost, UserX, UserCheck, MoreVertical,
  Pencil, Trash2, UserPlus, Pause, Play, ChevronDown, SlidersHorizontal,
  ArrowDownAZ, ArrowDownZA, Activity, ShieldX, X,
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
import { Avatar } from '@/components/ui/Avatar'
import { UserLink } from '@/components/ui/UserLink'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { BOARD_ROLE_LABEL, GLOBAL_ROLE_LABEL } from '@/lib/roles'
import { cn } from '@/lib/utils'
import {
  ALPHA_GROUPING_THRESHOLD, compareStrings, groupByLetter,
  LetterSection, VerticalJumpBar, SortToggleButton, JumpPanelToggle,
} from '@/components/features/AlphaJump'
import { AdminCharts, type PostStats } from './AdminCharts'
import { AdminLeaderboard } from './AdminLeaderboard'
import type { GlobalRole, BoardRole, BoardStatus } from '@/lib/database.types'

type AdminTab = 'boards' | 'users' | 'charts' | 'leaderboard'

export interface Board {
  id: string
  name: string
  slug: string
  invite_code: string
  invite_code_enabled: boolean
  is_active: boolean
  status: BoardStatus
  created_at: string
  member_count: number
}

export interface UserRow {
  id: string
  display_name: string | null
  /** Real first/last name, captured at registration — nullable since a
   *  handful of pre-migration rows may not have been backfilled. */
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
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

const boardStatusIcon: Record<BoardStatus, { Icon: typeof Activity; className: string; label: string }> = {
  active:  { Icon: Activity, className: 'text-success', label: 'Active' },
  paused:  { Icon: Pause,    className: 'text-warning', label: 'Paused' },
  deleted: { Icon: ShieldX,  className: 'text-text/40',  label: 'Deleted' },
}

const boardStatusOptions: BoardStatus[] = ['active', 'paused', 'deleted']

// Sticky offset tiers for the Boards/Users tabs' stacked sticky elements.
// TABS sticks at top-14/104px (matching the navbar, measured height ~45px).
// FILTERS_ROW_TOP is set flush against the tabs' own bottom edge (101/149px)
// — not the same offset as the tabs (that would overlap instead of stack)
// and not a few px lower either (that leaves a gap scrolled content shows
// through).
//
// The Filters block's OWN height isn't fixed — it grows a lot when the
// panel opens, and differs between the Boards and Users tabs' controls. The
// results/jump-bar area below it reads that live height off the --filtersH
// CSS custom property (set from the ResizeObserver-measured height, see
// filtersBlockHeight) rather than a value hardcoded for the collapsed
// state, so the jump bar always starts flush under the Filters block —
// "completely visible even when filters is open" — instead of ending up
// hidden behind it. Tailwind arbitrary values can't contain literal spaces,
// hence the underscores around the calc() operators.
const FILTERS_ROW_TOP = 'top-[101px] md:top-[149px]'
const RESULTS_TOP = 'top-[calc(101px_+_var(--filtersH))] md:top-[calc(149px_+_var(--filtersH))]'
const RESULTS_MAX_HEIGHT = 'max-h-[calc(100vh_-_121px_-_var(--filtersH))] md:max-h-[calc(100vh_-_169px_-_var(--filtersH))]'
const RESULTS_SCROLL_MARGIN = 'scroll-mt-[calc(101px_+_var(--filtersH))] md:scroll-mt-[calc(149px_+_var(--filtersH))]'

/** '#' + A-Z — the jump bar and letter-section order. Always shown top-to-bottom
 *  in this fixed order regardless of sort direction, so the bar stays a stable
 *  reference the eye can find "M" on instantly rather than reflowing. */
const AZ_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const BOARD_LETTERS = ['#', ...AZ_LETTERS]

type NameFormat = 'first-last' | 'last-first'

/** The raw string sorting keys off — first or last name, falling back to
 *  display_name for any row the first_name/last_name backfill missed. */
function userSortKey(u: UserRow, format: NameFormat): string {
  if (format === 'last-first') return u.last_name || u.display_name || ''
  return u.first_name || u.display_name || ''
}

/** What the row actually shows. Uses the real first_name/last_name (fuller
 *  than display_name's privacy-trimmed "First L.") when both are present,
 *  since Overlord is exactly the surface allowed to see the whole name. */
function formatUserName(u: UserRow, format: NameFormat): string {
  if (!u.first_name && !u.last_name) return u.display_name ?? ''
  const first = u.first_name ?? ''
  const last = u.last_name ?? ''
  if (format === 'last-first') return last ? `${last}, ${first}` : first
  return [first, last].filter(Boolean).join(' ')
}

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
  const [userSort, setUserSort] = useState<'asc' | 'desc'>('asc')
  const [nameFormat, setNameFormat] = useState<NameFormat>('first-last')

  // Boards tab filters
  const [boardSearch, setBoardSearch] = useState('')
  const [boardStatusFilter, setBoardStatusFilter] = useState<'' | BoardStatus>('')
  const [boardSort, setBoardSort] = useState<'asc' | 'desc'>('asc')

  // One collapsible Filters accordion, shared by both tabs (only one is ever
  // rendered at a time, same as the Wall's single filtersOpen).
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Jump-bar panel open/closed, per tab — starts open once a tab clears
  // ALPHA_GROUPING_THRESHOLD; the toggle just lets it be tucked away.
  const [boardsJumpOpen, setBoardsJumpOpen] = useState(true)
  const [usersJumpOpen, setUsersJumpOpen] = useState(true)

  // The sticky Filters block's live height — it grows a lot when the panel
  // opens (extra inputs), and the results/jump-bar area below it needs to
  // start exactly at its bottom edge every time, not a value hardcoded for
  // the collapsed state. Measured via ResizeObserver rather than assumed,
  // since the open-state height differs by tab (Boards vs Users have
  // different filter controls) and can reflow at different breakpoints.
  const [filtersBlockHeight, setFiltersBlockHeight] = useState(0)
  const filtersResizeObserverRef = useRef<ResizeObserver | null>(null)
  const attachFiltersBlockRef = useCallback((el: HTMLDivElement | null) => {
    filtersResizeObserverRef.current?.disconnect()
    if (!el) return
    const observer = new ResizeObserver(entries => {
      setFiltersBlockHeight(entries[0].contentRect.height)
    })
    observer.observe(el)
    filtersResizeObserverRef.current = observer
  }, [])

  // Letter-section collapse, keyed "boards|A" / "users|#" so the two tabs'
  // sections never collide. Sections default open — same convention as the
  // Wall's day groups.
  const [collapsedLetters, setCollapsedLetters] = useState<Set<string>>(new Set())
  const toggleLetterCollapsed = (scope: 'boards' | 'users', letter: string) => {
    setCollapsedLetters(prev => {
      const key = `${scope}|${letter}`
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  // DOM node per letter section, so the jump bar can scroll to one directly.
  const sectionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const jumpToLetter = (scope: 'boards' | 'users', letter: string) => {
    const key = `${scope}|${letter}`
    setCollapsedLetters(prev => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    // Two frames: one for the collapse-state change to commit, one for the
    // resulting layout (a just-expanded section) to settle before measuring
    // where to scroll — same pattern the product tour uses for the same reason.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sectionRefs.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }))
  }

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
    // Soft delete — the row survives (status flips, is_active goes false) so
    // it can still appear under the Deleted status filter, unlike a hard
    // delete which would need pruning from local state entirely.
    setBoards(prev => prev.map(b => b.id === deleteBoardTarget.id ? { ...b, status: 'deleted', is_active: false } : b))
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

  // Active only — an inactive user with 0 boards isn't "fell through the
  // cracks," they're just gone. Counting them here would inflate the warning
  // pill for something nobody needs to act on.
  const zeroBoardsCount = useMemo(() => users.filter(u => u.is_active && u.board_count === 0).length, [users])
  const inactiveCount = useMemo(() => users.filter(u => !u.is_active).length, [users])
  const activeUserCount = useMemo(() => users.filter(u => u.is_active).length, [users])
  const isInactiveFilter = filterRole === 'Inactive'

  // "Boardless" is purely cosmetic while the Inactive role filter is active
  // (its own count/checked state stand in for "how many inactive users" —
  // the role filter is already doing all the real filtering here) —
  // resetting it back to a real, unchecked filter the moment you leave
  // Inactive for any other role, rather than leaving a stale checked state
  // that quietly starts filtering again.
  const prevFilterRoleRef = useRef(filterRole)
  useEffect(() => {
    if (prevFilterRoleRef.current === 'Inactive' && filterRole !== 'Inactive') {
      setZeroBoardsOnly(false)
    }
    prevFilterRoleRef.current = filterRole
  }, [filterRole])

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (userSearch && !(u.display_name ?? '').toLowerCase().includes(userSearch.toLowerCase())) return false
      if (filterRole === 'Inactive') {
        if (u.is_active) return false
      } else {
        // Default/role views are active-only — inactive users only ever
        // surface behind the explicit "Inactive" filter.
        if (!u.is_active) return false
        if (filterRole && u.role !== filterRole) return false
      }
      if (zeroBoardsOnly && filterRole !== 'Inactive' && u.board_count !== 0) return false
      return true
    })
  }, [users, userSearch, filterRole, zeroBoardsOnly])

  const usersHasActiveFilters = !!userSearch.trim() || !!filterRole || zeroBoardsOnly
  const clearUserFilters = () => { setUserSearch(''); setFilterRole(''); setZeroBoardsOnly(false) }

  // Sorted by whichever name the format toggle currently keys off, then
  // bucketed into letter sections in that same order — grouping after
  // sorting means the sections fall out already in the right order (# or Z
  // first under a reversed sort) with no separate re-ordering step.
  const sortedUsers = useMemo(
    () => [...filteredUsers].sort((a, b) => compareStrings(userSortKey(a, nameFormat), userSortKey(b, nameFormat), userSort)),
    [filteredUsers, userSort, nameFormat]
  )
  const userGroups = useMemo(
    () => groupByLetter(sortedUsers, u => userSortKey(u, nameFormat)),
    [sortedUsers, nameFormat]
  )

  const filteredBoards = useMemo(() => {
    return boards.filter(b => {
      if (boardSearch && !b.name.toLowerCase().includes(boardSearch.toLowerCase())) return false
      if (boardStatusFilter && b.status !== boardStatusFilter) return false
      return true
    })
  }, [boards, boardSearch, boardStatusFilter])

  const boardsHasActiveFilters = !!boardSearch.trim() || !!boardStatusFilter
  const clearBoardFilters = () => { setBoardSearch(''); setBoardStatusFilter('') }

  const sortedBoards = useMemo(
    () => [...filteredBoards].sort((a, b) => compareStrings(a.name, b.name, boardSort)),
    [filteredBoards, boardSort]
  )
  const boardGroups = useMemo(() => groupByLetter(sortedBoards, b => b.name), [sortedBoards])
  const showBoardJumpBar = sortedBoards.length >= ALPHA_GROUPING_THRESHOLD
  const showUserJumpBar = sortedUsers.length >= ALPHA_GROUPING_THRESHOLD

  const toggleBoardActive = async (id: string, current: boolean) => {
    setProcessing(id)
    const { error: e } = await setBoardActive(id, !current)
    if (e) { setError(e) } else {
      setBoards(prev => prev.map(b => b.id === id ? { ...b, is_active: !current, status: !current ? 'active' : 'paused' } : b))
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

  const renderBoardRow = (b: Board) => {
    const { Icon: StatusIcon, className: statusClassName, label: statusLabel } = boardStatusIcon[b.status]
    return (
      <div key={b.id} className="card flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <span role="img" aria-label={statusLabel} title={statusLabel} className="inline-flex shrink-0">
            <StatusIcon className={cn('w-4 h-4', statusClassName)} aria-hidden="true" />
          </span>
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
          {b.status === 'paused' && <span className="badge text-xs bg-warning/20 text-warning">Paused</span>}
          {b.status === 'deleted' && <span className="badge text-xs bg-text/10 text-text/50">Deleted</span>}
          {!b.invite_code_enabled && b.is_active && <span className="badge text-xs bg-text/10 text-text/50">Code Paused</span>}
        </div>

        {/* Mirrors the board header on /boards/[slug]: Invite and rename
            inline from sm up, folded into the ⋮ on mobile. Delete's icon is
            desktop-only too — on mobile it lives solely in the ⋮ menu, so
            there's exactly one way to delete a board there instead of two.
            Pause lives in the ⋮ only, at every size (see the menu below). */}
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
            className="hidden sm:block p-1 text-text/40 hover:text-warning min-h-0 min-w-0"
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
    )
  }

  const renderUserRow = (u: UserRow) => {
    const isExpanded = expandedUsers.has(u.id)
    const memberships = membershipsByUser[u.id]
    const displayName = u.display_name ?? 'this user'
    const formattedName = formatUserName(u, nameFormat)
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

            <UserLink userId={u.id} displayName={formattedName || u.display_name} currentUserId={adminId} className="flex items-center gap-2 min-w-0">
              <Avatar avatarUrl={u.avatar_url} displayName={formattedName || u.display_name} size={20} />

              <p className={cn('font-medium truncate', u.is_active ? 'text-text' : 'text-text/40 line-through')}>
                {formattedName || <span className="italic text-text/40">No display name</span>}
              </p>
            </UserLink>

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
                {u.is_active ? (
                  <button
                    onClick={() => toggleUserActive(u.id, u.is_active)}
                    disabled={processing === u.id}
                    className="badge text-xs cursor-pointer min-h-0 min-w-0 transition-colors hidden sm:inline-flex items-center gap-1 bg-warning/20 text-warning hover:bg-warning/30"
                  >
                    <UserX className="w-3.5 h-3.5" />Deactivate
                  </button>
                ) : (
                  // Always visible (not folded into sm+/⋮) — reactivating is
                  // the one action you actually want front-and-center when
                  // looking at an inactive user, not buried behind a menu.
                  <button
                    onClick={() => toggleUserActive(u.id, u.is_active)}
                    disabled={processing === u.id}
                    className="flex items-center gap-1 text-xs font-medium text-success hover:text-success/80 px-2 py-1 rounded border border-success/30 hover:bg-success/10 transition-colors min-h-0 min-w-0"
                    title="Reactivate user"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reactivate</span>
                  </button>
                )}
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
  }

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode; count: number | null }[] = [
    { key: 'boards', label: 'Boards', icon: <LayoutGrid className="w-4 h-4" />, count: boards.length },
    { key: 'users',  label: 'Users',  icon: <Users className="w-4 h-4" />,     count: activeUserCount },
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

      {/* Tabs — sticky just under the main navbar (h-14 mobile, h-16+h-10
          sub-nav = 104px desktop) so switching Boards/Users/Stats/Leaderboard
          never needs a scroll back to the top. bg-background makes it opaque
          against whatever scrolls underneath; z-30 keeps it below the navbar's
          z-50 so nothing here can float above the site chrome.
          On mobile, only the active tab shows its label + count; the rest
          collapse to just their icon so all four fit comfortably. The
          label+count sits in its own grid track that tweens between 0fr and
          1fr (the same width-reveal trick used for grid-rows elsewhere in
          this app), which is what makes the icon-only <-> full swap animate
          instead of snapping. Unaffected at sm+, where every tab is full. */}
      <div className="sticky top-14 md:top-[104px] z-30 bg-background relative flex justify-between border-b border-border mb-4">
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
        <div className="space-y-4" style={{ '--filtersH': `${filtersBlockHeight}px` } as React.CSSProperties}>
          {/* Sticky, full-width block: Filters toggle row + (when open) the
              filter controls themselves, both inside the same sticky
              container so the expanded panel stays visible on scroll too —
              not just the toggle button. The hr lives on this block's own
              bottom edge only, so there's a single clean seam below
              whichever state it's in, flush against the tabs bar above with
              no gap for scrolled content to show through. ref feeds its live
              height to --filtersH above, so the results/jump-bar area always
              starts flush under it, open or collapsed. */}
          <div ref={attachFiltersBlockRef} className={cn('sticky z-20 bg-background border-b border-border', FILTERS_ROW_TOP)}>
            <div className="py-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen(o => !o)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary min-h-0 min-w-0"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                <ChevronDown className={cn('w-4 h-4 transition-transform', filtersOpen && 'rotate-180')} />
              </button>
              <div className="flex items-center gap-3">
                {boardsHasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearBoardFilters}
                    className="inline-flex items-center gap-1 text-sm font-medium text-warning hover:text-warning/80 transition-colors min-h-0 min-w-0"
                  >
                    <X className="w-3.5 h-3.5" /> Clear Filters
                  </button>
                )}
                {showBoardJumpBar && (
                  <JumpPanelToggle open={boardsJumpOpen} onClick={() => setBoardsJumpOpen(o => !o)} />
                )}
              </div>
            </div>

            {/* Grid-rows 0fr/1fr collapse trick (same as the Wall's Filters
                and DayGroup/LetterSection) so opening/closing animates the
                panel's height instead of it just popping in and out. Stays
                mounted either way — the ResizeObserver on the outer sticky
                block picks up the animated height change frame-by-frame too,
                so the results/jump-bar area glides down/up in sync instead
                of jumping once the transition finishes. */}
            <div className={cn('grid transition-[grid-template-rows] duration-300 ease-spring', filtersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <div className="overflow-hidden">
                <div className="pb-3">
                  {/* Two sections side by side on larger screens (status |
                      search + sort), stacking on mobile. Status gets its own
                      50% column; search fills whatever's left of the other
                      50% once the fixed-width sort icon is accounted for. */}
                  <div className="p-3 bg-primary-light rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      className="input text-sm h-9"
                      value={boardStatusFilter}
                      onChange={e => setBoardStatusFilter(e.target.value as '' | BoardStatus)}
                    >
                      <option value="">All Statuses</option>
                      {boardStatusOptions.map(s => (
                        <option key={s} value={s}>{boardStatusIcon[s].label}</option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none" />
                        <input
                          className="input pl-9 text-sm h-9"
                          placeholder="Search by name..."
                          value={boardSearch}
                          onChange={e => setBoardSearch(e.target.value)}
                        />
                      </div>
                      <SortToggleButton
                        direction={boardSort}
                        onClick={() => setBoardSort(d => d === 'asc' ? 'desc' : 'asc')}
                        Icon={ArrowDownAZ}
                        ReverseIcon={ArrowDownZA}
                        showLabel={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 items-start">
            <div className="flex-1 min-w-0">
              {sortedBoards.length === 0 ? (
                <p className="text-sm text-text/50 italic text-center py-8">
                  {boards.length === 0 ? 'No boards yet.' : 'No boards match.'}
                </p>
              ) : showBoardJumpBar ? (
                <div className="space-y-3">
                  {/* boardGroups' key order already follows the current sort
                      direction (see the comment where it's built) — iterating its
                      keys directly, rather than the fixed BOARD_LETTERS array the
                      jump bar uses, is what makes Z-A actually reverse the section
                      order too, not just the rows inside each one. */}
                  {[...boardGroups.entries()].map(([letter, items]) => {
                    const sectionKey = `boards|${letter}`
                    return (
                      <LetterSection
                        key={letter}
                        sectionKey={sectionKey}
                        letter={letter}
                        count={items.length}
                        isCollapsed={collapsedLetters.has(sectionKey)}
                        onToggle={() => toggleLetterCollapsed('boards', letter)}
                        sectionRef={el => { sectionRefs.current.set(sectionKey, el) }}
                        scrollMarginClass={RESULTS_SCROLL_MARGIN}
                      >
                        {items.map(renderBoardRow)}
                      </LetterSection>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-3">{sortedBoards.map(renderBoardRow)}</div>
              )}
            </div>

            {/* Below ALPHA_GROUPING_THRESHOLD results, a jump bar has nothing
                useful to jump between — a flat list that short is faster to
                just scan than to navigate. */}
            {showBoardJumpBar && (
              <VerticalJumpBar
                letters={BOARD_LETTERS}
                groups={boardGroups}
                onJump={l => jumpToLetter('boards', l)}
                open={boardsJumpOpen}
                direction={boardSort}
                stickyTopClass={RESULTS_TOP}
                maxHeightClass={RESULTS_MAX_HEIGHT}
              />
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-4" style={{ '--filtersH': `${filtersBlockHeight}px` } as React.CSSProperties}>
          {/* Sticky, full-width block: Filters toggle row + (when open) the
              filter controls, both inside the same sticky container so the
              expanded panel stays visible on scroll too. ref feeds its live
              height to --filtersH above. */}
          <div ref={attachFiltersBlockRef} className={cn('sticky z-20 bg-background border-b border-border', FILTERS_ROW_TOP)}>
            <div className="py-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen(o => !o)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary min-h-0 min-w-0"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                <ChevronDown className={cn('w-4 h-4 transition-transform', filtersOpen && 'rotate-180')} />
              </button>
              <div className="flex items-center gap-3">
                {usersHasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearUserFilters}
                    className="inline-flex items-center gap-1 text-sm font-medium text-warning hover:text-warning/80 transition-colors min-h-0 min-w-0"
                  >
                    <X className="w-3.5 h-3.5" /> Clear Filters
                  </button>
                )}
                {showUserJumpBar && (
                  <JumpPanelToggle open={usersJumpOpen} onClick={() => setUsersJumpOpen(o => !o)} />
                )}
              </div>
            </div>

            {/* Same grid-rows 0fr/1fr collapse trick as the Boards tab and
                the Wall's Filters — animates open/close instead of popping. */}
            <div className={cn('grid transition-[grid-template-rows] duration-300 ease-spring', filtersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <div className="overflow-hidden">
                <div className="pb-3">
                  <div className="p-3 bg-primary-light rounded-lg space-y-3">
                  {/* Two sections side by side on larger screens (role select
                      | search + sort), stacking on mobile — same split as the
                      Boards tab's status/search/sort row. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      className="input text-sm h-9"
                      value={filterRole}
                      onChange={e => setFilterRole(e.target.value)}
                    >
                      <option value="">All Roles</option>
                      {globalRoleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                      <option value="Inactive">Inactive</option>
                    </select>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none" />
                        <input
                          className="input pl-9 text-sm h-9"
                          placeholder="Search by name..."
                          value={userSearch}
                          onChange={e => setUserSearch(e.target.value)}
                        />
                      </div>
                      <SortToggleButton
                        direction={userSort}
                        onClick={() => setUserSort(d => d === 'asc' ? 'desc' : 'asc')}
                        Icon={ArrowDownAZ}
                        ReverseIcon={ArrowDownZA}
                        showLabel={false}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {(zeroBoardsCount > 0 || isInactiveFilter) && (
                      <button
                        type="button"
                        onClick={() => { if (!isInactiveFilter) setZeroBoardsOnly(o => !o) }}
                        className="flex items-center gap-2 cursor-pointer min-h-0 w-fit"
                      >
                        <UserRound className={cn('w-4 h-4', (isInactiveFilter || zeroBoardsOnly) ? 'text-warning' : 'text-text/40')} />
                        <span className="text-sm text-warning font-medium">Boardless</span>
                        <span className="inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[11px] font-semibold leading-none bg-warning/20 text-warning">
                          {isInactiveFilter ? inactiveCount : zeroBoardsCount}
                        </span>
                      </button>
                    )}

                    {/* F L (sorts by first name) vs L, F (sorts by last name)
                        — changes both the sort key and how each row's name
                        renders. bg-card (not bg-primary-light — the panel
                        itself is already that color) is what actually makes
                        the selected segment visible against it, on every
                        theme. */}
                    <div className="flex items-center rounded-lg border border-border p-0.5 h-9 text-xs shrink-0 ml-auto">
                      <button
                        type="button"
                        onClick={() => setNameFormat('first-last')}
                        className={cn(
                          'px-2.5 h-full rounded-md transition-colors whitespace-nowrap min-h-0',
                          nameFormat === 'first-last' ? 'bg-card text-primary font-medium shadow-sm' : 'text-text/50 hover:text-text'
                        )}
                      >
                        F L
                      </button>
                      <button
                        type="button"
                        onClick={() => setNameFormat('last-first')}
                        className={cn(
                          'px-2.5 h-full rounded-md transition-colors whitespace-nowrap min-h-0',
                          nameFormat === 'last-first' ? 'bg-card text-primary font-medium shadow-sm' : 'text-text/50 hover:text-text'
                        )}
                      >
                        L, F
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 items-start">
            <div className="flex-1 min-w-0">
              {sortedUsers.length === 0 ? (
                <p className="text-sm text-text/50 italic text-center py-8">No users match.</p>
              ) : showUserJumpBar ? (
                <div className="space-y-3">
                  {/* userGroups' key order already follows the current sort
                      direction (see the comment where it's built) — iterating its
                      keys directly, rather than the fixed AZ_LETTERS array the
                      jump bar uses, is what makes Z-A actually reverse the section
                      order too, not just the rows inside each one. */}
                  {[...userGroups.entries()].map(([letter, items]) => {
                    const sectionKey = `users|${letter}`
                    return (
                      <LetterSection
                        key={letter}
                        sectionKey={sectionKey}
                        letter={letter}
                        count={items.length}
                        isCollapsed={collapsedLetters.has(sectionKey)}
                        onToggle={() => toggleLetterCollapsed('users', letter)}
                        sectionRef={el => { sectionRefs.current.set(sectionKey, el) }}
                        scrollMarginClass={RESULTS_SCROLL_MARGIN}
                      >
                        {items.map(renderUserRow)}
                      </LetterSection>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-3">{sortedUsers.map(renderUserRow)}</div>
              )}
            </div>

            {showUserJumpBar && (
              <VerticalJumpBar
                letters={AZ_LETTERS}
                groups={userGroups}
                onJump={l => jumpToLetter('users', l)}
                open={usersJumpOpen}
                direction={userSort}
                stickyTopClass={RESULTS_TOP}
                maxHeightClass={RESULTS_MAX_HEIGHT}
              />
            )}
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {tab === 'charts' && <AdminCharts stats={postStats} boards={boards} />}
      {tab === 'leaderboard' && <AdminLeaderboard boards={boards} currentUserId={adminId} />}

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
                  {/* Reactivate is already an always-visible row button now
                      (mobile included) — Deactivate is the one action still
                      only reachable from here on mobile. */}
                  {u.is_active && (
                    <button
                      onClick={() => { closeRowMenu(); toggleUserActive(u.id, u.is_active) }}
                      className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-warning hover:bg-warning/10 transition-colors"
                    >
                      <UserX className="w-3.5 h-3.5 shrink-0" /> Deactivate
                    </button>
                  )}
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
                      one. Hidden entirely once the board is Deleted: Resume
                      would otherwise quietly resurrect it, and the Delete
                      confirmation explicitly promises that doesn't happen
                      from this panel. */}
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
                  {b.status !== 'deleted' && (
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
                  )}
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
              You are about to delete <strong>{deleteBoardTarget.name}</strong>.
            </p>
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 space-y-1.5">
              <p className="text-sm font-semibold text-warning">Every member loses access immediately.</p>
              <p className="text-xs text-text/70">
                The board, all its posts, and all comments disappear for everyone right away. It&apos;s marked
                Deleted rather than erased, so it isn&apos;t gone for good — but there&apos;s no restore button here,
                only a direct database fix. To take a board out of circulation without that step, use Pause instead.
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
