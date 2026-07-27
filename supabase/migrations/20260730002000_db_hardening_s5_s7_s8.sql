-- S5 + S7 + S8: three database-side hardening fixes.

-- ── S5: REVOKE that actually revokes ────────────────────────────────────────
-- 20260726120000_shift_bundles.sql tried to hide these trigger-only functions
-- with "REVOKE EXECUTE ... FROM anon, authenticated". That does nothing on its
-- own: EXECUTE is granted to PUBLIC by default, and revoking the named roles
-- leaves the PUBLIC grant in place, so both stayed callable as PostgREST RPCs.
-- Postgres refuses to run a trigger function outside trigger context, so there
-- was no direct exploit -- but the hardening was inert while claiming not to
-- be, and the same idiom on a non-trigger function would be exploitable.
-- 20260701153736_harden_trigger_functions.sql got this right (FROM PUBLIC, anon).
REVOKE ALL ON FUNCTION public.enforce_bundle_board_match() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dissolve_thin_bundle()       FROM PUBLIC, anon, authenticated;

-- ── S7: scope the claim-count aggregates ────────────────────────────────────
-- These deliberately expose a bare count with no identity attached, which is
-- fine. What wasn't fine: they answered for ANY post id, including posts on
-- boards the caller has no relationship with, so a former member could keep
-- monitoring hiring pressure on a board they'd been removed from. They also
-- accepted an unbounded array, making a single request arbitrarily expensive.
CREATE OR REPLACE FUNCTION public.get_shift_claim_counts(p_shift_ids uuid[])
RETURNS TABLE (shift_id uuid, pending_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.shift_id, COUNT(*)::int
  FROM public.shift_claims c
  JOIN public.shifts s ON s.id = c.shift_id
  WHERE c.shift_id = ANY(p_shift_ids[1:500])
    AND c.status = 'pending'
    AND s.board_id IS NOT NULL
    AND public.is_board_member(s.board_id)
  GROUP BY c.shift_id
$function$;

CREATE OR REPLACE FUNCTION public.get_bundle_claim_counts(p_bundle_ids uuid[])
RETURNS TABLE (bundle_id uuid, pending_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.bundle_id, COUNT(*)::int
  FROM public.shift_claims c
  JOIN public.shift_bundles b ON b.id = c.bundle_id
  WHERE c.bundle_id = ANY(p_bundle_ids[1:500])
    AND c.status = 'pending'
    AND public.is_board_member(b.board_id)
  GROUP BY c.bundle_id
$function$;

REVOKE ALL ON FUNCTION public.get_shift_claim_counts(uuid[])  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_bundle_claim_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shift_claim_counts(uuid[])  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_bundle_claim_counts(uuid[]) TO authenticated, service_role;

-- ── S8: stop leaking invite_code to unapproved applicants ───────────────────
-- boards_select_member grants SELECT to is_board_applicant(id) -- someone with
-- a PENDING, unapproved membership row. RLS is row-level, so that exposed the
-- whole row including invite_code.
--
-- That is a live credential leak, because becoming an applicant does not
-- require the code: user_boards_insert_own only checks
-- "user_id = auth.uid() AND role IN ('user','admin')", so any verified user can
-- self-insert a pending row for any board id, and /boards/[slug] hands a
-- non-member the board id. Insert a pending row, read the code, done.
--
-- Fix the disclosure at the column level (RLS can't express this): revoke
-- SELECT on invite_code from client roles entirely, and serve it through a
-- function gated on APPROVED membership. Sharing the code with any approved
-- member is intended product behaviour -- the invite pill is shown to all
-- roles -- so is_board_member() (which requires is_approved = true) is exactly
-- the right gate.
--
-- NOTE: this does NOT fix the self-insert itself, which also lets anyone flood
-- a board's approval queue. That is tracked separately as S16.
--
-- DEPLOY ORDER MATTERS. This file only ADDS the function; it does not revoke
-- anything, so it is safe to apply against a running app. The actual
-- REVOKE SELECT (invite_code) lives in 20260730003000 and must be applied only
-- AFTER the code that reads codes through this function is deployed --
-- otherwise every board page breaks the moment the column is locked.
CREATE OR REPLACE FUNCTION public.get_board_invite_codes(p_board_ids uuid[])
RETURNS TABLE (board_id uuid, invite_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT b.id, b.invite_code
  FROM public.boards b
  WHERE b.id = ANY(p_board_ids[1:200])
    AND (public.is_board_member(b.id) OR public.get_user_role() = 'admin')
$function$;

REVOKE ALL ON FUNCTION public.get_board_invite_codes(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_board_invite_codes(uuid[]) TO authenticated, service_role;
