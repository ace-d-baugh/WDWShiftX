import type { BoardMember } from './types'
import type { BoardRole } from '@/lib/database.types'

export function groupMembersByBoard(rows: unknown[] | null): Map<string, BoardMember[]> {
  const map = new Map<string, BoardMember[]>()
  ;(rows ?? []).forEach(row => {
    const r = row as Record<string, unknown>
    const boardId = r.board_id as string
    if (!map.has(boardId)) map.set(boardId, [])
    map.get(boardId)!.push({
      userBoardId: r.id as string,
      userId:      r.user_id as string,
      displayName: (r.users as { display_name: string | null } | null)?.display_name ?? null,
      avatarUrl:   (r.users as { avatar_url: string | null } | null)?.avatar_url ?? null,
      role:        r.role as BoardRole,
      approvedBy:  (r.approver as { display_name: string | null } | null)?.display_name ?? null,
    })
  })
  return map
}
