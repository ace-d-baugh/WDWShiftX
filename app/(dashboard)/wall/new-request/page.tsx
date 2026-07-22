import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PostRequestForm } from '@/components/features/PostRequestForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Post a Request – WDWShiftX' }

export default async function NewRequestPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users').select('id, display_name').eq('id', user.id).single()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-accent text-2xl font-bold text-text">Post a Shift Request</h1>
        <p className="text-sm text-text/60">Add one or more shift requests</p>
      </div>
      <PostRequestForm
        userId={user.id}
        displayName={userProfile?.display_name ?? 'User'}
      />
    </div>
  )
}
