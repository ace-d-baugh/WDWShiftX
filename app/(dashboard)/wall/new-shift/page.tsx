import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PostShiftForm } from '@/components/features/PostShiftForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Post a Shift – WDWShiftX',
}

export default async function NewShiftPage({ searchParams }: { searchParams: { from?: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-accent text-2xl font-bold text-text">Post a Shift</h1>
        <p className="text-sm text-text/60">Add one or more shifts to your calendar</p>
      </div>
      <PostShiftForm
        userId={user.id}
        displayName={userProfile?.display_name ?? 'User'}
        wallExpanded={searchParams.from !== 'calendar'}
        returnTo={searchParams.from === 'calendar' ? '/calendar' : '/wall'}
      />
    </div>
  )
}
