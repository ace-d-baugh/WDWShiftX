-- =====================================================================
--  WDWShiftX — Security fixes, STEP 1 of 2
--  Generated 2026-07-27. Safe to run RIGHT NOW, on the live database.
-- =====================================================================
--
--  WHY YOU'RE RUNNING THIS BY HAND
--  Claude can reach the MyShiftX Supabase project directly, but not this
--  one — it's on a different Supabase account. These are the same changes
--  already applied and verified on MyShiftX.
--
--  HOW TO RUN
--    1. Open the Supabase dashboard for WDWShiftX (project knzbsitknjozjhramlju)
--    2. Go to SQL Editor -> New query
--    3. Paste this entire file and press Run
--    4. Scroll to the bottom — the last query prints a pass/fail check
--
--  IS THIS SAFE WHILE THE SITE IS LIVE?
--  Yes. Everything here either adds something new or tightens a function
--  the app already calls in a way the current code still works with.
--  Nothing is dropped, no data is touched, and no page breaks.
--
--  THERE IS A STEP 2. Do NOT run it yet — see APPLY_TO_DATABASE_STEP2_
--  AFTER_DEPLOY.sql. It must wait until the new app code is deployed.
--
--  This whole file runs in one transaction: if any part fails, nothing is
--  applied and you can just re-run it after telling Claude the error.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
--  S2 — Stop the photo-import limit being bypassed
--  (migration 20260730000000_atomic_schedule_import_quota.sql)
--
--  The old flow checked "how many imports left?", then spent 5-60 seconds
--  calling Google's paid AI, then subtracted one. Fifty uploads fired at
--  once all passed a check none of them had yet subtracted from, so all
--  fifty were billed. This checks and subtracts in a single locked step.
--
--  set_config('myshiftx.allow_import_update', ...) is NOT a typo. That
--  setting name predates the fork and is what the existing protection
--  trigger looks for; renaming it would silently block the write.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reserve_schedule_import()
RETURNS TABLE (reserved boolean, used integer, import_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month        text := to_char(now() AT TIME ZONE 'America/New_York', 'YYYY-MM');
  v_membership   text;
  v_used         integer;
  v_stored_month text;
  v_limit        integer;
BEGIN
  SELECT u.membership, u.schedule_import_count, u.schedule_import_month
    INTO v_membership, v_used, v_stored_month
  FROM public.users u
  WHERE u.id = auth.uid()
  FOR UPDATE;

  IF v_membership IS NULL THEN
    reserved := false; used := 0; import_limit := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_stored_month IS DISTINCT FROM v_month THEN
    v_used := 0;
  END IF;

  v_limit := CASE WHEN v_membership IN ('Pro', 'Trial') THEN -1 ELSE 4 END;

  IF v_limit >= 0 AND v_used >= v_limit THEN
    reserved := false; used := v_used; import_limit := v_limit;
    RETURN NEXT;
    RETURN;
  END IF;

  PERFORM set_config('myshiftx.allow_import_update', '1', true);
  UPDATE public.users
     SET schedule_import_count = v_used + 1,
         schedule_import_month = v_month
   WHERE id = auth.uid();

  reserved := true; used := v_used + 1; import_limit := v_limit;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_schedule_import()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month text := to_char(now() AT TIME ZONE 'America/New_York', 'YYYY-MM');
BEGIN
  PERFORM set_config('myshiftx.allow_import_update', '1', true);
  UPDATE public.users
     SET schedule_import_count = GREATEST(schedule_import_count - 1, 0)
   WHERE id = auth.uid()
     AND schedule_import_month = v_month;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_schedule_import() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_schedule_import() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_schedule_import() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_schedule_import() TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────
--  S4 — A person's trade record is theirs alone (plus Overlord)
--  (migration 20260730001000_trade_stats_owner_only.sql)
--
--  This function had no check on WHO was asking. Any logged-in user could
--  pull anyone's completed / backed-out counts given their id — including
--  people on boards they'd since left. Now: yourself, or an Overlord.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_trade_stats_for_users(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, picked_up integer, covered integer, fell_through integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT u.uid AS user_id,
    (SELECT COUNT(*) FROM public.shift_claims c
      WHERE c.claimant_id = u.uid AND c.status = 'completed')::int AS picked_up,
    (SELECT COUNT(*) FROM public.shift_claims c
      WHERE c.owner_id = u.uid AND c.status = 'completed')::int AS covered,
    (SELECT COUNT(*) FROM public.shift_claims c
      WHERE c.claimant_id = u.uid AND c.status = 'fell_through')::int AS fell_through
  FROM unnest(p_user_ids[1:200]) AS u(uid)
  WHERE u.uid = (SELECT auth.uid())
     OR public.get_user_role() = 'admin';
$function$;

REVOKE ALL ON FUNCTION public.get_trade_stats_for_users(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trade_stats_for_users(uuid[]) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────
--  S5 — Make a lock-down that never worked actually work
--  (part of migration 20260730002000)
--
--  The shift-bundles migration tried to hide two internal functions with
--  "REVOKE ... FROM anon, authenticated". Postgres grants these to
--  PUBLIC by default, so revoking only the named roles left them open.
--  This one came from this repo originally and was copied to MyShiftX.
-- ─────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.enforce_bundle_board_match() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dissolve_thin_bundle()       FROM PUBLIC, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────
--  S7 — "How many people want this shift?" only for your own boards
--  (part of migration 20260730002000)
--
--  These returned a count for ANY shift id, including boards the caller
--  has nothing to do with, and accepted an unlimited list of ids.
-- ─────────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────────
--  S8 (safe half) — a gated way to read a board's invite code
--  (part of migration 20260730002000)
--
--  Adds the function only. It does NOT yet stop the old direct access —
--  that's STEP 2, which has to wait for the app code. Adding this now is
--  harmless and lets the new code work the moment it deploys.
-- ─────────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────────
--  Bookkeeping — tell Supabase these migrations are already applied
--
--  Without this, the next `supabase db push` would try to run the same
--  files again. Versions match the .sql filenames in supabase/migrations
--  exactly, which is what the CLI compares against.
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('20260730000000', 'atomic_schedule_import_quota'),
  ('20260730001000', 'trade_stats_owner_only'),
  ('20260730002000', 'db_hardening_s5_s7_s8')
ON CONFLICT (version) DO NOTHING;

COMMIT;


-- =====================================================================
--  VERIFICATION — every column below should read PASS
-- =====================================================================
SELECT
  CASE WHEN to_regprocedure('public.reserve_schedule_import()') IS NOT NULL
       THEN 'PASS' ELSE 'FAIL' END                                   AS s2_quota_guard,
  CASE WHEN to_regprocedure('public.get_board_invite_codes(uuid[])') IS NOT NULL
       THEN 'PASS' ELSE 'FAIL' END                                   AS s8_code_function,
  CASE WHEN NOT has_function_privilege('authenticated',
              'public.dissolve_thin_bundle()', 'EXECUTE')
       THEN 'PASS' ELSE 'FAIL' END                                   AS s5_trigger_locked,
  CASE WHEN (SELECT count(*) FROM public.get_trade_stats_for_users(
              (SELECT coalesce(array_agg(id), '{}') FROM (SELECT id FROM public.users LIMIT 5) x))) = 0
       THEN 'PASS' ELSE 'FAIL' END                                   AS s4_stats_private,
  CASE WHEN (SELECT count(*) FROM public.get_board_invite_codes(
              (SELECT coalesce(array_agg(id), '{}') FROM public.boards))) = 0
       THEN 'PASS' ELSE 'FAIL' END                                   AS s8_codes_private;
-- The two "private" checks pass because the SQL Editor runs as an admin-less
-- role with no logged-in user, so the functions correctly return nothing.
