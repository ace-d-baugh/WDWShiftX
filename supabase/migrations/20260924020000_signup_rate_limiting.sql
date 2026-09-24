-- Per-IP signup throttling. Registration now goes through the
-- /api/auth/register route handler (server-side) instead of calling
-- supabase.auth.signUp() directly from the browser, so we have an IP to key
-- on before the request ever reaches Supabase Auth. Invisible to real users —
-- one signup an hour from the same IP never gets close to the limit.
CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id         BIGSERIAL   PRIMARY KEY,
  ip         INET        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_created_at
  ON public.signup_attempts (ip, created_at);

-- Service-role only: the route handler uses the admin client, and this table
-- has no legitimate client-side reader.
ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;

-- Records one attempt and reports whether this IP is still under the limit
-- (5 signups/hour, 15/day). Called once per registration POST, before
-- signUp() — a bot cycling through disposable addresses from one IP gets cut
-- off well before it can create a handful of accounts.
CREATE OR REPLACE FUNCTION public.check_signup_rate_limit(p_ip inet)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hour_count int;
  v_day_count  int;
BEGIN
  INSERT INTO public.signup_attempts (ip) VALUES (p_ip);

  SELECT count(*) INTO v_hour_count
  FROM public.signup_attempts
  WHERE ip = p_ip AND created_at > NOW() - INTERVAL '1 hour';

  SELECT count(*) INTO v_day_count
  FROM public.signup_attempts
  WHERE ip = p_ip AND created_at > NOW() - INTERVAL '1 day';

  RETURN v_hour_count <= 5 AND v_day_count <= 15;
END;
$function$;
