import { unstable_noStore as noStore } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { optionalServerEnv } from '@/lib/env'
import { WelcomeClient } from './WelcomeClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Welcome',
}

export default async function WelcomePage() {
  noStore()

  const { supabase, user } = await requireUser()

  const [{ data: profile }, { count: shiftCount }, { count: boardCount }] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', user.id).single(),
    supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
    supabase.from('user_boards').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  return (
    <WelcomeClient
      userId={user.id}
      displayName={profile?.display_name ?? ''}
      importEnabled={Boolean(optionalServerEnv.GEMINI_API_KEY)}
      initialShiftCount={shiftCount ?? 0}
      initialBoardCount={boardCount ?? 0}
    />
  )
}
