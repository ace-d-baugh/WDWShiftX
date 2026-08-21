'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'

const TOAST_MS = 5000

interface ToastData {
  conversationId: string
  senderName: string
  senderAvatarUrl: string | null
  preview: string
}

/**
 * App-wide new-message toast. Subscribes to message INSERTs (RLS-filtered,
 * so only the user's own conversations arrive) and shows a 5-second toast
 * linking to the chat — unless the user is already viewing that thread.
 * Also refreshes the layout so the Navbar unread badge updates live.
 */
export function MessageToast({ currentUserId }: { currentUserId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [toast, setToast] = useState<ToastData | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Conversation ids this user belongs to, used to scope the subscription.
  const [conversationIds, setConversationIds] = useState<string[] | null>(null)

  // Read inside the subscription callback without resubscribing on navigation
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  // Load the id list, and watch for being added to a NEW conversation so the
  // first message in it still raises a toast. Without this watch, scoping the
  // subscription below would silently drop exactly that case.
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const load = async () => {
      const { data } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUserId)
      if (!cancelled) setConversationIds((data ?? []).map(r => r.conversation_id as string))
    }
    load()

    const channel = supabase
      .channel(`realtime:participants:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT', schema: 'public', table: 'conversation_participants',
          filter: `user_id=eq.${currentUserId}`,
        },
        () => { load() }
      )
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [currentUserId])

  useEffect(() => {
    // Wait for the id list; nothing to listen to until then.
    if (conversationIds === null || conversationIds.length === 0) return

    const supabase = createClient()
    const channel = supabase
      .channel('realtime:messages:toast')
      .on(
        'postgres_changes',
        {
          event: 'INSERT', schema: 'public', table: 'messages',
          // Scope server-side. This used to listen to EVERY message inserted
          // anywhere in the app and lean on RLS to discard the irrelevant ones,
          // which made Realtime evaluate a policy per connected client per
          // message sent site-wide.
          filter: `conversation_id=in.(${conversationIds.join(',')})`,
        },
        async (payload) => {
          const msg = payload.new as {
            id: string; conversation_id: string; sender_id: string | null; body: string
          }
          if (!msg.sender_id || msg.sender_id === currentUserId) return
          // Already reading that thread — its own view handles it
          if (pathnameRef.current === `/messages/${msg.conversation_id}`) return

          const { data: sender } = await supabase
            .from('users')
            .select('display_name, avatar_url')
            .eq('id', msg.sender_id)
            .single()

          setToast({
            conversationId: msg.conversation_id,
            senderName: sender?.display_name ?? 'Someone',
            senderAvatarUrl: sender?.avatar_url ?? null,
            preview: msg.body.length > 80 ? `${msg.body.slice(0, 77)}…` : msg.body,
          })
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => setToast(null), TOAST_MS)

          // Keep the Navbar unread badge current without a page reload —
          // coalesced, because router.refresh() re-fetches and re-renders the
          // whole server tree. One per message meant a burst of chat queued a
          // burst of full-tree refreshes.
          if (refreshRef.current) clearTimeout(refreshRef.current)
          refreshRef.current = setTimeout(() => router.refresh(), 1000)
        }
      )
      .subscribe()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (refreshRef.current) clearTimeout(refreshRef.current)
      supabase.removeChannel(channel)
    }
    // Re-subscribes when the conversation list changes (joined a new chat).
  }, [conversationIds, currentUserId, router])

  if (!toast) return null

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-36 md:bottom-6 z-[60] w-[calc(100vw-2rem)] max-w-sm">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card shadow-xl">
        <button
          type="button"
          onClick={() => { dismiss(); router.push(`/messages/${toast.conversationId}`) }}
          className="flex items-center gap-3 flex-1 min-w-0 text-left min-h-0"
        >
          <Avatar avatarUrl={toast.senderAvatarUrl} displayName={toast.senderName} size={36} clickable={false} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-text truncate">
              New message from {toast.senderName}
            </span>
            <span className="block text-xs text-text/60 truncate">{toast.preview}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="p-1 rounded-md text-text/40 hover:text-text hover:bg-primary-light transition-colors min-h-0 min-w-0 shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
