-- Security hardening surfaced by the Supabase advisor:
-- 1. Pin search_path on SECURITY DEFINER / trigger functions that were missing it
--    (prevents search_path hijacking; behavior-preserving, logic unchanged).
-- 2. Trigger-only functions don't need to be directly callable via PostgREST RPC —
--    revoke EXECUTE from anon/authenticated so they can only fire as triggers.

-- user_boards.is_hidden predates migration history (added by hand on the
-- original project, like the other gaps found in this fork). auto_add_admins_to_board()
-- below needs it, as does directory_boards_filter (20260702150000).
ALTER TABLE public.user_boards ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.protect_membership_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'authenticated' THEN
    NEW.membership    := OLD.membership;
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.trial_used    := OLD.trial_used;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_add_admins_to_board()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO user_boards (user_id, board_id, role, is_approved, is_hidden)
  SELECT id, NEW.id, 'Leader', true, true
  FROM users
  WHERE role = 'Admin'
  ON CONFLICT (user_id, board_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_shift_expires_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.expires_at = NEW.start_time - INTERVAL '30 minutes';
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_request_expires_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.expires_at = (NEW.requested_date + INTERVAL '1 day' - INTERVAL '1 second')::TIMESTAMPTZ;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cascade_deactivate_comments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    UPDATE comments
    SET is_active = FALSE
    WHERE post_type = CASE TG_TABLE_NAME WHEN 'shifts' THEN 'shift' WHEN 'requests' THEN 'request' END
      AND post_id = NEW.id
      AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.protect_membership_fields() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_add_admins_to_board() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_email_verified() FROM anon, authenticated;
