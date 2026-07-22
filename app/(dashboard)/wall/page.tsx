import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { WallClient } from './WallClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'The Wall',
}

interface Board { id: string; name: string }

export default async function WallPage({ searchParams }: { searchParams: { tab?: string; date?: string } }) {
  noStore()

  const { supabase, user } = await requireUser()

  const [{ data: userProfile }, { data: memberRows }, { count: ownShiftCount }] = await Promise.all([
    supabase
      .from('users')
      .select('id, display_name, onboarding_dismissed_at')
      .eq('id', user.id)
      .single(),
    // User's approved boards for the filter dropdown
    supabase
      .from('user_boards')
      .select('board_id, boards(id, name)')
      .eq('user_id', user.id)
      .eq('is_approved', true),
    supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const boards = (memberRows ?? [])
    .map((ub: { board_id: string; boards: Board | null }) => ub.boards)
    .filter((b): b is Board => !!b)
    .sort((a, b) => a.name.localeCompare(b.name))

  // Task 22: brand-new users (no boards, no shifts, never skipped the wizard)
  // get the schedule-first onboarding instead of an empty wall.
  if (boards.length === 0 && (ownShiftCount ?? 0) === 0 && !userProfile?.onboarding_dismissed_at) {
    redirect('/welcome')
  }

  return (
    <WallClient
      userId={user.id}
      displayName={userProfile?.display_name ?? 'User'}
      boards={boards}
      hasBoards={boards.length > 0}
      initialTab={searchParams.tab === 'requests' ? 'requests' : 'offers'}
      initialDate={searchParams.date ?? ''}
      liveWall={true}
    />
  )
}
