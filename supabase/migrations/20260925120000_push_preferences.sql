-- Push notification preferences. Default is everything on ('all').
--   push_mode = 'all'  → every push is sent
--   push_mode = 'none' → no pushes at all
--   push_mode = 'some' → only the categories switched on below are sent;
--                        account/admin pushes (approvals, promotions, join
--                        requests, board announcements) are still sent
-- Gating happens server-side in lib/push-server.ts.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_mode text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS push_comments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_wall_posts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_shift_activity boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_push_mode_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_push_mode_check
      CHECK (push_mode IN ('all', 'some', 'none'));
  END IF;
END $$;

-- users uses an explicit column-level SELECT grant (see 20260701152710); a new
-- column has no grant until added here, and selecting it fails the whole query.
GRANT SELECT (push_mode, push_comments, push_messages, push_wall_posts, push_shift_activity)
  ON public.users TO authenticated;
