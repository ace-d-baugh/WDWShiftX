'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LayoutGrid, MoreHorizontal, MessageSquare, UserCog, UserMinus, Crown, UserPlus,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { BOARD_ROLE_LABEL } from '@/lib/roles'
import {
  adminAddUserToBoard, adminTransferBoardOwnership,
  updateUserBoardRole, removeUserFromBoard,
} from '@/app/actions/boards'
import { startConversation } from '@/app/actions/messages'
import type { BoardRole } from '@/lib/database.types'

export interface Membership {
  userBoardId: string
  boardId: string
  boardName: string
  boardSlug: string
  role: BoardRole
  isApproved: boolean
}

export interface AvailableBoard {
  id: string
  name: string
  slug: string
}

const roleVariant: Record<BoardRole, 'user' | 'mod' | 'leader'> = {
  User: 'user', Mod: 'mod', Leader: 'leader',
}

interface Props {
  targetUserId: string
  initialMemberships: Membership[]
  initialAvailableBoards: AvailableBoard[]
}

export function UserBoardsSection({ targetUserId, initialMemberships, initialAvailableBoards }: Props) {
  const router = useRouter()
  const [memberships, setMemberships] = useState<Membership[]>(initialMemberships)
  const [available, setAvailable] = useState<AvailableBoard[]>(initialAvailableBoards)

  const [addBoardId, setAddBoardId] = useState('')
  const [addRole, setAddRole] = useState<BoardRole>('User')
  const [adding, setAdding] = useState(false)

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [messaging, setMessaging] = useState(false)

  // Modals
  const [roleTarget, setRoleTarget] = useState<Membership | null>(null)
  const [selectedRole, setSelectedRole] = useState<'User' | 'Mod'>('User')
  const [removeTarget, setRemoveTarget] = useState<Membership | null>(null)
  const [transferTarget, setTransferTarget] = useState<Membership | null>(null)

  const closeMenu = () => setOpenMenu(null)

  const handleAdd = async () => {
    if (!addBoardId) return
    setAdding(true)
    setError(null)
    const board = available.find(b => b.id === addBoardId)
    const result = await adminAddUserToBoard(targetUserId, addBoardId, addRole)
    setAdding(false)
    if (result.error || !result.userBoardId) { setError(result.error ?? 'Could not add to board.'); return }
    if (board) {
      setMemberships(prev => [...prev, {
        userBoardId: result.userBoardId!,
        boardId: board.id,
        boardName: board.name,
        boardSlug: board.slug,
        role: addRole,
        isApproved: true,
      }].sort((a, b) => a.boardName.localeCompare(b.boardName)))
      setAvailable(prev => prev.filter(b => b.id !== addBoardId))
    }
    setAddBoardId('')
    setAddRole('User')
  }

  const handleMessage = async () => {
    if (messaging) return
    closeMenu()
    setMessaging(true)
    setError(null)
    const res = await startConversation(targetUserId)
    setMessaging(false)
    if (res.conversationId) router.push(`/messages/${res.conversationId}`)
    else setError(res.error ?? 'Could not open the conversation.')
  }

  const openRoleModal = (m: Membership) => {
    closeMenu()
    setSelectedRole(m.role === 'Leader' ? 'Mod' : (m.role as 'User' | 'Mod'))
    setRoleTarget(m)
  }

  const handleChangeRole = async () => {
    if (!roleTarget) return
    setBusy('role')
    setError(null)
    const result = await updateUserBoardRole(roleTarget.userBoardId, selectedRole)
    setBusy(null)
    if (result.error) { setError(result.error); return }
    setMemberships(prev => prev.map(m =>
      m.userBoardId === roleTarget.userBoardId ? { ...m, role: selectedRole } : m
    ))
    setRoleTarget(null)
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setBusy('remove')
    setError(null)
    const result = await removeUserFromBoard(removeTarget.userBoardId)
    setBusy(null)
    if (result.error) { setError(result.error); return }
    setMemberships(prev => prev.filter(m => m.userBoardId !== removeTarget.userBoardId))
    setAvailable(prev => [...prev, {
      id: removeTarget.boardId, name: removeTarget.boardName, slug: removeTarget.boardSlug,
    }].sort((a, b) => a.name.localeCompare(b.name)))
    setRemoveTarget(null)
  }

  const handleTransfer = async () => {
    if (!transferTarget) return
    setBusy('transfer')
    setError(null)
    const result = await adminTransferBoardOwnership(transferTarget.boardId, targetUserId)
    setBusy(null)
    if (result.error) { setError(result.error); return }
    setMemberships(prev => prev.map(m =>
      m.userBoardId === transferTarget.userBoardId ? { ...m, role: 'Leader' as BoardRole } : m
    ))
    setTransferTarget(null)
  }

  return (
    <div>
      <label className="block text-xs font-medium text-text/60 mb-2">User Boards</label>

      {error && (
        <div className="mb-3 p-2.5 rounded-md bg-warning/10 border border-warning/20 text-warning text-xs flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Add user to a board */}
      <div className="rounded-lg border border-border p-3 mb-3">
        <p className="text-xs font-semibold text-text mb-2 flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5 text-primary" /> Add user to a board
        </p>
        {available.length === 0 ? (
          <p className="text-xs text-text/50 italic">This user is already on every board.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="input text-sm flex-1"
              value={addBoardId}
              onChange={e => setAddBoardId(e.target.value)}
            >
              <option value="">Select a board…</option>
              {available.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select
              className="input text-sm sm:w-32"
              value={addRole}
              onChange={e => setAddRole(e.target.value as BoardRole)}
              aria-label="Board role"
            >
              {(['User', 'Mod', 'Leader'] as BoardRole[]).map(r => (
                <option key={r} value={r}>{BOARD_ROLE_LABEL[r]}</option>
              ))}
            </select>
            <Button size="sm" onClick={handleAdd} loading={adding} disabled={!addBoardId} className="gap-1.5 shrink-0">
              <UserPlus className="w-4 h-4" /> Add to Board
            </Button>
          </div>
        )}
      </div>

      {/* Membership list */}
      {memberships.length === 0 ? (
        <p className="text-xs text-text/50 italic">Not a member of any board yet.</p>
      ) : (
        <>
          {openMenu && <div className="fixed inset-0 z-40" onClick={closeMenu} />}
          <ul className="rounded-lg border border-border divide-y divide-border overflow-visible">
            {memberships.map(m => (
              <li key={m.userBoardId} className="flex items-center gap-2 px-3 py-2.5">
                <LayoutGrid className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/boards/${m.boardSlug}`}
                    className="text-sm font-medium text-text hover:text-primary hover:underline truncate"
                  >
                    {m.boardName}
                  </Link>
                  {!m.isApproved && (
                    <span className="ml-1.5 text-[10px] font-semibold bg-warning/15 text-warning px-1.5 py-0.5 rounded-full">Pending</span>
                  )}
                </div>
                <Badge variant={roleVariant[m.role]} className="text-xs shrink-0">{BOARD_ROLE_LABEL[m.role]}</Badge>

                <div className="relative shrink-0">
                  <button
                    onClick={() => setOpenMenu(openMenu === m.userBoardId ? null : m.userBoardId)}
                    className="p-1 rounded text-text/40 hover:text-text hover:bg-primary-light/50 transition-colors min-h-0 min-w-0"
                    aria-label="Options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {openMenu === m.userBoardId && (
                    <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-card shadow-xl z-50 py-1">
                      <MenuItem icon={MessageSquare} label="Message" onClick={handleMessage} />
                      {m.role !== 'Leader' && (
                        <MenuItem icon={UserCog} label="Change Role" onClick={() => openRoleModal(m)} />
                      )}
                      <MenuItem icon={UserMinus} label="Remove from Board" danger onClick={() => { closeMenu(); setRemoveTarget(m) }} />
                      {m.role !== 'Leader' && (
                        <MenuItem icon={Crown} label="Transfer Ownership" onClick={() => { closeMenu(); setTransferTarget(m) }} />
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Change Role modal */}
      <Modal open={!!roleTarget} onClose={() => setRoleTarget(null)} title="Change Role" size="sm">
        {roleTarget && (
          <div className="space-y-4">
            <p className="text-sm text-text/70">
              Changing this user&apos;s role on <strong>{roleTarget.boardName}</strong>.
            </p>
            <div className="space-y-2">
              {(['User', 'Mod'] as const).map(r => (
                <label key={r} className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors min-h-0 select-none" style={{ borderColor: selectedRole === r ? 'hsl(var(--color-primary))' : 'hsl(var(--color-border))' }}>
                  <input type="radio" name="board-role" value={r} checked={selectedRole === r} onChange={() => setSelectedRole(r)} className="min-h-0 min-w-0 h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium text-text">{BOARD_ROLE_LABEL[r]}</p>
                    <p className="text-xs text-text/50">{r === 'User' ? 'Can post and interact on the board' : 'Can approve members and manage flags'}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setRoleTarget(null)}>Cancel</Button>
              <Button size="sm" className="flex-1" loading={busy === 'role'} onClick={handleChangeRole}>Confirm</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Remove modal */}
      <Modal open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Remove from Board?" size="sm">
        {removeTarget && (
          <div className="space-y-4">
            <p className="text-sm text-text/70">
              Remove this user from <strong>{removeTarget.boardName}</strong>? They can be re-added or rejoin with an invite code.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setRemoveTarget(null)}>Cancel</Button>
              <Button variant="danger" size="sm" className="flex-1" loading={busy === 'remove'} onClick={handleRemove}>Remove</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Transfer modal */}
      <Modal open={!!transferTarget} onClose={() => setTransferTarget(null)} title="Transfer Ownership?" size="sm">
        {transferTarget && (
          <div className="space-y-4">
            <p className="text-sm text-text/70">
              Make this user the <strong>Admin</strong> of <strong>{transferTarget.boardName}</strong>? The board&apos;s current Admin becomes a Mod.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setTransferTarget(null)}>Cancel</Button>
              <Button size="sm" className="flex-1 gap-1 bg-warning text-white hover:bg-warning/90" loading={busy === 'transfer'} onClick={handleTransfer}>
                <Crown className="w-3.5 h-3.5" /> Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full text-left px-3 py-2 text-sm transition-colors',
        danger ? 'text-warning hover:bg-warning/10' : 'text-text/80 hover:bg-primary-light/50 hover:text-text'
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
    </button>
  )
}
