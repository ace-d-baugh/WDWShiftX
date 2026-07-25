-- The Overlord panel's "Shift Post Outcomes" chart was counting every row in
-- public.shifts, including personal-calendar-only entries (is_trade = false
-- AND is_giveaway = false) that were never posted to any board's Wall — see
-- 20260619000000_shifts_personal_calendar.sql, which is exactly the
-- trade/giveaway predicate the Wall itself queries on. Outcome counts
-- (active/self-deleted/timed-out/covered/leader-removed) now only include
-- shifts that were ever posted to the Wall, matching what the chart title
-- claims. shifts_total is renamed to shifts_added and stays unfiltered
-- (every shift ever added to a calendar, personal or not) so the client can
-- show an "added vs. posted to Wall" ratio instead of conflating the two.
--
-- Requests have no personal-only counterpart (every row in public.requests
-- is, by product design, posted to a board's Request wall — WallClient's
-- request query has no trade/giveaway-style gate), so the requests_* columns
-- are unchanged.
DROP FUNCTION IF EXISTS public.get_post_stats_admin();

CREATE FUNCTION public.get_post_stats_admin()
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
  requests_leader_removed integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.shifts)::int,
    (SELECT COUNT(*) FROM public.shifts WHERE is_active = true AND (is_trade = true OR is_giveaway = true))::int,
    (SELECT COUNT(*) FROM public.shifts WHERE removed_reason = 'user_removed' AND (is_trade = true OR is_giveaway = true))::int,
    (SELECT COUNT(*) FROM public.shifts WHERE removed_reason = 'expired' AND (is_trade = true OR is_giveaway = true))::int,
    (SELECT COUNT(*) FROM public.shifts WHERE removed_reason = 'covered' AND (is_trade = true OR is_giveaway = true))::int,
    (SELECT COUNT(*) FROM public.shifts WHERE removed_reason = 'leader_removed' AND (is_trade = true OR is_giveaway = true))::int,
    (SELECT COUNT(*) FROM public.shifts WHERE is_trade = true AND is_giveaway = false)::int,
    (SELECT COUNT(*) FROM public.shifts WHERE is_giveaway = true AND is_trade = false)::int,
    (SELECT COUNT(*) FROM public.shifts WHERE is_trade = true AND is_giveaway = true)::int,
    (SELECT COUNT(*) FROM public.requests)::int,
    (SELECT COUNT(*) FROM public.requests WHERE is_active = true)::int,
    (SELECT COUNT(*) FROM public.requests WHERE removed_reason = 'user_removed')::int,
    (SELECT COUNT(*) FROM public.requests WHERE removed_reason = 'expired')::int,
    (SELECT COUNT(*) FROM public.requests WHERE removed_reason = 'leader_removed')::int
  WHERE public.get_user_role() = 'admin'
$$;

REVOKE EXECUTE ON FUNCTION public.get_post_stats_admin() FROM anon;
