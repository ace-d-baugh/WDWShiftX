import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { PostRequestForm } from '@/components/features/PostRequestForm'

export const metadata = {
  title: 'Post a Request – WDWShiftX',
}

type ProfileRow = { id: string; display_name: string } | null

export default async function NewRequestPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('id', session.user.id)
    .single() as unknown as { data: ProfileRow }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/board" className="inline-flex items-center gap-1.5 text-sm text-text/60 hover:text-text mb-6 min-h-0 min-w-0">
        <ArrowLeft className="w-4 h-4" /> Back to Board
      </Link>
      <div className="mb-6">
        <h1 className="font-accent text-2xl font-bold text-text">Post a Shift Request</h1>
        <p className="text-sm text-text/60">Let other CMs know you need a shift on a specific day</p>
      </div>
      <div className="card shadow-sm">
        <PostRequestForm
          userId={session.user.id}
          displayName={userProfile?.display_name ?? 'Cast Member'}
        />
      </div>
    </div>
  )
}
