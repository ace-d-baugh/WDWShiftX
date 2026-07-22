import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PostRequestForm } from '@/components/features/PostRequestForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Edit Request – WDWShiftX' }

interface PageProps { params: { id: string } }

export default async function EditRequestPage({ params }: PageProps) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: request } = await supabase
    .from('requests')
    .select('id, board_id, request_title, requested_date, preferred_times, details, user_id')
    .eq('id', params.id).eq('user_id', user.id).single()

  if (!request) notFound()

  const { data: userProfile } = await supabase
    .from('users').select('display_name').eq('id', user.id).single()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-accent text-2xl font-bold text-text">Edit Request</h1>
        <p className="text-sm text-text/60">Update your shift request</p>
      </div>
      <PostRequestForm
        userId={user.id}
        displayName={userProfile?.display_name ?? 'User'}
        requestId={request.id}
        initialData={{
          request_title:   request.request_title ?? 'Shift Wanted',
          board_id:        request.board_id,
          requested_date:  request.requested_date,
          preferred_times: request.preferred_times,
          details:         request.details,
        }}
      />
    </div>
  )
}
