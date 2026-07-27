-- Overlord panel: a new Leaderboard tab, and a Stats tab redesign that adds
-- per-board filtering plus two metrics that didn't exist anywhere before —
-- "was a match ever made" and "was a request ever actually filled."
--
-- ── 1. Match events ─────────────────────────────────────────────────────────
-- Matches were previously computed live just to fire an email/push, then
-- thrown away — nothing recorded that a match ever happened. This logs one
-- row per match found, written only by the service-role notification code
-- (never client-writable), read only through the admin stats RPC below.
-- Historical matches before this migration can't be recovered; the count
-- starts at zero and grows from here.

CREATE TABLE public.match_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id        uuid REFERENCES public.boards(id)  ON DELETE CASCADE,
  shift_id        uuid REFERENCES public.shifts(id)   ON DELETE SET NULL,
  request_id      uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  shift_poster_id uuid REFERENCES public.users(id)    ON DELETE SET NULL,
  requester_id    uuid REFERENCES public.users(id)    ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX match_events_board_idx ON public.match_events (board_id);

-- Defensive uniqueness: a given (shift, request) pair should only ever be
-- logged once, since only whichever side was posted second can find the
-- other already existing — this just guards against an accidental retry.
CREATE UNIQUE INDEX match_events_shift_request_key
  ON public.match_events (shift_id, request_id)
  WHERE shift_id IS NOT NULL AND request_id IS NOT NULL;

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
-- No policies at all: written only by the service-role notification code,
-- read only through get_post_stats_admin() below (SECURITY DEFINER).
REVOKE ALL ON public.match_events FROM anon, authenticated;

-- ── 2. Requests can now be marked "fulfilled" ───────────────────────────────
-- Previously a request had no "this actually got filled" outcome at all —
-- only expired / self-deleted / moderator-removed. Needed for the request
-- outcomes chart below to mean anything, and it's a real feature on its own:
-- the requester can now say "someone covered this for me."

ALTER TABLE public.requests DROP CONSTRAINT requests_removed_reason_check;
ALTER TABLE public.requests ADD CONSTRAINT requests_removed_reason_check
  CHECK (removed_reason IN ('expired', 'leader_removed', 'user_removed', 'fulfilled'));

CREATE OR REPLACE FUNCTION public.fulfill_own_request(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.requests
  SET    is_active = false,
         removed_reason = 'fulfilled',
         removed_by_user_id = auth.uid()
  WHERE  id = p_request_id
    AND  user_id = auth.uid();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.fulfill_own_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fulfill_own_request(uuid) TO authenticated, service_role;

-- ── 3. Stats RPC: board-filterable, plus fulfilled + matches ────────────────
-- Return shape is changing (adding columns), which CREATE OR REPLACE won't
-- allow on a RETURNS TABLE function — drop first (same as the two prior
-- reshapes of this function).

DROP FUNCTION IF EXISTS public.get_post_stats_admin();

CREATE FUNCTION public.get_post_stats_admin(p_board_id uuid DEFAULT NULL)
RETURNS TABLE (
  shifts_added integer,
  shifts_active integer,
  shifts_user_removed integer,
  shifts_expired integer,
  shifts_covered integer,
  shifts_leader_removed integer,
  shifts_trade_only integer,
  shifts_giveaway_only integer,
  shifts_both integer,
  requests_total integer,
  requests_active integer,
  requests_user_removed integer,
  requests_expired integer,
  requests_leader_removed integer,
  requests_fulfilled integer,
  matches_total integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.shifts
      WHERE (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.shifts
      WHERE is_active = true AND (is_trade = true OR is_giveaway = true)
        AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.shifts
      WHERE removed_reason = 'user_removed' AND (is_trade = true OR is_giveaway = true)
        AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.shifts
      WHERE removed_reason = 'expired' AND (is_trade = true OR is_giveaway = true)
        AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.shifts
      WHERE removed_reason = 'covered' AND (is_trade = true OR is_giveaway = true)
        AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.shifts
      WHERE removed_reason = 'leader_removed' AND (is_trade = true OR is_giveaway = true)
        AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.shifts
      WHERE is_trade = true AND is_giveaway = false
        AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.shifts
      WHERE is_giveaway = true AND is_trade = false
        AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.shifts
      WHERE is_trade = true AND is_giveaway = true
        AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.requests
      WHERE (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.requests
      WHERE is_active = true AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.requests
      WHERE removed_reason = 'user_removed' AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.requests
      WHERE removed_reason = 'expired' AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.requests
      WHERE removed_reason = 'leader_removed' AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.requests
      WHERE removed_reason = 'fulfilled' AND (p_board_id IS NULL OR board_id = p_board_id))::int,
    (SELECT COUNT(*) FROM public.match_events
      WHERE (p_board_id IS NULL OR board_id = p_board_id))::int
  WHERE public.get_user_role() = 'admin'
$$;

REVOKE ALL ON FUNCTION public.get_post_stats_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_post_stats_admin(uuid) TO authenticated, service_role;

-- ── 4. Leaderboard RPC ──────────────────────────────────────────────────────
-- Three categories, top 10 each, ranked in SQL rather than shipping every
-- user's row to the client and slicing there:
--   posts         — shifts a user has posted to the Wall (is_trade/is_giveaway)
--   reliable      — shifts a user claimed that were confirmed completed
--   disappointing — shifts a user claimed that were confirmed fell through
-- Both claim-based categories read the claimant's side only (did THEY follow
-- through on what they took), not the owner side.

CREATE OR REPLACE FUNCTION public.get_leaderboard_admin(p_board_id uuid DEFAULT NULL)
RETURNS TABLE (
  category text,
  user_id uuid,
  display_name text,
  cnt integer,
  rank integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH posts AS (
    SELECT user_id, COUNT(*)::int AS cnt
    FROM public.shifts
    WHERE (is_trade = true OR is_giveaway = true)
      AND user_id IS NOT NULL
      AND (p_board_id IS NULL OR board_id = p_board_id)
    GROUP BY user_id
  ),
  reliable AS (
    SELECT claimant_id AS user_id, COUNT(*)::int AS cnt
    FROM public.shift_claims
    WHERE status = 'completed'
      AND (p_board_id IS NULL OR board_id = p_board_id)
    GROUP BY claimant_id
  ),
  disappointing AS (
    SELECT claimant_id AS user_id, COUNT(*)::int AS cnt
    FROM public.shift_claims
    WHERE status = 'fell_through'
      AND (p_board_id IS NULL OR board_id = p_board_id)
    GROUP BY claimant_id
  ),
  combined AS (
    SELECT 'posts' AS category, user_id, cnt FROM posts
    UNION ALL
    SELECT 'reliable', user_id, cnt FROM reliable
    UNION ALL
    SELECT 'disappointing', user_id, cnt FROM disappointing
  ),
  ranked AS (
    SELECT
      c.category, c.user_id, u.display_name, c.cnt,
      ROW_NUMBER() OVER (PARTITION BY c.category ORDER BY c.cnt DESC, u.display_name)::int AS rank
    FROM combined c
    JOIN public.users u ON u.id = c.user_id
  )
  SELECT category, user_id, display_name, cnt, rank
  FROM ranked
  WHERE rank <= 10 AND public.get_user_role() = 'admin'
  ORDER BY category, rank
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_admin(uuid) TO authenticated, service_role;
