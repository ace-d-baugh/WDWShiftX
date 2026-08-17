'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users, Crown, Award, UserRound, LayoutGrid, ChevronDown, MoreHorizontal, MoreVertical,
  Pencil, Trash2, Check, X, MessageSquare, Search,
  ArrowDownAZ, ArrowDownZA,
  LogOut, UserMinus, Flag, UserCog, UserPlus, AlertTriangle,
} from 'lucide-react'
import { BOARD_ROLE_LABEL } from '@/lib/roles'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FlagModal } from '@/components/features/FlagModal'
import { InviteModal } from '@/components/features/InviteModal'
import { cn } from '@/lib/utils'
import {
  ALPHA_GROUPING_THRESHOLD, compareStrings, groupByLetter,
  LetterSection, VerticalJumpBar, SortToggleButton, JumpPanelToggle,
} from '@/components/features/AlphaJump'
import {
  updateUserBoardRole, transferBoardOwnership,
  removeUserFromBoard, leaveBoard,
  updateBoardName, deleteBoard, regenerateInviteCode, toggleInviteCode,
} from '@/app/actions/boards'
import { startConversation } from '@/app/actions/messages'
import type { BoardRole } from '@/lib/database.types'
import type { ManagedBoard, BoardMember } from './types'

/** Role at a glance before the name, replacing the old text badge —
 *  Overlord panel's roleIcon does the same for site roles. */
const boardRoleIcon: Record<BoardRole, { Icon: typeof Crown; className: string }> = {
  Leader: { Icon: Crown,     className: 'text-warning' },
  Mod:    { Icon: Award,     className: 'text-info' },
  User:   { Icon: UserRound, className: 'text-primary' },
}

const AZ_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// Sticky offset tiers for each board card's header/search-row/results stack.
// The page-level board-list search row (when boards.length > 1) sticks first,
// at the top (56/104px, ~52px tall — flush bottom edge 108/156px). Everything
// below it — a board's own header (~49px tall), then that board's own
// member-search row (~52px tall), then its results/jump-bar — is offset to
// sit flush against the sticky edge directly above it, not the same offset
// (they'd land on top of each other) and not a few px lower either (that
// leaves a gap scrolled content shows through). On /boards/[slug] there's
// only ever one board, so the page-level row never renders and everything
// shifts up a tier ("solo").
const HEADER_TOP = { withPageSearch: 'top-[108px] md:top-[156px]', solo: 'top-14 md:top-[104px]' }
const MEMBER_SEARCH_TOP = { withPageSearch: 'top-[157px] md:top-[205px]', solo: 'top-[105px] md:top-[153px]' }
const MEMBER_RESULTS_TOP = { withPageSearch: 'top-[209px] md:top-[257px]', solo: 'top-[157px] md:top-[205px]' }
const MEMBER_RESULTS_MAX_HEIGHT = {
  withPageSearch: 'max-h-[calc(100vh-229px)] md:max-h-[calc(100vh-277px)]',
  solo: 'max-h-[calc(100vh-177px)] md:max-h-[calc(100vh-225px)]',
}
const MEMBER_SCROLL_MARGIN = {
  withPageSearch: 'scroll-mt-[209px] md:scroll-mt-[257px]',
  solo: 'scroll-mt-[157px] md:scroll-mt-[205px]',
}

interface UsersClientProps {
  managedBoards: ManagedBoard[]
  currentUserId: string
  isAdmin: boolean
  /** Present on the single-board view (/boards/[slug]) — turns the "My
   *  Boards" heading into a link back to the full list, since that page
   *  otherwise offers no way back to it. */
  backHref?: string
}

type ChangeRoleTarget = { member: BoardMember; boardId: string; myRole: BoardRole }
type Confirm = { boardId: string; boardName: string }
type RemoveTarget = { member: BoardMember; boardId: string }
type FlagTarget = { userId: string; boardId: string }

