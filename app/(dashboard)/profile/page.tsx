import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ProfileClient } from './ProfileClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Profile – WDWShiftX' }

export default async function ProfilePage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users')
    .select('id, display_name, email, phone_number, notify_via_email, notify_via_sms, role, is_active, created_at')
    .eq('id', session.user.id)
    .single()

  return <ProfileClient user={userProfile} sessionUserId={session.user.id} />
}
