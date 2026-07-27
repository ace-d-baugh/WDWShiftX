-- S4: a person's trade record is theirs alone (plus Overlord).
--
-- get_trade_stats_for_users() was SECURITY DEFINER, granted to authenticated,
-- and contained no reference to auth.uid() at all: it unnested whatever array
-- of user ids it was handed and returned each one's completed / fell-through
-- counts. Any logged-in user could pull the reliability record of anyone whose
-- id they had ever seen -- including people on boards they had since left.
--
-- In a workplace "backed out 3 times" functions as a disciplinary note, so
-- this is now restricted to the subject themselves, plus global Admins for the
-- Overlord panel. The Wall no longer requests other people's stats at all
-- (the claimant list and the poster badge that displayed them were removed),
-- so the only remaining caller asks for its own single id.
--
-- The batch is also capped: the previous signature would happily unnest a
-- 500k-element array and run three correlated counts per element.

CREATE OR REPLACE FUNCTION public.get_trade_stats_for_users(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, picked_up integer, covered integer, fell_through integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT u.uid AS user_id,
    (SELECT COUNT(*) FROM public.shift_claims c
      WHERE c.claimant_id = u.uid AND c.status = 'completed')::int AS picked_up,
    (SELECT COUNT(*) FROM public.shift_claims c
      WHERE c.owner_id = u.uid AND c.status = 'completed')::int AS covered,
    (SELECT COUNT(*) FROM public.shift_claims c
      WHERE c.claimant_id = u.uid AND c.status = 'fell_through')::int AS fell_through
  FROM unnest(p_user_ids[1:200]) AS u(uid)
  WHERE u.uid = (SELECT auth.uid())            -- your own record
     OR public.get_user_role() = 'admin';      -- or Overlord
$function$;

REVOKE ALL ON FUNCTION public.get_trade_stats_for_users(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trade_stats_for_users(uuid[]) TO authenticated, service_role;
