import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ProfileClient } from './ProfileClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: userProfile }, { data: contactMethods }] = await Promise.all([
    supabase
      .from('users')
      .select('id, display_name, email, phone_number, notify_via_email, notify_via_sms, role, is_active, created_at, avatar_url, bio, birthday_month, birthday_day, birthday_year')
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_contact_methods')
      .select('id, type, value, sort_order')
      .eq('user_id', user.id)
      .order('sort_order'),
  ])

  return (
    <ProfileClient
      user={userProfile}
      sessionUserId={user.id}
      contactMethods={contactMethods ?? []}
    />
  )
}
