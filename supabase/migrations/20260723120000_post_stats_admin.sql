-- Admin-only aggregate counts for the Overlord panel's stats charts: how many
-- posts were added, self-deleted, timed out, or successfully traded/given
-- away (removed_reason tracking already exists from the post-removal-tracking
-- and trade-loop migrations — this just rolls it up into one cheap call
-- instead of several round trips from the client).
--
-- Same "WHERE get_user_role() = 'admin'" gate as get_users_admin(): returns
-- zero rows for non-admins rather than raising, so the client can treat an
-- empty result as "not authorized" without a try/catch.
CREATE OR REPLACE FUNCTION public.get_post_stats_admin()
RETURNS TABLE (
  shifts_total integer,
  shifts_active integer,
  shifts_user_removed integer,
  shifts_expired integer,
  shifts_covered integer,
  shifts_leader_removed integer,
  shifts_trade integer,
  shifts_giveaway integer,
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
    (SELECT COUNT(*) FROM public.shifts WHERE is_trade = true)::int,
    (SELECT COUNT(*) FROM public.shifts WHERE is_giveaway = true)::int,
    (SELECT COUNT(*) FROM public.requests)::int,
    (SELECT COUNT(*) FROM public.requests WHERE is_active = true)::int,
    (SELECT COUNT(*) FROM public.requests WHERE removed_reason = 'user_removed')::int,
    (SELECT COUNT(*) FROM public.requests WHERE removed_reason = 'expired')::int,
    (SELECT COUNT(*) FROM public.requests WHERE removed_reason = 'leader_removed')::int
  WHERE public.get_user_role() = 'admin'
$$;

REVOKE EXECUTE ON FUNCTION public.get_post_stats_admin() FROM anon;
