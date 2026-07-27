-- S16 (CRITICAL): user_boards_insert_own permitted a full authorization bypass.
--
-- The policy's WITH CHECK was:
--     user_id = auth.uid() AND get_user_role() IN ('user','admin')
--
-- It constrained WHOSE row you could insert, but said nothing about `role` or
-- `is_approved`. So any verified account could insert itself as
-- (role='Leader', is_approved=true) on ANY board id -- instantly becoming that
-- board's Admin, able to read every post, list and remove members, change
-- roles, transfer ownership, delete the board, and read its invite code.
--
-- Verified by impersonating an ordinary user (SET ROLE authenticated with a
-- forged request.jwt.claims) inside a rolled-back transaction: the insert
-- succeeded and the row was there.
--
-- This also defeated the S8 invite-code lock, since a self-promoted Leader is
-- an approved member and therefore satisfies is_board_member().
--
-- The audit originally logged this as "can queue a join request without a
-- code" (High). That undersold it -- the missing constraint was on role and
-- approval state, not merely on which board.
--
-- Replaced with a policy permitting only the two shapes the app actually
-- creates, so the privileged shapes are unreachable from a client:
--   (a) requesting to join   -> always role='User', always is_approved=false
--   (b) creating a board     -> Leader, but only on a board you created
--
-- Self-approving, self-promoting, and inserting on someone else's behalf are
-- all now rejected. Moderator approval still flows through the UPDATE policy,
-- and auto_add_admins_to_board is SECURITY DEFINER so it bypasses RLS as before.
--
-- Safe to apply ahead of any deploy: both inserts the current code performs
-- (createBoard's Leader upsert, confirmJoinBoard's pending insert) still
-- satisfy this, so nothing breaks either way.

DROP POLICY IF EXISTS user_boards_insert_own ON public.user_boards;

CREATE POLICY user_boards_insert_own ON public.user_boards
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.get_user_role() = ANY (ARRAY['user', 'admin'])
    AND (
      -- (a) a join request: pending, and never anything but a plain member
      (role = 'User' AND is_approved = false)
      OR
      -- (b) the creator of a board taking Leader on that same board
      (role = 'Leader' AND EXISTS (
        SELECT 1 FROM public.boards b
        WHERE b.id = board_id
          AND b.created_by = (SELECT auth.uid())
      ))
    )
  );
