-- Disney's mail servers are silently dropping our verification emails (Resend
-- reports delivered, nothing arrives, not even in spam) — block @disney.com
-- signups at the DB trigger level too, so the client-side check in
-- lib/validations/auth.ts can't be bypassed by calling the Auth API directly.
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
  v_name_parts   text[];
  v_first_part   text;
  v_last_initial text;
BEGIN
  IF NEW.email ILIKE '%@disney.com' THEN
    RAISE EXCEPTION 'This email address cannot be used to register.';
  END IF;

  v_given_name  := trim(NEW.raw_user_meta_data->>'given_name');
  v_family_name := trim(NEW.raw_user_meta_data->>'family_name');

  IF v_given_name IS NOT NULL AND v_given_name <> ''
     AND v_family_name IS NOT NULL AND v_family_name <> '' THEN
    -- Preferred: Google gave us separate first/last fields
    v_display_name := initcap(v_given_name) || ' ' || upper(left(v_family_name, 1)) || '.';
  ELSE
    -- Fallback: split full_name or name on the last space
    v_full_name := trim(COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), '')
    ));

    IF v_full_name IS NOT NULL THEN
      v_name_parts   := string_to_array(v_full_name, ' ');
      IF array_length(v_name_parts, 1) >= 2 THEN
        v_first_part   := array_to_string(
          v_name_parts[1 : array_length(v_name_parts, 1) - 1], ' '
        );
        v_last_initial := upper(left(v_name_parts[array_length(v_name_parts, 1)], 1));
        v_display_name := initcap(v_first_part) || ' ' || v_last_initial || '.';
      END IF;
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
