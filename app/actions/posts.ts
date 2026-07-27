'use server'

import { getActionSession } from '@/lib/auth/session'

export async function deactivateShift(id: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()

    const { data, error } = await supabase
      .rpc('deactivate_own_shift', { p_shift_id: id })

    if (error) return { error: error.message }
    if (!data) return { error: 'Post not found or you do not own it.' }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Take a shift off the Wall but keep it on the owner's calendar — clears the
 * Trade/Giveaway flags rather than deactivating the row. Distinct from
 * deactivateShift, which sets is_active = false and therefore drops the shift
 * from the calendar too (the calendar only queries is_active shifts).
 */
export async function unpostShift(id: string): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await getActionSession()

    const { data, error } = await supabase
      .from('shifts')
      .update({ is_trade: false, is_giveaway: false })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')

    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: 'Post not found or you do not own it.' }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Break up a bundle, leaving every member as a standalone shift. Used when
 * one shift is deleted or pulled off the Wall: the bundle was an all-or-
 * nothing package, so losing a piece invalidates the offer — but the
 * remaining shifts are still real, and stay posted individually.
 */
export async function dissolveBundle(bundleId: string): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await getActionSession()

    const { error } = await supabase
      .from('shifts')
      .update({ bundle_id: null })
      .eq('bundle_id', bundleId)
      .eq('user_id', userId)
    if (error) return { error: error.message }

    // Ignore a delete failure: with no members left the row is inert, and the
    // caller's real action (delete/unpost) has already succeeded.
    await supabase.from('shift_bundles').delete().eq('id', bundleId).eq('user_id', userId)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function deactivateRequest(id: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()

    const { data, error } = await supabase
      .rpc('deactivate_own_request', { p_request_id: id })

    if (error) return { error: error.message }
    if (!data) return { error: 'Post not found or you do not own it.' }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Mark a request as fulfilled — someone covered it outside the claim system
 * (requests have no claim/accept flow of their own). Distinct from
 * deactivateRequest: this records a real outcome instead of "removed reason
 * unknown," which is what the admin stats' request-outcomes chart reads.
 */
export async function fulfillRequest(id: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()

    const { data, error } = await supabase
      .rpc('fulfill_own_request', { p_request_id: id })

    if (error) return { error: error.message }
    if (!data) return { error: 'Post not found or you do not own it.' }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
