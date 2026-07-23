-- Two ways to undo a "given away" (covered) shift when the handoff doesn't
-- actually happen: (1) the owner finalizes the accepted claim as "fell
-- through" on their Trade Record, or (2) they reactivate it directly from
-- the calendar's Given Away marker. Both should reopen the post so it can
-- be claimed again, and both should leave the claim record consistent.

-- finalize_claim(completed: false) now reopens the shift it covered, but
-- only if it's still sitting there as 'covered' from THIS claim — don't
-- resurrect a shift that's since expired, been self-deleted, or been
-- removed by a mod for an unrelated reason.
CREATE OR REPLACE FUNCTION public.finalize_claim(p_claim_id uuid, p_completed boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows integer;
  v_shift_id uuid;
BEGIN
  UPDATE public.shift_claims
  SET status = CASE WHEN p_completed THEN 'completed' ELSE 'fell_through' END,
      finalized_at = now()
  WHERE id = p_claim_id
    AND owner_id = auth.uid()
    AND status = 'accepted'
  RETURNING shift_id INTO v_shift_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 AND NOT p_completed THEN
    UPDATE public.shifts
    SET is_active = true, removed_reason = NULL, removed_by_user_id = NULL
    WHERE id = v_shift_id AND removed_reason = 'covered';
  END IF;

  RETURN v_rows > 0;
END;
$$;

-- Owner: manually reactivate a covered shift straight from the calendar,
-- without going through the Trade Record finalize flow. Also auto-finalizes
-- any still-'accepted' claim on it as 'fell_through', so the claim record
-- stays consistent regardless of which entry point the owner used.
CREATE OR REPLACE FUNCTION public.reactivate_shift(p_shift_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.shifts
  SET is_active = true, removed_reason = NULL, removed_by_user_id = NULL
  WHERE id = p_shift_id
    AND user_id = auth.uid()
    AND removed_reason = 'covered';

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    UPDATE public.shift_claims
    SET status = 'fell_through', finalized_at = now()
    WHERE shift_id = p_shift_id AND status = 'accepted';
  END IF;

  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.reactivate_shift(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_shift(uuid) TO authenticated, service_role;
