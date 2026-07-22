import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { isStripeConfigured } from '@/lib/stripe'
import { ProfileClient } from './ProfileClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: userProfile }, { data: membershipRow }] = await Promise.all([
    supabase
      .from('users')
      .select('id, display_name, email, phone_number, notify_via_email, notify_via_sms, notify_weekly_digest, role, is_active, created_at')
      .eq('id', user.id)
      .single(),
    // membership columns are locked from direct SELECT — owner-only RPC
    supabase.rpc('get_own_membership').single(),
  ])

  const tier = membershipRow?.membership === 'Pro' || membershipRow?.membership === 'Trial'
    ? membershipRow.membership as 'Pro' | 'Trial'
    : 'Basic'
  const isPro = tier !== 'Basic'

  return (
    <ProfileClient
      user={userProfile}
      sessionUserId={user.id}
      isPro={isPro}
      membershipTier={tier}
      trialEndsAt={membershipRow?.trial_ends_at ?? null}
      billingEnabled={isStripeConfigured()}
    />
  )
}
