import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { ConversationClient } from './ConversationClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Messages – WDWShiftX' }

// Uuid sanity check so a malformed URL 404s cleanly instead of erroring in a query
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ConversationPage({
  params,
}: {
  params: { conversationId: string }
}) {
  const { supabase, user } = await requireUser()
  const conversationId = params.conversationId
  if (!UUID_RE.test(conversationId)) redirect('/messages')

  // RLS returns participant rows only for conversations the user belongs to,
  // so an empty result covers both "not found" and "not yours".
  const [{ data: participants }, { data: messages }] = await Promise.all([
    supabase
      .from('conversation_participants')
      .select('user_id, last_read_at, hidden_at, users(display_name)')
      .eq('conversation_id', conversationId),
    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, reaction, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
  ])

  const me = participants?.find(p => p.user_id === user.id)
  if (!me) redirect('/messages')

  const other = participants!.find(p => p.user_id !== user.id)
  const otherName =
    (other?.users as unknown as { display_name: string | null } | null)?.display_name ?? 'Former User'

  // A deleted (hidden) chat clears the user's view of the history — only
  // messages newer than their hidden_at are shown.
  const hiddenCutoff = me.hidden_at ? new Date(me.hidden_at).getTime() : null
  const visibleMessages = (messages ?? []).filter(
    m => hiddenCutoff === null || new Date(m.created_at).getTime() > hiddenCutoff
  )

  return (
    <ConversationClient
      conversationId={conversationId}
      currentUserId={user.id}
      otherUserId={other?.user_id ?? null}
      otherName={otherName}
      otherLastReadAt={other?.last_read_at ?? null}
      initialMessages={visibleMessages}
    />
  )
}
