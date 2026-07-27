-- Shift Bundles: a set of shifts offered as one unit — the claimant takes all
-- of them or none. Answers the "multi-day" gap beta testers hit (a Fri/Sat/Sun
-- block has to move together or it's useless to trade).
--
-- A bundle is scoped to ONE board and ONE owner (enforced by the trigger
-- below): claim eligibility is a single board-membership check, and a claimant
-- can never see a partial bundle they're not allowed to cover.
--
-- Claiming: one shift_claims row per bundle (not per shift), anchored to the
-- earliest shift. Accepting archives every shift in the bundle as 'covered'.

-- ── 1. Tables ───────────────────────────────────────────────

CREATE TABLE public.shift_bundles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  board_id   uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shift_bundles_user_idx  ON public.shift_bundles (user_id);
CREATE INDEX shift_bundles_board_idx ON public.shift_bundles (board_id);

-- ON DELETE SET NULL: losing the bundle must never delete the underlying
-- shifts — they're real calendar entries, the grouping is incidental.
ALTER TABLE public.shifts
  ADD COLUMN bundle_id uuid REFERENCES public.shift_bundles(id) ON DELETE SET NULL;

CREATE INDEX shifts_bundle_idx ON public.shifts (bundle_id) WHERE bundle_id IS NOT NULL;

-- SET NULL, not CASCADE: if a bundle dissolves under an open claim, the claim
-- degrades to a normal single-shift claim on its anchor rather than vanishing.
ALTER TABLE public.shift_claims
  ADD COLUMN bundle_id uuid REFERENCES public.shift_bundles(id) ON DELETE SET NULL;

CREATE INDEX shift_claims_bundle_idx ON public.shift_claims (bundle_id) WHERE bundle_id IS NOT NULL;

-- Bundle equivalents of the per-shift claim guards in
-- 20260717150000_trade_loop_shift_claims.sql.
CREATE UNIQUE INDEX shift_claims_one_open_per_user_bundle
  ON public.shift_claims (bundle_id, claimant_id)
  WHERE bundle_id IS NOT NULL AND status IN ('pending','accepted');

CREATE UNIQUE INDEX shift_claims_one_accepted_per_bundle
  ON public.shift_claims (bundle_id)
  WHERE bundle_id IS NOT NULL AND status = 'accepted';

-- ── 2. Integrity triggers ───────────────────────────────────

-- A bundled shift must match its bundle's board and owner. Enforced in the DB
-- because the claim path trusts bundle.board_id for its membership check.
CREATE OR REPLACE FUNCTION public.enforce_bundle_board_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board uuid;
  v_owner uuid;
BEGIN
  IF NEW.bundle_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT board_id, user_id INTO v_board, v_owner
  FROM shift_bundles WHERE id = NEW.bundle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bundle not found';
  END IF;
  IF NEW.board_id IS DISTINCT FROM v_board THEN
    RAISE EXCEPTION 'A bundled shift must be on the same board as its bundle';
  END IF;
  IF NEW.user_id IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'A bundled shift must belong to the bundle owner';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER shifts_enforce_bundle_board
  BEFORE INSERT OR UPDATE OF bundle_id, board_id, user_id ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_bundle_board_match();

-- A "bundle" of one is just a shift. When a shift LEAVES a bundle (archived,
-- deleted, or re-assigned) and exactly one active shift is left behind,
-- dissolve the grouping so the Wall stops showing a bundle icon on a lone
-- card. Zero active shifts is left alone: that's the covered case, and the
-- bundle_id is worth keeping for the claim record.
CREATE OR REPLACE FUNCTION public.dissolve_thin_bundle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active integer;
BEGIN
  IF OLD.bundle_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_active
  FROM shifts WHERE bundle_id = OLD.bundle_id AND is_active = true;

  -- Recursion stops naturally: the UPDATE below re-fires this trigger with
  -- zero active shifts left on the old bundle, which falls through.
  IF v_active = 1 THEN
    UPDATE shifts SET bundle_id = NULL WHERE bundle_id = OLD.bundle_id;
    DELETE FROM shift_bundles WHERE id = OLD.bundle_id;
  END IF;

  RETURN NULL;
END;
$$;

-- The WHEN clause is load-bearing: without it, ADDING the first shift to a
-- fresh bundle would momentarily leave a count of 1 and dissolve the bundle
-- the client is still assembling. Only firing on departure avoids that.
CREATE TRIGGER shifts_dissolve_thin_bundle
  AFTER UPDATE OF is_active, bundle_id ON public.shifts
  FOR EACH ROW
  WHEN (
    (OLD.is_active = true AND NEW.is_active = false)
    OR (OLD.bundle_id IS NOT NULL AND NEW.bundle_id IS DISTINCT FROM OLD.bundle_id)
  )
  EXECUTE FUNCTION public.dissolve_thin_bundle();

CREATE TRIGGER shifts_dissolve_thin_bundle_delete
  AFTER DELETE ON public.shifts
  FOR EACH ROW
  WHEN (OLD.bundle_id IS NOT NULL)
  EXECUTE FUNCTION public.dissolve_thin_bundle();

-- Trigger-only functions must not be reachable as PostgREST RPCs (same
-- hardening as 20260701153736_harden_trigger_functions.sql).
REVOKE EXECUTE ON FUNCTION public.enforce_bundle_board_match() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dissolve_thin_bundle()       FROM anon, authenticated;

-- ── 3. RLS ──────────────────────────────────────────────────

ALTER TABLE public.shift_bundles ENABLE ROW LEVEL SECURITY;

-- auth.uid() wrapped in a SELECT per 20260719120000_rls_initplan_auth_wrap.sql.
CREATE POLICY shift_bundles_select_board_members ON public.shift_bundles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR is_board_member(board_id));

