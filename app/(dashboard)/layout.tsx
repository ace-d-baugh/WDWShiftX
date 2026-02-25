import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import type { UserRole } from '@/lib/database.types'

type UserProfileRow = { id: string; display_name: string; role: UserRole; is_active: boolean } | null

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('id, display_name, role, is_active')
    .eq('id', session.user.id)
    .single() as unknown as { data: UserProfileRow }

  if (userProfile && !userProfile.is_active) {
    redirect('/login?reason=deactivated')
  }

  const userRole = userProfile?.role ?? 'cast'
  const displayName = userProfile?.display_name ?? session.user.email ?? 'Cast Member'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar userRole={userRole} displayName={displayName} />
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
      <Footer />
    </div>
  )
}
