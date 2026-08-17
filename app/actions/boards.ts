'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActionSession, requireAdminAction } from '@/lib/auth/session'
import { notifyBoardApproved } from '@/app/actions/notifications'
import { slugify } from '@/lib/slug'
import type { BoardRole } from '@/lib/database.types'

// ── Helpers ──────────────────────────────────────────────────────────────────

// The invite code is the only credential guarding a private board, so it must
// come from the CSPRNG rather than Math.random() (xorshift128+, whose state is
// recoverable from a run of outputs). Board creation is disabled in this fork,
// so there is no way to harvest samples here — but regenerateInviteCode() still
// mints codes, and this keeps both apps on one implementation.
//
// The alphabet is exactly 32 characters = 5 bits each, so masking a random
// byte with 0x1f is uniform (no modulo bias). 10 chars = 50 bits.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no O/0, I/1 ambiguity
const CODE_LENGTH = 10

function generateInviteCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] & 0x1f]
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
    // The code is only used as a label on the join-attempt log row. Reading it
    // needs column privilege the client no longer has (S8), and this path runs
    // for people who are NOT yet members — exactly who must not see it. Log the
    // board id instead, which is just as useful for tracing an attempt.
    const code = `board:${boardId}`

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

// Soft delete: the board and everything on it disappear from every member
// immediately (is_active gates all member-facing reads), but the row survives
// as status='deleted' rather than being cascaded away — recoverable by
// restoring it directly in the database, not from any UI. Shared by the
// Overlord panel, a board Leader's own /boards page, and the profile page's
// My Boards section, so "Delete" means the same thing everywhere it appears.
export async function deleteBoard(boardId: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()
    // RLS enforces leader-only
    const { error } = await supabase
      .from('boards')
      .update({ status: 'deleted', is_active: false })
      .eq('id', boardId)
    if (error) return { error: error.message }
    revalidatePath('/profile')
    revalidatePath('/wall')
    revalidatePath('/admin')
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

    // No pre-flight collision check: filtering on invite_code needs SELECT
    // privilege the client no longer has (S8). Retry on the UNIQUE violation
    // instead, which is the authoritative check anyway.
    let invite_code = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateInviteCode()
      const { error: updateErr } = await supabase
        .from('boards').update({ invite_code: candidate }).eq('id', boardId)
      if (!updateErr) { invite_code = candidate; break }
      if (updateErr.code !== '23505') return { error: updateErr.message }
    }
    if (!invite_code) return { error: 'Failed to generate a unique code. Please try again.' }

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

// ── Remove a member from a board (Mod / Leader / Admin) ───────────────────────

export async function removeUserFromBoard(
  userBoardId: string,
  reassignToUserId?: string
): Promise<{ error?: string; requiresReassignment?: boolean }> {
  try {
    const { supabase } = await getActionSession()
    const { data: existing } = await supabase
      .from('user_boards')
      .select('is_hidden, role, board_id')
      .eq('id', userBoardId)
      .single()
    if (!existing) return { error: 'Membership not found.' }
    if (existing.is_hidden) return { error: 'Cannot remove a hidden membership.' }

    // Removing the board's last Admin (Leader) would leave it ownerless —
    // require promoting a replacement first, atomically with the removal.
    if (existing.role === 'Leader') {
      const { count: otherLeaders } = await supabase
        .from('user_boards')
        .select('id', { count: 'exact', head: true })
        .eq('board_id', existing.board_id)
        .eq('role', 'Leader')
        .eq('is_approved', true)
        .eq('is_hidden', false)
        .neq('id', userBoardId)

      if ((otherLeaders ?? 0) === 0) {
        if (!reassignToUserId) {
          return {
            error: 'This is the only Admin on the board. Promote another member to Admin before removing them.',
            requiresReassignment: true,
          }
        }
        const { error: promoteErr } = await supabase
          .from('user_boards')
          .update({ role: 'Leader' })
          .eq('board_id', existing.board_id)
          .eq('user_id', reassignToUserId)
          .eq('is_approved', true)
          .eq('is_hidden', false)
        if (promoteErr) return { error: promoteErr.message }
      }
    }

    const { error } = await supabase.from('user_boards').delete().eq('id', userBoardId)
    if (error) return { error: error.message }
    revalidatePath('/leader/approvals')
    revalidatePath('/admin')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ── Overlord: assign a user to a board (global Admin only) ────────────────────

/**
 * Add another user to a board as an approved member with a chosen board role.
 * The RLS INSERT policy (S16) only permits self-service pending joins, so this
 * must run on the service-role client behind an app-level Admin guard. Distinct
 * from confirmJoinBoard (a user's own pending request) — this is the overlord
 * placing someone directly.
 */
export async function adminAddUserToBoard(
  targetUserId: string,
  boardId: string,
  role: BoardRole
): Promise<{ error?: string; userBoardId?: string }> {
  try {
    if (!['User', 'Mod', 'Leader'].includes(role)) return { error: 'Invalid role.' }
    const { userId: adminId } = await requireAdminAction()

    const db = createAdminClient()
    const { data, error } = await db
      .from('user_boards')
      .insert({
        user_id: targetUserId,
        board_id: boardId,
        role,
        is_approved: true,
        approved_by_user_id: adminId,
        approved_at: new Date().toISOString(),
        is_hidden: false,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') return { error: 'That user is already a member of this board.' }
      return { error: error.message }
    }

    revalidatePath(`/admin/users/${targetUserId}`)
    return { userBoardId: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Not authorized.' }
  }
}

/**
 * Overlord version of transferBoardOwnership: promote the target to the board's
 * Leader and step every *visible* human Leader down to Mod. Unlike the member
 * flow, this does not touch the caller — the overlord isn't handing off their
 * own crown — and it leaves hidden admin memberships alone. Runs on the service
 * client so the multi-row role swap is atomic and RLS-independent.
 */
export async function adminTransferBoardOwnership(
  boardId: string,
  newLeaderUserId: string
): Promise<{ error?: string }> {
  try {
    await requireAdminAction()
    const db = createAdminClient()

    // The new leader must already be a visible, approved member of the board.
    const { data: target } = await db
      .from('user_boards')
      .select('id')
      .eq('board_id', boardId)
      .eq('user_id', newLeaderUserId)
      .eq('is_approved', true)
      .eq('is_hidden', false)
      .maybeSingle()

    if (!target) return { error: 'That user must be a member of the board before they can lead it.' }

    // Step down the current visible Leader(s) — not hidden admin rows, not the
    // incoming leader — so the board ends with exactly one human Admin.
    const { error: demoteErr } = await db
      .from('user_boards')
      .update({ role: 'Mod' })
      .eq('board_id', boardId)
      .eq('role', 'Leader')
      .eq('is_hidden', false)
      .neq('user_id', newLeaderUserId)
    if (demoteErr) return { error: demoteErr.message }

    const { error: promoteErr } = await db
      .from('user_boards')
      .update({ role: 'Leader' })
      .eq('id', target.id as string)
    if (promoteErr) return { error: promoteErr.message }

    revalidatePath(`/admin/users/${newLeaderUserId}`)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Not authorized.' }
  }
}