CREATE POLICY shift_bundles_insert_own ON public.shift_bundles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND is_board_member(board_id));

CREATE POLICY shift_bundles_delete_own ON public.shift_bundles
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── 4. Claim RPCs ───────────────────────────────────────────

-- Claimant: "I'll take all of these." One claim row for the whole bundle,
-- anchored to the earliest still-active shift.
CREATE OR REPLACE FUNCTION public.claim_bundle(p_bundle_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bundle RECORD;
  v_anchor uuid;
  v_claim_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, user_id, board_id INTO v_bundle
  FROM shift_bundles WHERE id = p_bundle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'These shifts are no longer bundled';
  END IF;
  IF v_bundle.user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot claim your own shifts';
  END IF;
  IF NOT is_board_member(v_bundle.board_id) THEN
    RAISE EXCEPTION 'You must be a member of this board to claim these shifts';
  END IF;

  SELECT id INTO v_anchor
  FROM shifts
  WHERE bundle_id = p_bundle_id AND is_active = true AND expires_at > now()
  ORDER BY start_time
  LIMIT 1;

  IF v_anchor IS NULL THEN
    RAISE EXCEPTION 'These shifts are no longer active';
  END IF;

  INSERT INTO shift_claims (shift_id, claimant_id, owner_id, board_id, bundle_id)
  VALUES (v_anchor, auth.uid(), v_bundle.user_id, v_bundle.board_id, p_bundle_id)
  RETURNING id INTO v_claim_id;

  RETURN v_claim_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'You already have an open claim on these shifts';
END;
$$;

-- Replaces the Task 21 version: identical for single-shift claims, but a
-- bundle claim resolves against every shift in the bundle at once.
CREATE OR REPLACE FUNCTION public.respond_to_claim(p_claim_id uuid, p_accept boolean)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_claim RECORD;
  v_rivals uuid[] := '{}';
BEGIN
  SELECT id, shift_id, bundle_id, owner_id, status
  INTO v_claim
  FROM public.shift_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;
  IF v_claim.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the shift owner can respond to this claim';
  END IF;
  IF v_claim.status <> 'pending' THEN
    RAISE EXCEPTION 'This claim has already been resolved';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.shift_claims
    SET status = 'declined', responded_at = now()
    WHERE id = p_claim_id;
    RETURN v_rivals;
  END IF;

  UPDATE public.shift_claims
  SET status = 'accepted', responded_at = now()
  WHERE id = p_claim_id;

  IF v_claim.bundle_id IS NOT NULL THEN
    WITH declined AS (
      UPDATE public.shift_claims
      SET status = 'declined', responded_at = now()
      WHERE bundle_id = v_claim.bundle_id
        AND id <> p_claim_id
        AND status = 'pending'
      RETURNING claimant_id
    )
    SELECT COALESCE(array_agg(claimant_id), '{}') INTO v_rivals FROM declined;

    UPDATE public.shifts
    SET is_active = false,
        removed_reason = 'covered',
        removed_by_user_id = auth.uid()
    WHERE bundle_id = v_claim.bundle_id AND is_active = true;
  ELSE
    WITH declined AS (
      UPDATE public.shift_claims
      SET status = 'declined', responded_at = now()
      WHERE shift_id = v_claim.shift_id
        AND id <> p_claim_id
        AND status = 'pending'
      RETURNING claimant_id
    )
    SELECT COALESCE(array_agg(claimant_id), '{}') INTO v_rivals FROM declined;

    UPDATE public.shifts
    SET is_active = false,
        removed_reason = 'covered',
        removed_by_user_id = auth.uid()
    WHERE id = v_claim.shift_id;
  END IF;

  RETURN v_rivals;
END;
$$;

-- Bystander-visible pending counts, same rationale as
-- 20260723150000_shift_claim_counts.sql (a bare count isn't sensitive).
CREATE OR REPLACE FUNCTION public.get_bundle_claim_counts(p_bundle_ids uuid[])
RETURNS TABLE (bundle_id uuid, pending_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.bundle_id, COUNT(*)::int
  FROM public.shift_claims c
  WHERE c.bundle_id = ANY(p_bundle_ids) AND c.status = 'pending'
  GROUP BY c.bundle_id
$$;

REVOKE ALL ON FUNCTION public.claim_bundle(uuid)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_bundle_claim_counts(uuid[])     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_bundle(uuid)               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_bundle_claim_counts(uuid[])  TO authenticated, service_role;
