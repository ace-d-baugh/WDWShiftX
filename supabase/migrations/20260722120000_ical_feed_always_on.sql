-- WDW ShiftX: calendar sync is always-on for every account (no Pro/Trial
-- tier in this fork), so the iCal feed token functions no longer need to
-- gate on membership. Same functions, same signatures, just drop the check.

CREATE OR REPLACE FUNCTION public.get_or_create_ical_token()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  SELECT u.ical_token INTO v_token
  FROM public.users u
  WHERE u.id = auth.uid();

  IF v_token IS NULL THEN
    v_token := gen_random_uuid();
    UPDATE public.users SET ical_token = v_token WHERE id = auth.uid();
  END IF;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_ical_token()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  v_token := gen_random_uuid();
  UPDATE public.users SET ical_token = v_token WHERE id = auth.uid();
  RETURN v_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_ical_token() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_ical_token() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_ical_token() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_ical_token() TO authenticated;
