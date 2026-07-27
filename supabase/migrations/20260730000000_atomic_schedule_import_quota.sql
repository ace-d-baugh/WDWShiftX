-- S2: make the schedule-import quota atomic.
--
-- The API route used to call get_schedule_import_status() to check remaining
-- imports, then spend 5-60s calling the vision model, then call
-- consume_schedule_import() to spend the credit. Two separate statements with
-- the most expensive operation in the world sitting between them: fifty
-- simultaneous uploads all read "used = 0" before any of them incremented, so
-- all fifty passed the check and all fifty billed a paid model call.
--
-- reserve_schedule_import() collapses check-and-spend into one statement under
-- a row lock, so concurrent callers serialise and only the first N within the
-- limit succeed. The credit is taken up front and handed back by
-- release_schedule_import() if the read fails or finds no shifts, which
-- preserves the previous behaviour that a failed import never costs the user.
--
-- Both must PERFORM set_config('myshiftx.allow_import_update', ...) exactly as
-- the original functions do: protect_schedule_import_fields() blocks any write
-- to schedule_import_count without it. (That setting name is inherited from
-- before the fork and is identical in both apps, despite the wdwshiftx rename
-- elsewhere -- do not "correct" it or the guard silently rejects the write.)

CREATE OR REPLACE FUNCTION public.reserve_schedule_import()
RETURNS TABLE (reserved boolean, used integer, import_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month        text := to_char(now() AT TIME ZONE 'America/New_York', 'YYYY-MM');
  v_membership   text;
  v_used         integer;
  v_stored_month text;
  v_limit        integer;
BEGIN
  -- FOR UPDATE is the whole point: a second concurrent caller blocks here
  -- until the first has committed its increment, so it sees the new count
  -- instead of the stale one.
  SELECT u.membership, u.schedule_import_count, u.schedule_import_month
    INTO v_membership, v_used, v_stored_month
  FROM public.users u
  WHERE u.id = auth.uid()
  FOR UPDATE;

  IF v_membership IS NULL THEN
    reserved := false; used := 0; import_limit := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Rolled over into a new month: the stored count belongs to the old one.
  IF v_stored_month IS DISTINCT FROM v_month THEN
    v_used := 0;
  END IF;

  v_limit := CASE WHEN v_membership IN ('Pro', 'Trial') THEN -1 ELSE 4 END;

  IF v_limit >= 0 AND v_used >= v_limit THEN
    reserved := false; used := v_used; import_limit := v_limit;
    RETURN NEXT;
    RETURN;
  END IF;

  PERFORM set_config('myshiftx.allow_import_update', '1', true);
  UPDATE public.users
     SET schedule_import_count = v_used + 1,
         schedule_import_month = v_month
   WHERE id = auth.uid();

  reserved := true; used := v_used + 1; import_limit := v_limit;
  RETURN NEXT;
END;
$function$;

-- Hand the credit back. Scoped to the current month so a release arriving
-- after a month rollover can't decrement the fresh month's count, and floored
-- at zero so a double release can never produce a negative balance.
CREATE OR REPLACE FUNCTION public.release_schedule_import()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month text := to_char(now() AT TIME ZONE 'America/New_York', 'YYYY-MM');
BEGIN
  PERFORM set_config('myshiftx.allow_import_update', '1', true);
  UPDATE public.users
     SET schedule_import_count = GREATEST(schedule_import_count - 1, 0)
   WHERE id = auth.uid()
     AND schedule_import_month = v_month;
END;
$function$;

-- Revoke from PUBLIC, not just anon/authenticated: EXECUTE is granted to
-- PUBLIC by default, so revoking only the named roles leaves it callable.
-- (This is the S5 mistake -- getting it right here.)
REVOKE ALL ON FUNCTION public.reserve_schedule_import() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_schedule_import() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_schedule_import() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_schedule_import() TO authenticated, service_role;
