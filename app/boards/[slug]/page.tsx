import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { SessionTimeout } from '@/components/features/SessionTimeout'
import { BoardsClient } from '@/app/(dashboard)/boards/BoardsClient'
import { groupMembersByBoard } from '@/app/(dashboard)/boards/utils'
import { JoinBoardClient } from './JoinBoardClient'
import type { ManagedBoard } from '@/app/(dashboard)/boards/types'
import type { BoardRole, GlobalRole } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

interface Props {
  params: { slug: string }
  searchParams: { c?: string }
}

export async function generateMetadata({ params }: Props) {
  const supabase = createServerClient()
  const { data: board } = await supabase.from('boards').select('name').eq('slug', params.slug).single()
  return { title: board ? board.name : 'Board' }
}

export default async function BoardSlugPage({ params, searchParams }: Props) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const inviteCode = searchParams.c ?? ''
  const thisPath = `/boards/${params.slug}${inviteCode ? `?c=${inviteCode}` : ''}`

  // Not authenticated — redirect to register, threading the board URL through
  if (!user) {
    redirect(`/register?redirect=${encodeURIComponent(thisPath)}`)
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, display_name, role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) redirect('/login?reason=deactivated')
  if (profile.role === 'Guest') redirect(`/verify-email?redirect=${encodeURIComponent(thisPath)}`)

  const isAdmin = profile.role === 'Admin'
  const userRole = profile.role as GlobalRole
  const displayName = profile.display_name ?? 'User'

  // Look up board by slug
  const { data: board } = await supabase
    .from('boards')
    .select('id, name, slug, invite_code, invite_code_enabled')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!board) notFound()

  // Check membership
  const { data: membership } = await supabase
    .from('user_boards')
    .select('role')
    .eq('board_id', board.id)
    .eq('user_id', user.id)
    .eq('is_approved', true)
    .single()

  const isMember = !!membership

  // Compute navbar props (needed for both views)
  const isBoardModerator = isMember && (membership!.role === 'Mod' || membership!.role === 'Leader') || isAdmin
  const isLeader = isMember && membership!.role === 'Leader' || isAdmin

  let pendingApprovalsCount = 0
  let pendingFlagsCount = 0
  if (isBoardModerator || isAdmin) {
    const [approvalsRes, flagsRes] = await Promise.all([
      supabase.from('user_boards').select('id', { count: 'exact', head: true }).eq('is_approved', false),
      supabase.from('flags').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    pendingApprovalsCount = approvalsRes.count ?? 0
    pendingFlagsCount = flagsRes.count ?? 0
  }

  const navbar = (
    <Navbar
      userRole={userRole}
      displayName={displayName}
      isBoardModerator={isBoardModerator}
      isLeader={isLeader}
      pendingApprovalsCount={pendingApprovalsCount}
      pendingFlagsCount={pendingFlagsCount}
    />
  )

  // Non-member: show join page
  if (!isMember && !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SessionTimeout />
        {navbar}
        <main className="flex-1">
          <JoinBoardClient
            boardId={board.id}
            boardName={board.name}
            boardSlug={board.slug}
            initialCode={inviteCode}
          />
        </main>
        <Footer />
      </div>
    )
  }

  // Member or admin: show board management
  const { data: memberRows } = await supabase
    .from('user_boards')
    .select('id, user_id, board_id, role, users!user_id(display_name), approver:users!approved_by_user_id(display_name)')
    .eq('board_id', board.id)
    .eq('is_approved', true)
    .eq('is_hidden', false)
    .order('role', { ascending: true })

  const membersByBoard = groupMembersByBoard(memberRows)

  let myRole: BoardRole = 'User'
  if (isAdmin) {
    myRole = 'Leader'
  } else {
    myRole = membership!.role as BoardRole
  }

  const managedBoards: ManagedBoard[] = [{
    boardId:           board.id,
    boardName:         board.name,
    boardSlug:         board.slug,
    inviteCode:        board.invite_code,
    inviteCodeEnabled: board.invite_code_enabled,
    myRole,
    members:           membersByBoard.get(board.id) ?? [],
  }]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SessionTimeout />
      {navbar}
      <main className="flex-1 pb-20 md:pb-0">
        <BoardsClient
          managedBoards={managedBoards}
          currentUserId={user.id}
          isAdmin={isAdmin}
        />
      </main>
      <Footer />
    </div>
  )
}
