import { requireUser } from '@/lib/auth/session'
import { MessagesClient } from './MessagesClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Messages' }

export default async function MessagesPage() {
  const { supabase, user } = await requireUser()
  const { data: conversations } = await supabase.rpc('get_conversations')

  return (
    <MessagesClient
      currentUserId={user.id}
      initialConversations={conversations ?? []}
    />
  )
}
