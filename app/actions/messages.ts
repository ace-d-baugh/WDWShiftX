'use server'

import { getActionSession } from '@/lib/auth/session'
import { sendPushNotification } from '@/lib/push-server'
import type { MessageReaction } from '@/lib/database.types'

const MAX_MESSAGE_LENGTH = 1000

const REACTIONS: MessageReaction[] = ['thumbs_up', 'laugh', 'surprise', 'sad', 'mad', 'star']

/**
 * Defense-in-depth for message bodies. Messages are always rendered as plain
 * text (React escapes them — no HTML/script execution path), but we also
 * strip control characters (keeping \n and \t) so nothing invisible or
 * terminal-hostile is stored, and collapse 3+ blank lines.
 */
function sanitizeBody(raw: string): string {
  const noControl = Array.from(raw)
    .filter(ch => {
      const code = ch.charCodeAt(0)
      return !((code < 32 && ch !== '\n' && ch !== '\t') || code === 127)
    })
    .join('')
  return noControl.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Open (or create) the 1:1 conversation between the current user and
 * another user. The get_or_create_conversation RPC enforces the rules:
 * both users active, not yourself, and sharing at least one approved board.
 */
export async function startConversation(
  otherUserId: string
): Promise<{ conversationId?: string; error?: string }> {
  try {
    const { supabase } = await getActionSession()
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      p_other_user_id: otherUserId,
    })
    if (error) return { error: error.message }
    if (!data) return { error: 'Could not open the conversation.' }
    return { conversationId: data }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Open (or create) a conversation and drop a shift summary in as the first
 * message. Used by the Wall's interest list so both sides land in the thread
 * already knowing which shift is being discussed — the owner shouldn't have
 * to retype it, and the claimant shouldn't have to guess.
 *
 * Returns the conversation id even if the summary fails to send, so the
 * caller can still navigate to the (now open) thread.
 */
export async function messageAboutShift(
  otherUserId: string,
  summary: string
): Promise<{ conversationId?: string; error?: string }> {
  const convo = await startConversation(otherUserId)
  if (!convo.conversationId) {
    return { error: convo.error ?? 'Could not open the conversation.' }
  }
  const sent = await sendMessage(convo.conversationId, summary)
  return sent.error
    ? { conversationId: convo.conversationId, error: sent.error }
    : { conversationId: convo.conversationId }
}

export interface SentMessage {
  id: string
  conversation_id: string
  sender_id: string | null
  body: string
  reaction: MessageReaction | null
  created_at: string
}

/**
 * Send a message in a conversation. RLS proves the sender is a participant
 * (insert fails otherwise). On success, fires a web push to the other
 * participant(s) — fire-and-forget, never blocks the send.
 */
export async function sendMessage(
  conversationId: string,
  body: string
): Promise<{ message?: SentMessage; error?: string }> {
  try {
    const { supabase, userId } = await getActionSession()

    const trimmed = sanitizeBody(body)
    if (!trimmed) return { error: 'Message cannot be empty.' }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return { error: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.` }
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: userId, body: trimmed })
      .select('id, conversation_id, sender_id, body, reaction, created_at')
      .single()

    if (error) return { error: error.message }

    // Sending implies having read everything up to now
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)

    // Push to the other participant — fire-and-forget
    notifyNewMessage(conversationId, userId, trimmed).catch(err =>
      console.error('[sendMessage] push notify failed:', err)
    )

    return { message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * React to a message someone sent you. One reaction per message; choosing
 * again replaces it. RLS enforces the rest: must be a participant, can't
 * react to your own messages, and only the reaction column is updatable.
 */
export async function reactToMessage(
  messageId: string,
  reaction: MessageReaction
): Promise<{ error?: string }> {
  try {
    if (!REACTIONS.includes(reaction)) return { error: 'Invalid reaction.' }
    const { supabase } = await getActionSession()
    const { data, error } = await supabase
      .from('messages')
      .update({ reaction })
      .eq('id', messageId)
      .select('id')
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: 'You can only react to messages sent to you.' }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * "Delete" a chat for the current user only: sets hidden_at on their
 * participant row. The other participant keeps the full conversation; a
 * newer message from either side makes the chat reappear for this user,
 * showing only messages after this point. Nothing is removed from the DB.
 */
export async function deleteConversation(conversationId: string): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await getActionSession()
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('conversation_participants')
      .update({ hidden_at: now, last_read_at: now })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/** Mark a conversation read for the current user (thread open / new message seen). */
export async function markConversationRead(conversationId: string): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await getActionSession()
    const { error } = await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Web push to the other participant(s) of a conversation. Not exported —
 * only sendMessage (which has already proven participation via RLS) calls it.
 */
async function notifyNewMessage(conversationId: string, senderId: string, body: string): Promise<void> {
  const { supabase } = await getActionSession()

  const [{ data: participants }, { data: sender }] = await Promise.all([
    supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId),
    supabase.from('users').select('display_name').eq('id', senderId).single(),
  ])

  const senderName = sender?.display_name ?? 'Someone'
  const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body

  await Promise.all(
    (participants ?? []).map(p =>
      sendPushNotification(
        p.user_id,
        `New message from ${senderName}`,
        preview,
        `/messages/${conversationId}`
      )
    )
  )
}
