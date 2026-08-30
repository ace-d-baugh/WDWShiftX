import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PublicProfileClient } from './PublicProfileClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Profile' }

interface PageProps {
  params: { id: string }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: targetUser }, { data: contactMethods }] = await Promise.all([
    supabase
      .from('users')
      .select('id, display_name, avatar_url, bio, birthday_month, birthday_day, birthday_year')
      .eq('id', params.id)
      .single(),
    supabase
      .from('user_contact_methods')
      .select('id, type, value')
      .eq('user_id', params.id)
      .order('sort_order'),
  ])

  if (!targetUser) notFound()

  return (
    <PublicProfileClient
      user={targetUser}
      contactMethods={contactMethods ?? []}
      isOwnProfile={params.id === user.id}
    />
  )
}
