-- Boards: a finer-grained status alongside the existing is_active flag.
-- is_active stays authoritative for "can members see/join this board" so
-- every existing query keeps working unchanged; status adds the
-- Active/Paused/Deleted distinction the Overlord panel's filter needs.
-- Delete becomes a soft delete (status='deleted') going forward — is_active
-- is set false for both paused and deleted, so member-facing visibility
-- (which only ever checks is_active) is unaffected either way.
ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'deleted'));

-- boards and users both use an explicit column-level SELECT grant instead of
-- table-wide (see 20260730003000 and 20260701152710) — a new column has no
-- grant until it's added here, and selecting it fails the WHOLE query with
-- "permission denied for table X", not just that column. Both migrations
-- warn about this exact trap; still missed it on the first pass of this file.
GRANT SELECT (status) ON public.boards TO anon, authenticated;
GRANT SELECT (first_name, last_name) ON public.users TO anon, authenticated;

UPDATE public.boards
  SET status = CASE WHEN is_active THEN 'active' ELSE 'paused' END;

-- Users: capture the real first/last name at registration, queryable
-- directly instead of only ever being visible as "First Last" inside
-- display_name. Existing rows are backfilled by splitting display_name on
-- its last whitespace token. Guarded so re-running this script won't
-- clobber manual corrections.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

UPDATE public.users
  SET
    first_name = CASE
      WHEN trim(display_name) ~ '\s' THEN regexp_replace(trim(display_name), '\s+\S+$', '')
      ELSE trim(display_name)
    END,
    last_name = CASE
      WHEN trim(display_name) ~ '\s' THEN
        (regexp_split_to_array(trim(display_name), '\s+'))[array_length(regexp_split_to_array(trim(display_name), '\s+'), 1)]
      ELSE NULL
    END
  WHERE display_name IS NOT NULL
    AND first_name IS NULL AND last_name IS NULL;

-- handle_new_user(): same given_name/family_name-first, full_name/name-fallback
-- branching as the 20260809 full-name migration left it, now also writing
-- first_name/last_name alongside the unchanged full "First Last" display_name.
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
BEGIN
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

-- get_users_admin(): add first_name/last_name to the Overlord panel's user
-- feed. DROP first: CREATE OR REPLACE cannot change a RETURNS TABLE
-- function's column list, only CREATE OR REPLACE preserves existing grants —
-- so this reissues them explicitly, same as the 20260728 migration that last
-- changed this function's shape.
DROP FUNCTION IF EXISTS public.get_users_admin();

CREATE FUNCTION public.get_users_admin()
RETURNS TABLE (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  role text,
  is_active boolean,
  created_at timestamptz,
  membership text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, display_name, first_name, last_name, role, is_active, created_at, membership
  FROM public.users
  WHERE get_user_role() = 'admin'
  ORDER BY display_name;
$$;

REVOKE ALL ON FUNCTION public.get_users_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_users_admin() TO authenticated, service_role;
