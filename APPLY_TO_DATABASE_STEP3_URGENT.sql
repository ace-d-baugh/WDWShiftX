-- =====================================================================
--  WDWShiftX — STEP 3.  🔴 URGENT — RUN THIS AS SOON AS YOU CAN.
--
--  ✅ SAFE TO RUN RIGHT NOW. Unlike STEP 2, this does NOT wait for a
--     deploy. It works with the code that is live today and with the new
--     code equally. There is no ordering trap here.
-- =====================================================================
--
--  WHAT'S WRONG
--  Any logged-in account can currently make itself the ADMIN of any board
--  in the app — including boards it has nothing to do with.
--
--  The database rule that governs "can you add yourself to a board?"
--  checked only that the row you were inserting was your own. It never
--  checked what ROLE you were giving yourself, or whether you were
--  marking yourself as already approved. So someone could add themselves
--  as an approved Leader of any board and immediately:
--     - read every shift and request posted on it
--     - see the full member list
--     - remove members and change their roles
--     - transfer ownership, or delete the board outright
--     - read the board's invite code
--
--  It also defeats the invite-code lock you applied in STEP 2, because a
--  self-promoted Leader counts as an approved member.
--
--  This was confirmed by actually performing the attack against the
--  MyShiftX database as an ordinary test user, inside a transaction that
--  was rolled back. It worked. It is now fixed there, and this file is
--  the same fix for this project.
--
--  WHAT THIS CHANGES
--  The rule now allows only the two things the app genuinely does:
--     (a) asking to join a board  -> always a plain member, always pending
--     (b) creating a board        -> Leader, but only on your own new board
--  Everything else is refused. Approving members still works normally —
--  that is a separate rule this does not touch.
--
--  HOW TO RUN
--    Supabase dashboard -> SQL Editor -> New query -> paste -> Run
--    The checks at the bottom must all read PASS.
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS user_boards_insert_own ON public.user_boards;

CREATE POLICY user_boards_insert_own ON public.user_boards
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.get_user_role() = ANY (ARRAY['user', 'admin'])
    AND (
      (role = 'User' AND is_approved = false)
      OR
      (role = 'Leader' AND EXISTS (
        SELECT 1 FROM public.boards b
        WHERE b.id = board_id
          AND b.created_by = (SELECT auth.uid())
      ))
    )
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260730005000', 's16_restrict_user_boards_insert')
ON CONFLICT (version) DO NOTHING;

COMMIT;


-- =====================================================================
--  CHECK 1 — the policy is in place. Should read PASS.
-- =====================================================================
SELECT CASE
         WHEN (SELECT with_check FROM pg_policies
                WHERE schemaname='public' AND tablename='user_boards'
                  AND policyname='user_boards_insert_own') LIKE '%is_approved%'
         THEN 'PASS' ELSE 'FAIL' END AS policy_now_checks_role_and_approval;


-- =====================================================================
--  CHECK 2 — has anyone already used this? Should return NO ROWS.
--
--  A self-inserted membership is approved with nobody recorded as having
--  approved it, and belongs to someone who is neither the board's creator
--  nor a global Overlord (Overlords are auto-added to every board for
--  oversight, which legitimately leaves no approver).
--
--  If this returns rows, tell Claude — those accounts granted themselves
--  access and should be reviewed and removed.
-- =====================================================================
SELECT ub.user_id, u.display_name, ub.role, b.name AS board_name, ub.requested_at
FROM public.user_boards ub
JOIN public.boards b ON b.id = ub.board_id
JOIN public.users  u ON u.id = ub.user_id
WHERE ub.is_approved = true
  AND ub.approved_by_user_id IS NULL
  AND u.role <> 'Admin'
  AND b.created_by IS DISTINCT FROM ub.user_id;
