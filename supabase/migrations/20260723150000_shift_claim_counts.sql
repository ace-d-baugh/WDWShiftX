-- The compact "I'll take this" control needs to show how many people have
-- already claimed a shift to EVERY viewer, not just the owner — but
-- shift_claims_select_parties only lets the claimant or owner see a given
-- row. A bystander has no way to see individual claims (correctly — identity
-- of who claimed stays private to the owner), but a bare count isn't
-- sensitive, so expose that much via a SECURITY DEFINER aggregate.
CREATE OR REPLACE FUNCTION public.get_shift_claim_counts(p_shift_ids uuid[])
RETURNS TABLE (shift_id uuid, pending_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.shift_id, COUNT(*)::int
  FROM public.shift_claims c
  WHERE c.shift_id = ANY(p_shift_ids) AND c.status = 'pending'
  GROUP BY c.shift_id
$$;

REVOKE ALL ON FUNCTION public.get_shift_claim_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shift_claim_counts(uuid[]) TO authenticated, service_role;
