-- The Overlord panel's Stats tab lumped "Trade" and "Giveaway" counts from
-- is_trade/is_giveaway, but a shift offer can have BOTH checked at once (the
-- "Give/Trade" badge in ShiftCard.tsx) — those double-counted into both
-- buckets. Split into three mutually exclusive counts matching the site's
-- existing Trade / Giveaway / Give-Trade categorization.
--
-- The return row shape is changing (2 columns -> 3), which Postgres won't
-- allow via CREATE OR REPLACE on a RETURNS TABLE function — drop it first.
DROP FUNCTION IF EXISTS public.get_post_stats_admin();

CREATE FUNCTION public.get_post_stats_admin()
RETURNS TABLE (
  shifts_total integer,
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
    (SELECT COUNT(*) FROM public.shifts WHERE is_active = true)::int,
    (SELECT COUNT(*) FROM public.shifts WHERE removed_reason = 'user_removed')::int,
    (SELECT COUNT(*) FROM public.shifts WHERE removed_reason = 'expired')::int,
    (SELECT COUNT(*) FROM public.shifts WHERE removed_reason = 'covered')::int,
    (SELECT COUNT(*) FROM public.shifts WHERE removed_reason = 'leader_removed')::int,
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
