-- Extend the disney.com signup block (20260724120000) to also reject
-- disposable/temp-mail domains at the DB trigger level, mirroring
-- lib/validations/auth.ts's BLOCKED_EMAIL_DOMAINS so a direct Auth API call
-- can't bypass the client-side check. Keep both lists in sync.
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
  v_domain       text;
  v_blocked_domains text[] := ARRAY[
    'disney.com',
    '0-mail.com', '0815.ru', '0clickemail.com', '10minutemail.com', '10minutemail.net',
    '1secmail.com', '1secmail.net', '1secmail.org', '20minutemail.com', '33mail.com',
    'anonbox.net', 'boximail.com', 'burnermail.io', 'byom.de', 'crazymailing.com',
    'deadaddress.com', 'dispostable.com', 'dropmail.me', 'emailondeck.com',
    'emailsensei.com', 'fakeinbox.com', 'fakemailgenerator.com', 'getairmail.com',
    'getnada.com', 'grr.la', 'guerrillamail.com', 'guerrillamail.net',
    'guerrillamail.org', 'guerrillamailblock.com', 'harakirimail.com',
    'inboxbear.com', 'inboxkitten.com', 'jetable.org', 'kasmail.com',
    'luxusmail.org', 'mail-temporaire.fr', 'mailcatch.com', 'maildrop.cc',
    'mailinator.com', 'mailinator.net', 'mailinator2.com', 'mailnesia.com',
    'mailpoof.com', 'mailsac.com', 'mintemail.com', 'mytemp.email',
    'mohmal.com', 'moakt.com', 'nada.email', 'noclickemail.com',
    'no-spam.ws', 'notsharingmy.info', 'obobbo.com', 'onewaymail.com',
    'owlymail.com', 'pokemail.net', 'putthisinyourspamdatabase.com',
    'quickemailverification.com', 'sharklasers.com', 'shieldedmail.com',
    'spam4.me', 'spamavert.com', 'spambog.com', 'spambox.us', 'spamgourmet.com',
    'spamherelots.com', 'spamthisplease.com', 'spamex.com', 'spamfree24.org',
    'superrito.com', 'tempail.com', 'tempinbox.com', 'tempmail.com',
    'tempmail.de', 'tempmailo.com', 'tempmail2.com', 'temp-mail.org',
    'temp-mail.io', 'tempr.email', 'throwawaymail.com', 'trashmail.com',
    'trashmail.net', 'trbvm.com', 'tyldd.com', 'wegwerfemail.de',
    'wegwerfmail.de', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
    'zetmail.com'
  ];
BEGIN
  v_domain := lower(split_part(NEW.email, '@', 2));
  IF v_domain = ANY(v_blocked_domains) THEN
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
