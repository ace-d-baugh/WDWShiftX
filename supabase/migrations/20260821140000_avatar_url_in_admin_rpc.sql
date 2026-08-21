-- Profile pictures, part 3: get_users_admin() is the Overlord panel's Users
-- feed, also SECURITY DEFINER, so this is the same DROP+CREATE-with-grants
-- dance as the messaging RPCs in 20260821130000 — CREATE OR REPLACE can't
-- change a RETURNS TABLE column list, and DROP+CREATE resets EXECUTE to its
-- PUBLIC default, so the grants below have to be reissued.

DROP FUNCTION IF EXISTS public.get_users_admin();

CREATE FUNCTION public.get_users_admin()
RETURNS TABLE (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  avatar_url text,
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
  SELECT id, display_name, first_name, last_name, avatar_url, role, is_active, created_at, membership
  FROM public.users
  WHERE get_user_role() = 'admin'
  ORDER BY display_name;
$$;

REVOKE ALL ON FUNCTION public.get_users_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_users_admin() TO authenticated, service_role;