export function BoardsClient({ managedBoards: initial, currentUserId, isAdmin, backHref }: UsersClientProps) {
  const router = useRouter()
  const [boards, setBoards] = useState(initial)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [openMenuFor, setOpenMenuFor] = useState<{ id: string; top: number; right: number } | null>(null)

  // Modals / confirmations
  const [changeRoleTarget, setChangeRoleTarget] = useState<ChangeRoleTarget | null>(null)
  const [selectedRole, setSelectedRole] = useState<'User' | 'Mod'>('User')
  const [leaveConfirm, setLeaveConfirm] = useState<Confirm | null>(null)
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null)
  const [flagTarget, setFlagTarget] = useState<FlagTarget | null>(null)
  const [transferTarget, setTransferTarget] = useState<{ member: BoardMember; boardId: string } | null>(null)

  // Admin/Leader board management
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editBoardName, setEditBoardName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<Confirm | null>(null)

  // Invite modal
  const [inviteBoard, setInviteBoard] = useState<ManagedBoard | null>(null)

  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null)

  // ── Board-list filters (search/sort across the boards themselves — only
  // meaningful once there's more than one to sift through) ───────────────────
  const [boardListSearch, setBoardListSearch] = useState('')
  const [boardListSort, setBoardListSort] = useState<'asc' | 'desc'>('asc')
  const [boardListJumpOpen, setBoardListJumpOpen] = useState(true)

  // ── Per-board member filters (search/sort within one board's roster) ──────
  const [memberSearch, setMemberSearch] = useState<Record<string, string>>({})
  const [memberSort, setMemberSort] = useState<Record<string, 'asc' | 'desc'>>({})
  const [memberJumpOpen, setMemberJumpOpen] = useState<Record<string, boolean>>({})

  // Letter-section collapse + jump targets, shared by the board list and
  // every board's member list — keyed "boardlist|A" / "members:<id>|A" so
  // none of them collide. Same grid-rows collapse pattern as the Wall.
  const [collapsedLetters, setCollapsedLetters] = useState<Set<string>>(new Set())
  const sectionRefs = useState(() => new Map<string, HTMLDivElement | null>())[0]
  const toggleLetterCollapsed = (scope: string, letter: string) => {
    setCollapsedLetters(prev => {
      const key = `${scope}|${letter}`
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  const jumpToLetter = (scope: string, letter: string) => {
    const key = `${scope}|${letter}`
    setCollapsedLetters(prev => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sectionRefs.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }))
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const patchMembers = (boardId: string, fn: (m: BoardMember[]) => BoardMember[]) =>
    setBoards(prev => prev.map(b => b.boardId === boardId ? { ...b, members: fn(b.members) } : b))

  const closeMenu = () => setOpenMenuFor(null)

  const toggleMenu = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (openMenuFor?.id === id) { closeMenu(); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setOpenMenuFor({ id, top: rect.bottom + 4, right: window.innerWidth - rect.right })
  }

  // Board-header overflow menu (mobile). Kept separate from the member-row menu
  // above, which is keyed on userBoardId — one id space per menu.
  const [boardMenu, setBoardMenu] = useState<{ id: string; top: number; right: number } | null>(null)
  const closeBoardMenu = () => setBoardMenu(null)

  const openBoardMenu = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (boardMenu?.id === id) { closeBoardMenu(); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setBoardMenu({ id, top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) })
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleMessage = async (userId: string) => {
    if (messagingUserId) return
    closeMenu()
    setMessagingUserId(userId)
    setError(null)
    const result = await startConversation(userId)
    setMessagingUserId(null)
    if (result.conversationId) {
      router.push(`/messages/${result.conversationId}`)
    } else {
      setError(result.error ?? 'Could not open the conversation.')
    }
  }

  const openChangeRole = (member: BoardMember, boardId: string, myRole: BoardRole) => {
    closeMenu()
    setSelectedRole(member.role === 'Leader' ? 'Mod' : member.role as 'User' | 'Mod')
    setChangeRoleTarget({ member, boardId, myRole })
  }

  const handleChangeRole = async () => {
    if (!changeRoleTarget) return
    setActionLoading('role')
    setError(null)

    // If promoting to Leader that's a transfer
    if (selectedRole !== 'User' && selectedRole !== 'Mod') {
      // shouldn't happen but guard
      setActionLoading(null); return
    }

    const result = await updateUserBoardRole(changeRoleTarget.member.userBoardId, selectedRole)
    setActionLoading(null)
    if (result.error) { setError(result.error); return }
    patchMembers(changeRoleTarget.boardId, ms =>
      ms.map(m => m.userBoardId === changeRoleTarget.member.userBoardId ? { ...m, role: selectedRole } : m)
    )
    setChangeRoleTarget(null)
  }

  const handleRemoveUser = async () => {
    if (!removeTarget) return
    setActionLoading('remove')
    setError(null)
    const result = await removeUserFromBoard(removeTarget.member.userBoardId)
    setActionLoading(null)
    if (result.error) { setError(result.error); return }
    patchMembers(removeTarget.boardId, ms => ms.filter(m => m.userBoardId !== removeTarget.member.userBoardId))
    setRemoveTarget(null)
  }

  const handleLeaveBoard = async () => {
    if (!leaveConfirm) return
    setActionLoading('leave')
    setError(null)
    const result = await leaveBoard(leaveConfirm.boardId)
    setActionLoading(null)
    if (result.error) { setError(result.error); return }
    setBoards(prev => prev.filter(b => b.boardId !== leaveConfirm.boardId))
    setLeaveConfirm(null)
  }

  const handleTransfer = async () => {
    if (!transferTarget) return
    setActionLoading('transfer')
    setError(null)
    const result = await transferBoardOwnership(transferTarget.boardId, transferTarget.member.userId)
    setActionLoading(null)
    if (result.error) { setError(result.error); return }
    patchMembers(transferTarget.boardId, ms => ms.map(m => {
      if (m.userId === currentUserId) return { ...m, role: 'Mod' as BoardRole }
      if (m.userId === transferTarget.member.userId) return { ...m, role: 'Leader' as BoardRole }
      return m
    }))
    setBoards(prev => prev.map(b =>
      b.boardId === transferTarget.boardId ? { ...b, myRole: 'Mod' as BoardRole } : b
    ))
    setTransferTarget(null)
  }

  const startEditBoard = (boardId: string, name: string) => {
    setEditingBoardId(boardId)
    setEditBoardName(name)
  }

  const handleRenameBoard = async (boardId: string) => {
    setActionLoading('rename-' + boardId)
    const result = await updateBoardName(boardId, editBoardName)
    setActionLoading(null)
    if (result.error) { setError(result.error); return }
    // Slug changes with name — update local state so invite URL stays correct
    const newSlug = editBoardName.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    setBoards(prev => prev.map(b => b.boardId === boardId ? { ...b, boardName: editBoardName.trim(), boardSlug: newSlug } : b))
    setEditingBoardId(null)
  }

  const handleRegenCode = async (): Promise<{ code?: string; error?: string }> => {
    if (!inviteBoard) return {}
    const result = await regenerateInviteCode(inviteBoard.boardId)
    if (result.error) return result
    const newCode = result.code!
    setBoards(prev => prev.map(b => b.boardId === inviteBoard.boardId ? { ...b, inviteCode: newCode } : b))
    setInviteBoard(prev => prev ? { ...prev, inviteCode: newCode } : null)
    return result
  }

  const handleToggleInviteCode = async (): Promise<{ error?: string }> => {
    if (!inviteBoard) return {}
    const nextEnabled = !inviteBoard.inviteCodeEnabled
    const result = await toggleInviteCode(inviteBoard.boardId, nextEnabled)
    if (result.error) return result
    setBoards(prev => prev.map(b => b.boardId === inviteBoard.boardId ? { ...b, inviteCodeEnabled: nextEnabled } : b))
    setInviteBoard(prev => prev ? { ...prev, inviteCodeEnabled: nextEnabled } : null)
    return result
  }

  const handleDeleteBoard = async () => {
    if (!deleteConfirm) return
    setActionLoading('delete')
    const result = await deleteBoard(deleteConfirm.boardId)
    setActionLoading(null)
    if (result.error) { setError(result.error); return }
    setBoards(prev => prev.filter(b => b.boardId !== deleteConfirm.boardId))
    setDeleteConfirm(null)
  }

  const toggleCollapsed = (boardId: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(boardId)) next.delete(boardId); else next.add(boardId)
      return next
    })

  // ── Board-list filtering/sorting/sectioning ───────────────────────────────

  const filteredTopBoards = boards.filter(b =>
    !boardListSearch || b.boardName.toLowerCase().includes(boardListSearch.toLowerCase())
  )
  const sortedTopBoards = [...filteredTopBoards].sort((a, b) => compareStrings(a.boardName, b.boardName, boardListSort))
  const boardListGroups = groupByLetter(sortedTopBoards, b => b.boardName)
  const showBoardListJumpBar = sortedTopBoards.length >= ALPHA_GROUPING_THRESHOLD

  // ── Render: one board's member row ────────────────────────────────────────

  const renderMemberRow = (board: ManagedBoard, member: BoardMember, rowIdx: number) => {
    const isMe = member.userId === currentUserId
    const myRole = board.myRole
    const canChangeRole = !isMe && (myRole === 'Leader' || myRole === 'Mod' || isAdmin) && member.role !== 'Leader'
    const canRemove = !isMe && (myRole === 'Leader' || isAdmin)
    const canFlag = !isMe && (myRole === 'Mod' || myRole === 'User')
    const menuId = member.userBoardId
    const hasMenu = isMe || canFlag || canChangeRole || canRemove || (myRole === 'Leader' && member.role !== 'Leader')

    // Mods, Leaders, and site Admins only — approver identity isn't
    // something a plain member needs (or should) see.
    const canSeeApprover = myRole === 'Leader' || myRole === 'Mod' || isAdmin

    return (
      // Grid row rather than a <table> or flex — each letter section renders
      // its own separate table/flex context, so column widths driven purely
      // by that section's own content used to land at a different x-position
      // in every section. Explicit grid tracks fix the menu column's
      // position outright; the name and approved-by tracks are equal
      // minmax(0,1fr) shares, which is what actually puts the approved-by
      // column at a consistent, centered position between the two rather
      // than wherever flex's content-driven sizing happened to leave it. The
      // approved-by track only exists sm+ (and only when canSeeApprover) —
      // on mobile it's `hidden` (display:none), so the 2-column template
      // avoids reserving dead space where a 3-column one would.
      <div
        key={member.userBoardId}
        className={cn(
          'grid items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-primary-light/20 transition-colors',
          canSeeApprover
            ? 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'
            : 'grid-cols-[minmax(0,1fr)_auto]',
          rowIdx % 2 === 0 ? 'bg-card dark:bg-primary-light/5' : 'bg-primary-light/5 dark:bg-card'
        )}
      >
        {/* Role icon + name — icon replaces the old text badge, Overlord-panel
            style (role at a glance before the name reads name-first). */}
        <div className="flex items-center gap-2 min-w-0">
          {(() => {
            const { Icon, className } = boardRoleIcon[member.role]
            const label = BOARD_ROLE_LABEL[member.role]
            return (
              <span role="img" aria-label={label} title={label} className="inline-flex shrink-0">
                <Icon className={cn('w-4 h-4', className)} aria-hidden="true" />
              </span>
            )
          })()}
          <span className="font-medium text-text truncate">
            {member.displayName ?? <span className="italic text-text/40">No name</span>}
          </span>
          {isMe && <span className="ml-1.5 text-xs text-text/40 shrink-0">(you)</span>}
        </div>

        {/* Approved by */}
        {canSeeApprover && (
          <div className="hidden sm:block min-w-0 text-left text-xs text-text/40 truncate">
            {member.approvedBy ?? <span className="italic">—</span>}
          </div>
        )}

        {/* Three-dots menu */}
        <div className="flex justify-end">
          {hasMenu && (
            <button
              onClick={e => toggleMenu(menuId, e)}
              className="p-1 rounded text-text/40 hover:text-text hover:bg-primary-light/50 transition-colors min-h-0 min-w-0"
              aria-label="Options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Render: one board card (header + filters + member table) ─────────────

  const renderBoardCard = (board: ManagedBoard) => {
    const isCollapsed = collapsed.has(board.boardId)
    const isRenaming = editingBoardId === board.boardId
    const canRename = isAdmin || board.myRole === 'Leader'
    const canDelete = isAdmin

    const search = memberSearch[board.boardId] ?? ''
    const sort = memberSort[board.boardId] ?? 'asc'
    const jumpOpen = memberJumpOpen[board.boardId] ?? true
    const filteredMembers = board.members.filter(m =>
      !search || (m.displayName ?? '').toLowerCase().includes(search.toLowerCase())
    )
    const sortedMembers = [...filteredMembers].sort((a, b) =>
      compareStrings(a.displayName ?? '', b.displayName ?? '', sort)
    )
    const memberGroups = groupByLetter(sortedMembers, m => m.displayName ?? '')
    const showMemberJumpBar = sortedMembers.length >= ALPHA_GROUPING_THRESHOLD
    const memberScope = `members:${board.boardId}`
    const tier = boards.length > 1 ? 'withPageSearch' : 'solo'

    return (
      <div key={board.boardId}>

        {/* ── Board header — sticky while scrolling this board's members, so
            it's always clear which board you're looking at. Carries its own
            complete border (top/sides/bottom) and rounded-top corners rather
            than relying on an outer wrapper's (that border stays behind at
            the card's original position once this header is stuck
            elsewhere, so it'd otherwise vanish the moment the header pins).
            The outer wrapper above intentionally has NO border of its own —
            a border-x running its full height would run straight past the
            header's rounded top corners and visibly poke out past the
            curve, since a plain vertical line doesn't know to follow a
            border-radius. Every bordered edge below the header instead
            lives on the body wrapper further down, which only exists (and
            only starts drawing its border) below the header's own bottom
            edge. overflow-hidden here (for the rounded-top clip) is safe on
            the sticky element itself — it only breaks sticky for
            descendants, and this header has none. Two background layers: a
            solid one blocks the member rows from showing through while
            stuck, with the original translucent tint painted on top of it
            for the same look at rest. */}
        <div className={cn('sticky isolate z-20 overflow-hidden rounded-t-xl border-t border-x border-border', HEADER_TOP[tier])}>
          <div className="absolute inset-0 bg-card" />
          <div className="absolute inset-0 bg-primary-light/30" />
          <div className="relative flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <LayoutGrid className="w-4 h-4 text-primary shrink-0" />

          {/* Board name / inline rename */}
          {isRenaming ? (
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <input
                  className="input text-sm h-8 flex-1"
                  value={editBoardName}
                  onChange={e => setEditBoardName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameBoard(board.boardId)
                    if (e.key === 'Escape') setEditingBoardId(null)
                  }}
                  autoFocus
                />
                <button onClick={() => handleRenameBoard(board.boardId)} disabled={actionLoading === 'rename-' + board.boardId} className="p-1 text-success hover:text-success/80 min-h-0 min-w-0"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingBoardId(null)} className="p-1 text-text/40 hover:text-text min-h-0 min-w-0"><X className="w-4 h-4" /></button>
              </div>
              {board.inviteCodeEnabled && (
                <p className="text-[11px] text-warning flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  Renaming invalidates existing invite links — get a new link after saving.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Link
                href={`/boards/${board.boardSlug}`}
                className="font-accent font-bold text-text text-sm truncate hover:text-primary hover:underline"
              >
                {board.boardName}
              </Link>
              {/* Member count pill */}
              <span className="text-[11px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full shrink-0 leading-none">
                {board.members.length}
              </span>
            </div>
          )}

          {/* Right side controls — Invite/Rename/Delete inline from sm up,
              folded into the ⋮ on mobile so there's exactly one path to each
              action per breakpoint instead of two. */}
          {!isRenaming && (
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <button
                onClick={() => setInviteBoard(board)}
                className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold bg-info text-text dark:text-[#2F2040] px-3.5 py-1.5 rounded-full leading-none hover:bg-info/80 transition-colors min-h-0 min-w-0"
                title="Invite link & QR code"
              >
                <UserPlus className="w-3 h-3" /> Invite
              </button>
              {canRename && (
                <button onClick={() => startEditBoard(board.boardId, board.boardName)} className="hidden sm:block p-1 text-text/40 hover:text-primary min-h-0 min-w-0" title="Rename board"><Pencil className="w-3.5 h-3.5" /></button>
              )}
              {canDelete && (
                <button onClick={() => setDeleteConfirm({ boardId: board.boardId, boardName: board.boardName })} className="hidden sm:block p-1 text-text/40 hover:text-warning min-h-0 min-w-0" title="Delete board"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
              <button
                onClick={e => openBoardMenu(board.boardId, e)}
                className="sm:hidden p-1 rounded text-text/40 hover:text-text hover:bg-primary-light/50 transition-colors min-h-0 min-w-0"
                aria-label="Board options"
                aria-haspopup="menu"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Collapse chevron */}
          <button
            type="button"
            onClick={() => toggleCollapsed(board.boardId)}
            className="p-1 text-text/40 hover:text-text min-h-0 min-w-0 shrink-0"
            aria-expanded={!isCollapsed}
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform duration-300 ease-spring', !isCollapsed && 'rotate-180')} />
          </button>
          </div>
        </div>

        {/* ── Body: sticky search/sort/jump-toggle row + table. Shown/hidden
            by plain conditional render rather than the grid-rows height
            animation used elsewhere — that trick needs overflow-hidden on
            the vertical axis to clip mid-animation, which also disables
            position:sticky for everything inside it (the search row and
            the jump bar both need to stay sticky while scrolling). ──── */}
        {!isCollapsed && (
          <div className="rounded-b-xl border-x border-b border-border">
            {board.members.length > 1 && (
              <div className={cn('sticky isolate z-10 px-4 py-2 bg-background flex items-center gap-2', MEMBER_SEARCH_TOP[tier])}>
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none" />
                  <input
                    className="input pl-9 text-sm h-9"
                    placeholder="Search members..."
                    value={search}
                    onChange={e => setMemberSearch(prev => ({ ...prev, [board.boardId]: e.target.value }))}
                  />
                </div>
                <SortToggleButton
                  direction={sort}
                  onClick={() => setMemberSort(prev => ({ ...prev, [board.boardId]: sort === 'asc' ? 'desc' : 'asc' }))}
                  Icon={ArrowDownAZ}
                  ReverseIcon={ArrowDownZA}
                  showLabel={false}
                />
                {showMemberJumpBar && (
                  <JumpPanelToggle
                    open={jumpOpen}
                    onClick={() => setMemberJumpOpen(prev => ({ ...prev, [board.boardId]: !jumpOpen }))}
                  />
                )}
              </div>
            )}

            <div className="flex gap-1.5 items-start p-3">
              <div className="flex-1 min-w-0">
                {sortedMembers.length === 0 ? (
                  <p className="text-xs text-text/50 italic text-center py-4">No members match.</p>
                ) : showMemberJumpBar ? (
                  <div className="space-y-2">
                    {[...memberGroups.entries()].map(([letter, items]) => {
                      const sectionKey = `${memberScope}|${letter}`
                      return (
                        <LetterSection
                          key={letter}
                          sectionKey={sectionKey}
                          letter={letter}
                          count={items.length}
                          isCollapsed={collapsedLetters.has(sectionKey)}
                          onToggle={() => toggleLetterCollapsed(memberScope, letter)}
                          sectionRef={el => { sectionRefs.set(sectionKey, el) }}
                          scrollMarginClass={MEMBER_SCROLL_MARGIN[tier]}
                        >
                          <div className="text-sm">
                            {items.map((m, i) => renderMemberRow(board, m, i))}
                          </div>
                        </LetterSection>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm">
                    {sortedMembers.map((m, i) => renderMemberRow(board, m, i))}
                  </div>
                )}
              </div>
              {showMemberJumpBar && (
                <VerticalJumpBar
                  letters={AZ_LETTERS}
                  groups={memberGroups}
                  onJump={l => jumpToLetter(memberScope, l)}
                  open={jumpOpen}
                  stickyTopClass={MEMBER_RESULTS_TOP[tier]}
                  maxHeightClass={MEMBER_RESULTS_MAX_HEIGHT[tier]}
                />
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-accent text-2xl font-bold text-text flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          {backHref ? (
            <Link href={backHref} className="hover:text-primary hover:underline transition-colors">My Boards</Link>
          ) : 'My Boards'}
        </h1>
        <p className="text-sm text-text/60">View and manage members of your boards</p>

        {/* Key for the role icons that replaced the old text badges in each
            member row — Leader/Mod/User in the same order they're defined
            in boardRoleIcon. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
          {(Object.keys(boardRoleIcon) as BoardRole[]).map(role => {
            const { Icon, className } = boardRoleIcon[role]
            return (
              <span key={role} className="inline-flex items-center gap-1.5 text-xs text-text/50">
                <Icon className={cn('w-3.5 h-3.5', className)} />
                {BOARD_ROLE_LABEL[role]}
              </span>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Backdrop — closes the fixed-position menu on outside click */}
      {openMenuFor && (
        <div className="fixed inset-0 z-40" onClick={closeMenu} />
      )}

      {/* Board-header ⋮ (mobile): Invite always; Rename for Admins/Leaders;
          Delete for Admins only — the same permission split the inline
          sm+ icons use. */}
      {boardMenu && (() => {
        const board = boards.find(b => b.boardId === boardMenu.id)
        if (!board) return null
        const canRename = isAdmin || board.myRole === 'Leader'
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={closeBoardMenu} />
            <div
              role="menu"
              style={{ position: 'fixed', top: boardMenu.top, right: boardMenu.right }}
              className="w-44 rounded-lg border border-border bg-card shadow-xl z-50 py-1 overflow-hidden"
            >
              <button
                onClick={() => { closeBoardMenu(); setInviteBoard(board) }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-text/80 hover:bg-primary-light/50 hover:text-text transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" /> Invite
              </button>
              {canRename && (
                <button
                  onClick={() => { closeBoardMenu(); startEditBoard(board.boardId, board.boardName) }}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-text/80 hover:bg-primary-light/50 hover:text-text transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 shrink-0" /> Rename Board
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => { closeBoardMenu(); setDeleteConfirm({ boardId: board.boardId, boardName: board.boardName }) }}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-warning hover:bg-warning/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete Board
                </button>
              )}
            </div>
          </>
        )
      })()}

      {boards.length === 0 ? (
        <p className="text-sm text-text/50 italic">No boards to manage.</p>
      ) : (
        <div className="space-y-6">
          {/* Sticky search/sort/jump-toggle row — only worth showing once
              there's more than one board to sift through. */}
          {/* z-30 on the row below — strictly above every board header's
              z-20, so a header scrolling into its own sticky position never
              paints over this row (it must always stay the topmost tier). */}
          {boards.length > 1 && (
            <div className="sticky isolate top-14 md:top-[104px] z-30 bg-background py-2 -my-2 flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none" />
                <input
                  className="input pl-9 text-sm h-9"
                  placeholder="Search boards..."
                  value={boardListSearch}
                  onChange={e => setBoardListSearch(e.target.value)}
                />
              </div>
              <SortToggleButton
                direction={boardListSort}
                onClick={() => setBoardListSort(d => d === 'asc' ? 'desc' : 'asc')}
                Icon={ArrowDownAZ}
                ReverseIcon={ArrowDownZA}
                showLabel={false}
              />
              {showBoardListJumpBar && (
                <JumpPanelToggle open={boardListJumpOpen} onClick={() => setBoardListJumpOpen(o => !o)} />
              )}
            </div>
          )}

          <div className="flex gap-2 items-start">
            <div className="flex-1 min-w-0">
              {sortedTopBoards.length === 0 ? (
                <p className="text-sm text-text/50 italic text-center py-8">No boards match.</p>
              ) : showBoardListJumpBar ? (
                <div className="space-y-6">
                  {[...boardListGroups.entries()].map(([letter, items]) => {
                    const sectionKey = `boardlist|${letter}`
                    return (
                      <LetterSection
                        key={letter}
                        sectionKey={sectionKey}
                        letter={letter}
                        count={items.length}
                        isCollapsed={collapsedLetters.has(sectionKey)}
                        onToggle={() => toggleLetterCollapsed('boardlist', letter)}
                        sectionRef={el => { sectionRefs.set(sectionKey, el) }}
                        scrollMarginClass="scroll-mt-[100px] md:scroll-mt-[150px]"
                      >
                        <div className="space-y-6">{items.map(renderBoardCard)}</div>
                      </LetterSection>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-6">{sortedTopBoards.map(renderBoardCard)}</div>
              )}
            </div>

            {showBoardListJumpBar && (
              <VerticalJumpBar
                letters={AZ_LETTERS}
                groups={boardListGroups}
                onJump={l => jumpToLetter('boardlist', l)}
                open={boardListJumpOpen}
                stickyTopClass="top-[100px] md:top-[150px]"
                maxHeightClass="max-h-[calc(100vh-120px)] md:max-h-[calc(100vh-170px)]"
              />
            )}
          </div>
        </div>
      )}

      {/* ── Change Role Modal ────────────────────────────────────────────────── */}
      <Modal
        open={!!changeRoleTarget}
        onClose={() => setChangeRoleTarget(null)}
        title="Change Role"
        size="sm"
      >
        {changeRoleTarget && (
          <div className="space-y-4">
            <p className="text-sm text-text/70">
              Changing role for <strong>{changeRoleTarget.member.displayName ?? 'this member'}</strong>
            </p>
            <div className="space-y-2">
              {(['User', 'Mod'] as const).map(r => (
                <label key={r} className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors min-h-0 select-none" style={{ borderColor: selectedRole === r ? 'hsl(var(--color-primary))' : 'hsl(var(--color-border))' }}>
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={selectedRole === r}
                    onChange={() => setSelectedRole(r)}
                    className="min-h-0 min-w-0 h-4 w-4"
                  />
                  <div>
                    <p className="text-sm font-medium text-text">{r}</p>
                    <p className="text-xs text-text/50">
                      {r === 'User' ? 'Can post and interact on the board' : 'Can approve members and manage flags'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setChangeRoleTarget(null)}>Cancel</Button>
              <Button size="sm" className="flex-1" loading={actionLoading === 'role'} onClick={handleChangeRole}>Confirm</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Leave Confirm Modal ──────────────────────────────────────────────── */}
      <Modal
        open={!!leaveConfirm}
        onClose={() => setLeaveConfirm(null)}
        title="Leave Board?"
        size="sm"
      >
        {leaveConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-text/70">
              Are you sure you want to leave <strong>{leaveConfirm.boardName}</strong>? If you are the only Admin, you must transfer ownership first.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setLeaveConfirm(null)}>Cancel</Button>
              <Button variant="danger" size="sm" className="flex-1" loading={actionLoading === 'leave'} onClick={handleLeaveBoard}>Leave</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Remove User Confirm ──────────────────────────────────────────────── */}
      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove Member?"
        size="sm"
      >
        {removeTarget && (
          <div className="space-y-4">
            <p className="text-sm text-text/70">
              Remove <strong>{removeTarget.member.displayName ?? 'this member'}</strong> from the board? They can rejoin with an invite code.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setRemoveTarget(null)}>Cancel</Button>
              <Button variant="danger" size="sm" className="flex-1" loading={actionLoading === 'remove'} onClick={handleRemoveUser}>Remove</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Transfer Ownership Confirm ───────────────────────────────────────── */}
      <Modal
        open={!!transferTarget}
        onClose={() => setTransferTarget(null)}
        title="Transfer Ownership?"
        size="sm"
      >
        {transferTarget && (
          <div className="space-y-4">
            <p className="text-sm text-text/70">
              Make <strong>{transferTarget.member.displayName ?? 'this member'}</strong> the new board Admin? You will become a Mod.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setTransferTarget(null)}>Cancel</Button>
              <Button size="sm" className="flex-1 gap-1 bg-warning text-white hover:bg-warning/90" loading={actionLoading === 'transfer'} onClick={handleTransfer}>
                <Crown className="w-3.5 h-3.5" /> Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Board Confirm (Admins only) ───────────────────────────────── */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Board?"
        size="sm"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-text/70">
              You are about to delete <strong>{deleteConfirm.boardName}</strong>.
            </p>
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 space-y-1.5">
              <p className="text-sm font-semibold text-warning">Every member loses access immediately.</p>
              <p className="text-xs text-text/70">
                The board, all its posts, and all comments disappear for everyone — not just you — right away,
                and there&apos;s no way to bring it back from here.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" size="sm" className="flex-1 gap-1" loading={actionLoading === 'delete'} onClick={handleDeleteBoard}>
                <Trash2 className="w-3.5 h-3.5" /> Delete for Everyone
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Fixed-position three-dots menu (outside overflow-hidden containers) */}
      {openMenuFor && (() => {
        const items = boards.flatMap(b => b.members).find(m => m.userBoardId === openMenuFor.id)
        const board = boards.find(b => b.members.some(m => m.userBoardId === openMenuFor.id))
        if (!items || !board) return null
        const isMe = items.userId === currentUserId
        const myRole = board.myRole
        type MenuItem = { label: string; icon: React.ComponentType<{ className?: string }>; action: () => void; danger?: boolean }
        const menuItems: MenuItem[] = []
        if (isMe) {
          menuItems.push({ label: 'Leave Board', icon: LogOut, danger: true, action: () => { closeMenu(); setLeaveConfirm({ boardId: board.boardId, boardName: board.boardName }) } })
        } else {
          const canFlag = !isMe && (myRole === 'Mod' || myRole === 'User')
          const canChangeRole = !isMe && (myRole === 'Leader' || myRole === 'Mod' || isAdmin) && items.role !== 'Leader'
          const canRemove = !isMe && (myRole === 'Leader' || isAdmin)
          menuItems.push({ label: 'Message', icon: MessageSquare, action: () => handleMessage(items.userId) })
          if (canFlag) menuItems.push({ label: 'Flag User', icon: Flag, action: () => { closeMenu(); setFlagTarget({ userId: items.userId, boardId: board.boardId }) } })
          if (canChangeRole) menuItems.push({ label: 'Change Role', icon: UserCog, action: () => openChangeRole(items, board.boardId, myRole) })
          if (canRemove) menuItems.push({ label: 'Remove User', icon: UserMinus, danger: true, action: () => { closeMenu(); setRemoveTarget({ member: items, boardId: board.boardId }) } })
          if (myRole === 'Leader' && items.role !== 'Leader') menuItems.push({ label: 'Transfer Ownership', icon: Crown, action: () => { closeMenu(); setTransferTarget({ member: items, boardId: board.boardId }) } })
        }
        return (
          <div
            style={{ position: 'fixed', top: openMenuFor.top, right: openMenuFor.right }}
            className="w-44 rounded-lg border border-border bg-card shadow-xl z-50 py-1 overflow-hidden"
          >
            {menuItems.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  onClick={item.action}
                  className={cn(
                    'flex items-center gap-2 w-full text-left px-3 py-2 text-sm transition-colors',
                    item.danger
                      ? 'text-warning hover:bg-warning/10'
                      : 'text-text/80 hover:bg-primary-light/50 hover:text-text'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {item.label}
                </button>
              )
            })}
          </div>
        )
      })()}

      {/* ── Flag User Modal ──────────────────────────────────────────────────── */}
      <FlagModal
        open={!!flagTarget}
        onClose={() => setFlagTarget(null)}
        targetType="user"
        targetId={flagTarget?.userId ?? ''}
        boardId={flagTarget?.boardId}
      />

      {/* ── Invite Modal ──────────────────────────────────────────────────────── */}
      {inviteBoard && (
        <InviteModal
          open
          onClose={() => setInviteBoard(null)}
          boardName={inviteBoard.boardName}
          boardSlug={inviteBoard.boardSlug}
          inviteCode={inviteBoard.inviteCode}
          inviteCodeEnabled={inviteBoard.inviteCodeEnabled}
          isLeader={inviteBoard.myRole === 'Leader' || isAdmin}
          onToggleEnabled={handleToggleInviteCode}
          onRegenerate={handleRegenCode}
        />
      )}
    </div>
  )
}
