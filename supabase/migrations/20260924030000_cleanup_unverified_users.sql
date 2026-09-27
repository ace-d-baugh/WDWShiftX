-- public.users.id has no FK to auth.users(id) (see handle_new_user() —
-- it's populated from NEW.id on insert, never declared as a reference), so
-- deleting an auth.users row does not cascade. Add that cascade now so
-- admin.deleteUser() cleans up both sides in one call.
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();

-- Returns the auth.users ids of Guests who never verified their email within
-- 14 days of registering. The /api/cron/cleanup-unverified route calls this
-- once a day, then deletes each id via supabase.auth.admin.deleteUser() (the
-- id list has to leave Postgres because deleting from auth.users needs the
-- Auth admin API, not a raw SQL DELETE, to also clean up sessions/identities).
CREATE OR REPLACE FUNCTION public.stale_unverified_user_ids()
RETURNS TABLE (id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT u.id
  FROM public.users u
  WHERE u.role = 'Guest'
    AND u.email_verified = false
    AND u.created_at < NOW() - INTERVAL '14 days';
$function$;

-- Keep the rate-limit log from growing forever — nothing reads rows older
-- than a day (check_signup_rate_limit only ever looks back 24h).
CREATE OR REPLACE FUNCTION public.prune_signup_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DELETE FROM public.signup_attempts WHERE created_at < NOW() - INTERVAL '2 days';
$function$;
