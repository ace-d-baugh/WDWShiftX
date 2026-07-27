-- =====================================================================
--  WDWShiftX — Security fixes, STEP 2 of 2
--  ⚠️  DO NOT RUN THIS YET. Read the checklist below first.
--
--  ⚠️  THIS FILE WAS CORRECTED ON 2026-07-27. If you saved a copy of the
--      earlier version, throw it away — it would have appeared to succeed
--      while actually changing nothing. Details under "WHY THE FIRST
--      VERSION WAS WRONG" below.
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
--  The moment this runs, those reads fail and board pages break — until
--  the new code is deployed. Step 1 was safe at any time; this is not.
--
--  RUN THIS ONLY WHEN ALL THREE ARE TRUE
--    [ ] 1. STEP 1 has been run successfully (done — all PASS, 2026-07-27)
--    [ ] 2. The app code that reads codes via get_board_invite_codes()
--           has been written, committed, AND deployed to production
--    [ ] 3. You've loaded a board page on the live site and the invite
--           code still displays correctly
--
--  Item 2 is IN PROGRESS as of 2026-07-27 — the MyShiftX side is written,
--  the WDWShiftX side is not yet. Wait for Claude to confirm.
--
--  HOW TO RUN (once the above is true)
--    Supabase dashboard -> SQL Editor -> New query -> paste -> Run
--
--  IF SOMETHING GOES WRONG — one line restores the old behaviour:
--      GRANT SELECT ON public.boards TO anon, authenticated;
--
--  WHY THE FIRST VERSION OF THIS FILE WAS WRONG
--  It said REVOKE SELECT (invite_code) ON public.boards. That looks right
--  and runs without error, but does nothing: a column-level REVOKE cannot
--  subtract from a table-level grant, and both anon and authenticated hold
--  table-wide SELECT on boards. The column stayed fully readable.
--  This is the same class of bug as S5 — a REVOKE that doesn't revoke.
--  It was caught by dry-running it in a rolled-back transaction and then
--  asserting the column really was unreadable, rather than assuming.
--  The working pattern, below, drops the table-wide grant and re-grants
--  every column except invite_code.
-- =====================================================================

BEGIN;

REVOKE SELECT ON public.boards FROM anon, authenticated;

GRANT SELECT (id, name, slug, invite_code_enabled, created_by, is_active, created_at, updated_at)
  ON public.boards TO anon, authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260730003000', 'lock_invite_code_column')
ON CONFLICT (version) DO NOTHING;

COMMIT;


-- =====================================================================
--  VERIFICATION — both columns must read PASS.
--  If invite_code_locked says FAIL, the change did not take effect;
--  do not assume it worked just because the query ran without an error.
-- =====================================================================
SELECT
  CASE WHEN NOT has_column_privilege('authenticated', 'public.boards', 'invite_code', 'SELECT')
       THEN 'PASS' ELSE 'FAIL' END AS invite_code_locked,
  CASE WHEN has_column_privilege('authenticated', 'public.boards', 'name', 'SELECT')
       THEN 'PASS' ELSE 'FAIL' END AS other_columns_still_readable;
