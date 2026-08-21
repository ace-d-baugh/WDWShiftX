import type { BoardRole } from '@/lib/database.types'

export interface BoardMember {
  userBoardId: string
  userId: string
  displayName: string | null
  avatarUrl: string | null
  role: BoardRole
  approvedBy: string | null
}

export interface ManagedBoard {
  boardId: string
  boardName: string
  boardSlug: string
  inviteCode: string
  inviteCodeEnabled: boolean
  myRole: BoardRole
  members: BoardMember[]
}
