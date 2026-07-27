-- S8, part 2 of 2 — THE BREAKING HALF. APPLY ONLY AFTER DEPLOYING THE CODE
-- THAT READS INVITE CODES VIA get_board_invite_codes().
--
-- Split out from 20260730002000 deliberately. That migration is additive and
-- safe to apply any time; this one revokes column access, so applying it while
-- an older bundle is still live makes every board page fail to read the code.
--
-- Why a column revoke rather than an RLS policy: RLS is row-level. The boards
-- SELECT policy has to keep letting an unapproved applicant see the board row
-- (the pending-approval UI needs the name), and there is no way to say "this
-- row but not that column" in a policy. Column privileges are the only lever.
--
-- After this, invite_code is readable only by service_role and through
-- get_board_invite_codes(), which requires APPROVED membership (or Admin).
-- Sharing the code with any approved member stays intended behaviour.

REVOKE SELECT (invite_code) ON public.boards FROM anon, authenticated;
