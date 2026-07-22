-- Fixes from a broader audit pass (architecture / async / business-logic / RLS):

-- 1. set_request_expires_at() computed expires_at in the DB session's timezone
--    (UTC on Supabase) instead of America/New_York. A request for "today" was
--    expiring ~4-5 hours early (around 7-8 PM ET instead of midnight ET),
--    silently breaking the documented "same date (ET)" matching rule every day.
CREATE OR REPLACE FUNCTION public.set_request_expires_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.expires_at = (
    (NEW.requested_date + INTERVAL '1 day' - INTERVAL '1 second')
    AT TIME ZONE 'America/New_York'
  );
  RETURN NEW;
END;
$function$;

-- 2. boards.slug had no uniqueness enforcement at all (only name/invite_code
--    were unique) — a genuine check-then-insert race in createBoard() could
--    produce two boards with the same slug, breaking /boards/[slug] routing.
-- The column itself predates migration history (added by hand on the original
-- project, like the other gaps found in this fork); stub it for fresh installs.
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL;
ALTER TABLE public.boards ADD CONSTRAINT boards_slug_key UNIQUE (slug);

-- 3. The "quick interest" pill in CommentSection.tsx checks in-memory state
--    before inserting a placeholder comment row; a fast double-click or two
--    open tabs could both pass the check and both insert, double-firing the
--    interest-notification email. Partial unique index closes the race at
--    the DB level for that specific pattern (post_type, post_id, user_id)
--    without constraining a user's ability to leave multiple real comments
--    with the interest checkbox checked.
CREATE UNIQUE INDEX idx_comments_unique_quick_interest
  ON public.comments (post_type, post_id, user_id)
  WHERE is_interested = true AND body = 'I''m interested!' AND is_active = true;

-- 4. user_boards_update_moderator's WITH CHECK allowed ANY board Mod (not just
--    a Leader) to write role='Leader' via a direct table update — the app-level
--    "Leader only" checks in transferBoardOwnership/updateUserBoardRole were
--    never actually enforced at the RLS boundary, so a raw Supabase client call
--    (using the public anon key) could bypass them entirely. Tighten the CHECK
--    so only a current Leader or Admin can ever write role='Leader'.
DROP POLICY IF EXISTS "user_boards_update_moderator" ON public.user_boards;
CREATE POLICY "user_boards_update_moderator" ON public.user_boards
  FOR UPDATE
  USING (is_board_moderator(board_id) OR get_user_role() = 'admin')
  WITH CHECK (
    get_user_role() = 'admin'
    OR is_board_leader(board_id)
    OR (is_board_moderator(board_id) AND role <> 'Leader')
  );
