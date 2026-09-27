-- 20260924010000 (disposable-domain block) was written against the pre-
-- 20260809 handle_new_user(), missing the two migrations after it
-- (20260809120000 full-name switch, 20260816230000 first_name/last_name
-- columns) — it silently reverted both: new signups got "First L." display
-- names again and NULL first_name/last_name. Re-applies the 20260816230000
-- body with the domain block merged back in.
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
  v_first_name   text;
  v_last_name    text;
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
    v_display_name := initcap(v_given_name) || ' ' || initcap(v_family_name);
    v_first_name := initcap(v_given_name);
    v_last_name  := initcap(v_family_name);
  ELSE
    -- Fallback: full_name or name (already "First Last"), just normalise case
    v_full_name := trim(COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), '')
    ));

    -- Require at least a first + last (a space) before deriving a name
    IF v_full_name IS NOT NULL AND position(' ' IN v_full_name) > 0 THEN
      v_display_name := initcap(v_full_name);
      v_first_name := initcap(regexp_replace(v_full_name, '\s+\S+$', ''));
      v_last_name  := initcap((regexp_split_to_array(v_full_name, '\s+'))[array_length(regexp_split_to_array(v_full_name, '\s+'), 1)]);
    END IF;
  END IF;

  INSERT INTO public.users (id, email, display_name, first_name, last_name, email_verified, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    v_display_name,
    v_first_name,
    v_last_name,
    COALESCE((NEW.raw_user_meta_data->>'email_verified')::boolean, false),
    'Guest',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Repair the rows created while the reverted trigger was live (between the
-- disposable-domain migration and this one): re-derive display_name/
-- first_name/last_name from the same raw_user_meta_data the trigger already
-- had, for anyone still missing first_name/last_name. Safe to re-run —
-- WHERE clause only touches rows the regression actually affected.
UPDATE public.users u
SET
  display_name = CASE
    WHEN NULLIF(trim(a.raw_user_meta_data->>'given_name'), '') IS NOT NULL
     AND NULLIF(trim(a.raw_user_meta_data->>'family_name'), '') IS NOT NULL
      THEN initcap(trim(a.raw_user_meta_data->>'given_name')) || ' ' || initcap(trim(a.raw_user_meta_data->>'family_name'))
    ELSE u.display_name
  END,
  first_name = COALESCE(u.first_name, initcap(trim(a.raw_user_meta_data->>'given_name'))),
  last_name  = COALESCE(u.last_name, initcap(trim(a.raw_user_meta_data->>'family_name')))
FROM auth.users a
WHERE a.id = u.id
  AND u.first_name IS NULL
  AND u.last_name IS NULL
  AND NULLIF(trim(a.raw_user_meta_data->>'given_name'), '') IS NOT NULL
  AND NULLIF(trim(a.raw_user_meta_data->>'family_name'), '') IS NOT NULL;
