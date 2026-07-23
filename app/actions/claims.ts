'use server'

import { revalidatePath } from 'next/cache'
import { getActionSession } from '@/lib/auth/session'
import { notifyClaimCreated, notifyClaimResolved, notifyClaimFinalized } from '@/app/actions/notifications'

/** Claimant: "I'll take this shift". Creates a pending claim and notifies the owner. */
export async function claimShift(shiftId: string): Promise<{ error?: string; claimId?: string }> {
  try {
    const { supabase } = await getActionSession()

    const { data, error } = await supabase.rpc('claim_shift', { p_shift_id: shiftId })
    if (error) return { error: error.message }

    void notifyClaimCreated(data)
    return { claimId: data }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Owner: accept or decline a pending claim. Accepting archives the post as
 * covered and auto-declines rival pending claims (they get a push).
 */
export async function respondToClaim(claimId: string, accept: boolean): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()

    const { data: rivalIds, error } = await supabase.rpc('respond_to_claim', {
      p_claim_id: claimId,
      p_accept: accept,
    })
    if (error) return { error: error.message }

    void notifyClaimResolved(claimId, accept, rivalIds ?? [])
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/** Claimant: withdraw a pending claim. */
export async function withdrawClaim(claimId: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()

    const { data, error } = await supabase.rpc('withdraw_claim', { p_claim_id: claimId })
    if (error) return { error: error.message }
    if (!data) return { error: 'Claim not found or already resolved.' }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Owner: record whether an accepted trade actually went through. A "fell
 * through" outcome reopens the shift (see finalize_claim() in
 * 20260723140000_reactivate_covered_shift.sql) so it goes back on the wall.
 */
export async function finalizeClaim(claimId: string, completed: boolean): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()

    const { data, error } = await supabase.rpc('finalize_claim', {
      p_claim_id: claimId,
      p_completed: completed,
    })
    if (error) return { error: error.message }
    if (!data) return { error: 'Claim not found or not awaiting confirmation.' }

    void notifyClaimFinalized(claimId, completed)
    if (!completed) revalidatePath('/calendar')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Owner: reactivate a covered shift directly (e.g. from the calendar's
 * Given Away marker) without going through claim finalization. Also
 * auto-finalizes any still-accepted claim on it as fell-through, so the
 * claim record stays consistent either way.
 */
export async function reactivateShift(shiftId: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()

    const { data, error } = await supabase.rpc('reactivate_shift', { p_shift_id: shiftId })
    if (error) return { error: error.message }
    if (!data) return { error: 'Shift not found, not yours, or not currently given away.' }

    revalidatePath('/calendar')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
