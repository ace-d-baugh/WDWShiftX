-- Switch the derived site display name from "First L." to the full "First Last".
-- Mirrors the frontend change to displayNameRegex (lib/validations/auth.ts) and
-- formatOAuthDisplayName (app/auth/callback/route.ts). Both branches now keep the
-- full family name instead of collapsing it to an initial.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_display_name text;
  v_given_name   text;
  v_family_name  text;
  v_full_name    text;
BEGIN
  v_given_name  := trim(NEW.raw_user_meta_data->>'given_name');
  v_family_name := trim(NEW.raw_user_meta_data->>'family_name');

  IF v_given_name IS NOT NULL AND v_given_name <> ''
     AND v_family_name IS NOT NULL AND v_family_name <> '' THEN
    -- Preferred: Google gave us separate first/last fields
    v_display_name := initcap(v_given_name) || ' ' || initcap(v_family_name);
  ELSE
    -- Fallback: full_name or name (already "First Last"), just normalise case
    v_full_name := trim(COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), '')
    ));

    -- Require at least a first + last (a space) before deriving a name
    IF v_full_name IS NOT NULL AND position(' ' IN v_full_name) > 0 THEN
      v_display_name := initcap(v_full_name);
    END IF;
  END IF;

  INSERT INTO public.users (id, email, display_name, email_verified, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    v_display_name,
    COALESCE((NEW.raw_user_meta_data->>'email_verified')::boolean, false),
    'Guest',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;
