'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getActionSession } from '@/lib/auth/session'
import { notifyBoardApproved } from '@/app/actions/notifications'
import { slugify } from '@/lib/slug'

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no O/0, I/1 ambiguity
  let code = ''
  for (let i = 0; i < 7; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ── Create a board ────────────────────────────────────────────────────────────

// WDW ShiftX is locked to its two pre-seeded boards — self-serve creation is
// disabled entirely (not just hidden in the UI). Boards are seeded directly
// via service role; the RLS policy (see 20260722130000_lock_board_creation_to_admin.sql)
// enforces this too, so this is defense in depth, not the only gate.
export async function createBoard(_name: string): Promise<{ error?: string; boardId?: string }> {
  return { error: 'Board creation is disabled. WDWShiftX is locked to its two pre-assigned boards.' }
}

// ── Join a board (rate-limited) ───────────────────────────────────────────────

const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_MAX_PER_WINDOW = 5
const DEACTIVATE_THRESHOLD = 15

export async function lookupBoardByCode(code: string): Promise<{
  error?: string
  rateLimited?: boolean
  board?: { id: string; name: string }
}> {
  try {
    const { supabase, userId } = await getActionSession()
    const upperCode = code.toUpperCase()

    // Count failures in the last minute
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString()
    const { count: recentFailures } = await supabase
      .from('board_join_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('outcome', 'success')
      .gte('attempted_at', windowStart)

    if ((recentFailures ?? 0) >= RATE_LIMIT_MAX_PER_WINDOW) {
      return { rateLimited: true, error: 'Too many attempts. Please wait a minute before trying again.' }
    }

    // Look up the board via SECURITY DEFINER function (bypasses RLS so a
    // non-member can find a board by its invite code)
    const { data: rows } = await supabase
      .rpc('lookup_board_by_invite_code', { p_code: upperCode })
    const board = (rows as { id: string; name: string; is_active: boolean; invite_code_enabled: boolean }[] | null)?.[0] ?? null

    if (!board || !board.is_active) {
      await recordAttempt(supabase, userId, upperCode, 'invalid_code')
      await checkDeactivationThreshold(supabase, userId)
      return { error: 'Invalid invite code.' }
    }

    if (!board.invite_code_enabled) {
      await recordAttempt(supabase, userId, upperCode, 'invalid_code')
      await checkDeactivationThreshold(supabase, userId)
      return { error: 'This board is not accepting new members right now.' }
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('user_boards')
      .select('id, is_approved')
      .eq('user_id', userId)
      .eq('board_id', board.id)
      .single()

    if (existing) {
      return { error: existing.is_approved ? 'You are already a member of this board.' : 'Your request to join this board is pending approval.' }
    }

    return { board: { id: board.id, name: board.name } }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function confirmJoinBoard(boardId: string, confirmed: boolean): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await getActionSession()

    // Get the board's invite code for logging
    const { data: board } = await supabase.from('boards').select('invite_code').eq('id', boardId).single()
    const code = board?.invite_code ?? ''

    if (!confirmed) {
      await recordAttempt(supabase, userId, code, 'user_declined')
      await checkDeactivationThreshold(supabase, userId)
      return {}
    }

    const { error } = await supabase.from('user_boards').insert({
      user_id: userId,
      board_id: boardId,
      role: 'User',
      is_approved: false,
    })

    if (error) return { error: error.message }

    await recordAttempt(supabase, userId, code, 'success')
    revalidatePath('/profile')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

async function recordAttempt(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  code: string,
  outcome: 'invalid_code' | 'user_declined' | 'success'
) {
  await supabase.from('board_join_attempts').insert({ user_id: userId, code_entered: code, outcome })
}

async function checkDeactivationThreshold(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
) {
  const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('board_join_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('outcome', 'success')
    .gte('attempted_at', dayStart)

  if ((count ?? 0) >= DEACTIVATE_THRESHOLD) {
    await supabase.from('users').update({ is_active: false }).eq('id', userId)
  }
}

// ── Leave a board ─────────────────────────────────────────────────────────────

export async function leaveBoard(boardId: string): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await getActionSession()

    // Prevent leaving if you're the only Leader
    const { data: membership } = await supabase
      .from('user_boards')
      .select('role')
      .eq('user_id', userId)
      .eq('board_id', boardId)
      .single()

    if (membership?.role === 'Leader') {
      const { count } = await supabase
        .from('user_boards')
        .select('id', { count: 'exact', head: true })
        .eq('board_id', boardId)
        .eq('role', 'Leader')
        .eq('is_approved', true)

      if ((count ?? 0) <= 1) {
        return { error: 'You are the only Admin of this board. Delete the board or promote another member first.' }
      }
    }

    const { error } = await supabase
      .from('user_boards')
      .delete()
      .eq('user_id', userId)
      .eq('board_id', boardId)

    if (error) return { error: error.message }
    revalidatePath('/profile')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ── Delete a board (Leader only) ──────────────────────────────────────────────

export async function deleteBoard(boardId: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()
    // RLS enforces leader-only; CASCADE handles user_boards, shifts, requests
    const { error } = await supabase.from('boards').delete().eq('id', boardId)
    if (error) return { error: error.message }
    revalidatePath('/profile')
    revalidatePath('/wall')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ── Rename a board (Leader only) ──────────────────────────────────────────────

export async function updateBoardName(boardId: string, name: string): Promise<{ error?: string }> {
  try {
    const trimmed = name.trim()
    if (trimmed.length < 2) return { error: 'Board name must be at least 2 characters.' }
    if (trimmed.length > 32) return { error: 'Board name must be 32 characters or fewer.' }
    const { supabase } = await getActionSession()
    const newSlug = slugify(trimmed)
    const { error } = await supabase.from('boards').update({ name: trimmed, slug: newSlug }).eq('id', boardId)

    if (error) {
      if (error.code === '23505') return { error: 'A board with that name already exists.' }
      return { error: error.message }
    }
    revalidatePath('/profile')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ── Toggle invite code enabled (Leader only) ──────────────────────────────────

export async function toggleInviteCode(boardId: string, enabled: boolean): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()
    const { error } = await supabase.from('boards').update({ invite_code_enabled: enabled }).eq('id', boardId)
    if (error) return { error: error.message }
    revalidatePath('/profile')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ── Regenerate invite code (Leader only) ─────────────────────────────────────

export async function regenerateInviteCode(boardId: string): Promise<{ error?: string; code?: string }> {
  try {
    const { supabase } = await getActionSession()

    let invite_code = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateInviteCode()
      const { data: existing } = await supabase.from('boards').select('id').eq('invite_code', candidate).single()
      if (!existing) { invite_code = candidate; break }
    }
    if (!invite_code) return { error: 'Failed to generate a unique code. Please try again.' }

    const { error } = await supabase.from('boards').update({ invite_code }).eq('id', boardId)
    if (error) return { error: error.message }
    revalidatePath('/profile')
    return { code: invite_code }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ── Approve / reject a join request (Mod / Leader) ───────────────────────────

export async function approveUserBoard(userBoardId: string): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await getActionSession()
    const { error } = await supabase
      .from('user_boards')
      .update({ is_approved: true, approved_by_user_id: userId, approved_at: new Date().toISOString() })
      .eq('id', userBoardId)
    if (error) return { error: error.message }
    revalidatePath('/leader/approvals')
    // Fire-and-forget — never blocks the approval action
    notifyBoardApproved(userBoardId)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function rejectUserBoard(userBoardId: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()
    const { error } = await supabase.from('user_boards').delete().eq('id', userBoardId)
    if (error) return { error: error.message }
    revalidatePath('/leader/approvals')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ── Change a member's board role (Leader only) ────────────────────────────────

export async function updateUserBoardRole(
  userBoardId: string,
  newRole: 'User' | 'Mod'
): Promise<{ error?: string }> {
  try {
    if (!['User', 'Mod'].includes(newRole)) return { error: 'Invalid role.' }
    const { supabase } = await getActionSession()
    const { data: existing } = await supabase.from('user_boards').select('is_hidden').eq('id', userBoardId).single()
    if (existing?.is_hidden) return { error: 'Cannot modify a hidden membership.' }
    const { error } = await supabase.from('user_boards').update({ role: newRole }).eq('id', userBoardId)
    if (error) return { error: error.message }
    revalidatePath('/leader/approvals')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ── Transfer board ownership (Leader only) ───────────────────────────────────

export async function transferBoardOwnership(
  boardId: string,
  newLeaderUserId: string
): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await getActionSession()

    // Confirm caller is currently a Leader of this board
    const { data: mine } = await supabase
      .from('user_boards')
      .select('id, role')
      .eq('board_id', boardId)
      .eq('user_id', userId)
      .eq('is_approved', true)
      .single()

    if (!mine || mine.role !== 'Leader') {
      return { error: 'Only board Admins can transfer ownership.' }
    }

    // Promote the new leader
    const { data: promoted, error: promoteErr } = await supabase
      .from('user_boards')
      .update({ role: 'Leader' })
      .eq('board_id', boardId)
      .eq('user_id', newLeaderUserId)
      .eq('is_approved', true)
      .eq('is_hidden', false)
      .select('id')

    if (promoteErr) return { error: promoteErr.message }
    if (!promoted || promoted.length === 0) {
      return { error: 'That user is not an approved member of this board.' }
    }

    // Demote current leader to Mod
    const { error: demoteErr } = await supabase
      .from('user_boards')
      .update({ role: 'Mod' })
      .eq('id', mine.id)

    if (demoteErr) return { error: demoteErr.message }

    revalidatePath('/profile')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ── Remove a member from a board (Mod / Leader) ───────────────────────────────

export async function removeUserFromBoard(userBoardId: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()
    const { data: existing } = await supabase.from('user_boards').select('is_hidden').eq('id', userBoardId).single()
    if (existing?.is_hidden) return { error: 'Cannot remove a hidden membership.' }
    const { error } = await supabase.from('user_boards').delete().eq('id', userBoardId)
    if (error) return { error: error.message }
    revalidatePath('/leader/approvals')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
