import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PostShiftForm } from '@/components/features/PostShiftForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Edit Shift – WDWShiftX' }

interface PageProps {
  params: { id: string }
  searchParams: { from?: string }
}

export default async function EditShiftPage({ params, searchParams }: PageProps) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: shift } = await supabase
    .from('shifts')
    .select('id, board_id, shift_title, start_time, end_time, is_trade, is_giveaway, is_overtime_approved, details, user_id, bundle_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!shift) notFound()

  const { data: userProfile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-accent text-2xl font-bold text-text">Edit Shift</h1>
        <p className="text-sm text-text/60">Update your shift offer</p>
      </div>
      <PostShiftForm
          userId={user.id}
          displayName={userProfile?.display_name ?? 'User'}
          shiftId={shift.id}
          returnTo={searchParams.from === 'calendar' ? '/calendar' : '/wall'}
          initialData={{
            board_id:             shift.board_id,
            shift_title:          shift.shift_title,
            start_time:           shift.start_time,
            end_time:             shift.end_time,
            is_trade:             shift.is_trade,
            is_giveaway:          shift.is_giveaway,
            is_overtime_approved: shift.is_overtime_approved,
            details:              shift.details,
            bundle_id:            shift.bundle_id,
          }}
      />
    </div>
  )
}
