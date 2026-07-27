-- =====================================================================
--  WDWShiftX — Security fixes, STEP 2 of 2
--  ⚠️  DO NOT RUN THIS YET. Read the checklist below first.
-- =====================================================================
--
--  WHAT THIS DOES
--  Closes the invite-code leak (S8) by removing the app's ability to read
--  board invite codes directly. After this, codes come only from
--  get_board_invite_codes(), which requires APPROVED membership.
--
--  WHY IT'S SEPARATE FROM STEP 1
--  This is the one change that BREAKS THE LIVE SITE if run too early.
--  The current app code reads invite_code straight off the boards table.
--  The moment this runs, those reads return an error and every board page
--  fails — until the new code is deployed. Step 1 was safe at any time;
--  this one is not.
--
--  RUN THIS ONLY WHEN ALL THREE ARE TRUE
--    [ ] 1. STEP 1 has been run successfully (all checks read PASS)
--    [ ] 2. The app code that reads codes via get_board_invite_codes()
--           has been written, committed, AND deployed to production
--    [ ] 3. You've loaded a board page on the live site and the invite
--           code still displays correctly
--
--  As of 2026-07-27 item 2 is NOT done yet — Claude still has that code
--  change to make. Wait for it.
--
--  HOW TO RUN (once the above is true)
--    Supabase dashboard -> SQL Editor -> New query -> paste -> Run
--
--  IF SOMETHING GOES WRONG
--  This is reversible. To undo:
--      GRANT SELECT (invite_code) ON public.boards TO authenticated;
--  That restores the previous behaviour immediately.
-- =====================================================================

BEGIN;

REVOKE SELECT (invite_code) ON public.boards FROM anon, authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260730003000', 'lock_invite_code_column')
ON CONFLICT (version) DO NOTHING;

COMMIT;


-- =====================================================================
--  VERIFICATION — should read PASS
-- =====================================================================
SELECT
  CASE WHEN NOT has_column_privilege('authenticated', 'public.boards', 'invite_code', 'SELECT')
       THEN 'PASS' ELSE 'FAIL' END AS invite_code_locked,
  CASE WHEN has_column_privilege('service_role', 'public.boards', 'invite_code', 'SELECT')
       THEN 'PASS' ELSE 'FAIL' END AS service_role_still_reads;
