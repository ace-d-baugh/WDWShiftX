import { requireUser, getUserRole } from '@/lib/auth/session'
import { BoardsClient } from './BoardsClient'
import { groupMembersByBoard } from './utils'
import type { ManagedBoard } from './types'
import type { BoardRole } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Boards' }

export default async function BoardsPage() {
  const { supabase, user } = await requireUser()

  const role = await getUserRole(supabase, user.id)
  const isAdmin = role === 'Admin'

  let managedBoards: ManagedBoard[] = []

  if (isAdmin) {
    const { data: allBoards } = await supabase
      .from('boards').select('id, name, slug, invite_code, invite_code_enabled').eq('is_active', true).order('name')

    const boardIds = (allBoards ?? []).map(b => b.id)
    const { data: memberRows } = boardIds.length
      ? await supabase
          .from('user_boards')
          .select('id, user_id, board_id, role, users!user_id(display_name), approver:users!approved_by_user_id(display_name)')
          .in('board_id', boardIds).eq('is_approved', true).eq('is_hidden', false).order('role', { ascending: true })
      : { data: [] }

    const membersByBoard = groupMembersByBoard(memberRows)
    managedBoards = (allBoards ?? []).map(b => ({
      boardId: b.id,
      boardName: b.name,
      boardSlug: b.slug,
      inviteCode: b.invite_code,
      inviteCodeEnabled: b.invite_code_enabled,
      myRole: 'Leader' as BoardRole,
      members: membersByBoard.get(b.id) ?? [],
    }))
  } else {
    // All approved memberships regardless of role
    const { data: myBoards } = await supabase
      .from('user_boards')
      .select('id, board_id, role, boards(id, name, slug, invite_code, invite_code_enabled)')
      .eq('user_id', user.id).eq('is_approved', true)
      .order('requested_at', { ascending: true })

    const boardIds = (myBoards ?? []).map(b => b.board_id)
    const { data: memberRows } = boardIds.length
      ? await supabase
          .from('user_boards')
          .select('id, user_id, board_id, role, users!user_id(display_name), approver:users!approved_by_user_id(display_name)')
          .in('board_id', boardIds).eq('is_approved', true).eq('is_hidden', false).order('role', { ascending: true })
      : { data: [] }

    const membersByBoard = groupMembersByBoard(memberRows)
    managedBoards = (myBoards ?? []).map((b: Record<string, unknown>) => {
      const bd = b.boards as { id: string; name: string; slug: string; invite_code: string; invite_code_enabled: boolean } | null
      return {
        boardId:            b.board_id as string,
        boardName:          bd?.name ?? '',
        boardSlug:          bd?.slug ?? '',
        inviteCode:         bd?.invite_code ?? '',
        inviteCodeEnabled:  bd?.invite_code_enabled ?? false,
        myRole:             b.role as BoardRole,
        members:            membersByBoard.get(b.board_id as string) ?? [],
      }
    })
  }

  return (
    <BoardsClient
      managedBoards={managedBoards}
      currentUserId={user.id}
      isAdmin={isAdmin}
    />
  )
}
