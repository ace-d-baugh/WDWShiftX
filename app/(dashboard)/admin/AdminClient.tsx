'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { Settings, LayoutGrid, Users, BarChart3, CheckCircle, Search, UserCog, ChevronDown, UserMinus } from 'lucide-react'
import { setBoardActive, setUserActive } from '@/app/actions/admin'
import { removeUserFromBoard } from '@/app/actions/boards'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { BOARD_ROLE_LABEL } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { AdminCharts, type PostStats } from './AdminCharts'
import type { GlobalRole, BoardRole } from '@/lib/database.types'

type AdminTab = 'boards' | 'users' | 'charts'

interface Board {
  id: string
  name: string
  slug: string
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

const roleVariant: Record<GlobalRole, 'guest' | 'user' | 'admin'> = {
  Guest: 'guest', User: 'user', Admin: 'admin',
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

  // Tab indicator animation
  const tabRefs = useRef<Map<AdminTab, HTMLButtonElement | null>>(new Map())
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const [indicatorReady, setIndicatorReady] = useState(false)

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  useEffect(() => {
    const btn = tabRefs.current.get(tab)
    if (btn) {
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth })
      setIndicatorReady(true)
    }
  }, [tab])

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (userSearch && !(u.display_name ?? '').toLowerCase().includes(userSearch.toLowerCase())) return false
      if (filterRole && u.role !== filterRole) return false
      return true
    })
  }, [users, userSearch, filterRole])

  const toggleBoardActive = async (id: string, current: boolean) => {
    setProcessing(id)
    const { error: e } = await setBoardActive(id, !current)
    if (e) { setError(e) } else {
      setBoards(prev => prev.map(b => b.id === id ? { ...b, is_active: !current } : b))
      showSuccess(current ? 'Board deactivated.' : 'Board reactivated.')
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
    showSuccess(`Removed ${removeTarget.displayName} from ${removeTarget.boardName}.`)
    closeRemove()
  }

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode; count: number | null }[] = [
    { key: 'boards', label: 'Boards', icon: <LayoutGrid className="w-4 h-4" />, count: boards.length },
    { key: 'users',  label: 'Users',  icon: <Users className="w-4 h-4" />,     count: users.length },
    { key: 'charts', label: 'Stats',  icon: <BarChart3 className="w-4 h-4" />, count: null },
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

      {/* Tabs */}
      <div className="relative flex border-b border-border mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            ref={el => { tabRefs.current.set(t.key, el) }}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap min-h-0 min-w-0 transition-colors flex-1 justify-center',
              tab === t.key ? 'text-primary' : 'text-text/50 hover:text-text'
            )}
          >
            {t.icon}{t.label}
            {t.count !== null && (
              <span
                className={cn(
                  'text-xs font-bold rounded-full px-2 py-0.5 leading-none',
                  tab === t.key ? 'bg-primary text-white' : 'bg-text/10 text-text/50'
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
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
              <div key={b.id} className="card flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    {b.is_active ? (
                      <Link href={`/boards/${b.slug}`} className="font-medium text-text hover:text-primary hover:underline transition-colors min-h-0 min-w-0">
                        {b.name}
                      </Link>
                    ) : (
                      <p className="font-medium text-text/40 line-through">{b.name}</p>
                    )}
                    <span className="badge text-xs bg-primary/10 text-primary shrink-0">
                      {b.member_count} {b.member_count === 1 ? 'member' : 'members'}
                    </span>
                    {!b.is_active && <span className="badge text-xs bg-warning/20 text-warning">Inactive</span>}
                    {!b.invite_code_enabled && b.is_active && <span className="badge text-xs bg-text/10 text-text/50">Code Paused</span>}
                  </div>
                  <p className="text-xs text-text/40">{new Date(b.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => toggleBoardActive(b.id, b.is_active)}
                  disabled={processing === b.id}
                  className={cn(
                    'badge text-xs cursor-pointer min-h-0 min-w-0 transition-colors shrink-0',
                    b.is_active
                      ? 'bg-warning/20 text-warning hover:bg-warning/30'
                      : 'bg-success/20 text-success hover:bg-success/30'
                  )}
                >
                  {b.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
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
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn('font-medium', u.is_active ? 'text-text' : 'text-text/40 line-through')}>
                            {u.display_name ?? <span className="italic text-text/40">No display name</span>}
                          </p>
                          <Badge variant={roleVariant[u.role as GlobalRole] ?? 'user'}>{u.role}</Badge>
                          {!u.is_active && <span className="badge text-xs bg-warning/20 text-warning">Inactive</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {u.id !== adminId && (
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/70 px-2 py-1 rounded border border-primary/30 hover:bg-primary-light transition-colors min-h-0"
                          >
                            <UserCog className="w-3.5 h-3.5" />Edit
                          </Link>
                        )}
                        {u.id !== adminId ? (
                          <button
                            onClick={() => toggleUserActive(u.id, u.is_active)}
                            disabled={processing === u.id}
                            className={cn(
                              'badge text-xs cursor-pointer min-h-0 min-w-0 transition-colors',
                              u.is_active
                                ? 'bg-warning/20 text-warning hover:bg-warning/30'
                                : 'bg-success/20 text-success hover:bg-success/30'
                            )}
                          >
                            {u.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        ) : (
                          <span className="text-xs text-text/40 italic">You</span>
                        )}
                        <button
                          onClick={() => toggleUserExpanded(u.id)}
                          className="p-1 text-text/40 hover:text-primary min-h-0 min-w-0"
                          aria-label={isExpanded ? 'Collapse boards' : 'Show boards'}
                          aria-expanded={isExpanded}
                        >
                          <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
                        </button>
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
      {tab === 'charts' && <AdminCharts stats={postStats} />}

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
    </div>
  )
}
