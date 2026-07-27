-- S8, part 2 of 2 — THE BREAKING HALF. APPLY ONLY AFTER DEPLOYING THE CODE
-- THAT READS INVITE CODES VIA get_board_invite_codes().
--
-- Split out from 20260730002000 deliberately. That migration is additive and
-- safe to apply any time; this one removes column access, so applying it while
-- an older bundle is still live makes every board page fail to read the code.
--
-- Why a column privilege rather than an RLS policy: RLS is row-level. The
-- boards SELECT policy has to keep letting an unapproved applicant see the
-- board row (the pending-approval UI needs the name), and a policy cannot say
-- "this row but not that column".
--
-- ⚠️ WHY THIS IS NOT A PLAIN "REVOKE SELECT (invite_code)":
-- That is what this file originally said, and it silently did nothing. A
-- column-level REVOKE cannot subtract from a table-level grant, and
-- `authenticated` holds table-wide SELECT on boards — so the column stayed
-- readable. Exactly the same class of mistake as S5, which this same migration
-- set was fixing. Caught by dry-running the revoke in a rolled-back
-- transaction and asserting the column was actually unreadable afterwards.
--
-- The working pattern is: drop the table-wide grant, then re-grant every
-- column EXCEPT the one being protected. Note this also blocks WHERE clauses
-- on invite_code, not just SELECT lists — which is why createBoard and
-- regenerateInviteCode had to stop pre-checking collisions and lean on the
-- UNIQUE constraint instead.
--
-- IF THE COLUMN LIST BELOW DRIFTS: any column added to boards after this
-- migration will be unreadable by clients until it is added to this GRANT.

REVOKE SELECT ON public.boards FROM anon, authenticated;

GRANT SELECT (id, name, slug, invite_code_enabled, created_by, is_active, created_at, updated_at)
  ON public.boards TO anon, authenticated;

-- Verification: both must be true.
DO $$
DECLARE n int; blocked boolean := false;
BEGIN
  IF has_column_privilege('authenticated', 'public.boards', 'invite_code', 'SELECT') THEN
    RAISE EXCEPTION 'invite_code is still readable by authenticated - the revoke did not take';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.boards', 'name', 'SELECT') THEN
    RAISE EXCEPTION 'boards.name became unreadable - the re-grant is wrong';
  END IF;
END $$;
