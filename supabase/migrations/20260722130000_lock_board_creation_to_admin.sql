-- WDW ShiftX is locked to exactly two pre-seeded boards with self-serve
-- board creation disabled. The createBoard() server action is short-circuited
-- in app code, but that's UI/app-layer only — tighten the RLS policy itself
-- so a direct Data API call from a regular User can't insert a boards row
-- either. Admins keep insert access for one-off maintenance from the
-- Overlord panel or direct SQL.

DROP POLICY IF EXISTS "boards_insert_user" ON public.boards;

CREATE POLICY "boards_insert_admin"
  ON public.boards FOR INSERT
  WITH CHECK (get_user_role() = 'admin');
