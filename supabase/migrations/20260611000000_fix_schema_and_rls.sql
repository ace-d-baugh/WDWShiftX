-- ============================================================
-- Fix schema: normalise users table, wire auth trigger,
-- enable RLS and create all policies.
-- ============================================================

-- 0. Stub the pre-boards legacy tables this migration (and the ones through
--    20260616000004_boards_system.sql) assume already exist. On the original
--    MyShiftX project these were created by hand via the SQL editor, outside
--    migration history, before the codebase pivoted to the boards model.
--    boards_system.sql drops all of them once the pivot lands, so on a fresh
--    database this just lets that stretch of history replay faithfully.
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_approved BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_approved BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.user_proficiencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.black_listed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- 1a. Drop password_hash — Supabase Auth handles passwords
ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;

-- 1b. Add role TEXT column if missing (DB may have role_id UUID FK instead)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN role TEXT NOT NULL DEFAULT 'cast'
      CHECK (role IN ('cast', 'copro', 'leader', 'admin'));
  END IF;
END $$;

-- 1c. Drop role_id if it exists (was incorrectly pointing to job-roles table)
ALTER TABLE public.users DROP COLUMN IF EXISTS role_id;

-- 2. Auto-create public.users row when a new auth.users row is created.
--    SECURITY DEFINER so the trigger runs as postgres and bypasses RLS.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Cast Member'),
    'cast'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Helper: get the calling user's RBAC role without hitting RLS recursion.
--    SECURITY DEFINER bypasses RLS on the users table for this lookup.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- ============================================================
-- 4. Enable Row-Level Security on all tables
-- ============================================================
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_proficiencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.black_listed       ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. users policies
-- ============================================================
-- All authenticated users can read all profiles (display names shown throughout the app)
CREATE POLICY "users_select_authenticated"
  ON public.users FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users update their own profile
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Leaders can update cast / copro / leader rows (not admin rows)
CREATE POLICY "users_update_leader"
  ON public.users FOR UPDATE
  USING (
    get_user_role() = 'leader'
    AND role IN ('cast', 'copro', 'leader')
  )
  WITH CHECK (
    get_user_role() = 'leader'
    AND role IN ('cast', 'copro', 'leader')
  );

-- CoPros can update other copro rows (deactivation only — column restrictions handled in UI)
CREATE POLICY "users_update_copro"
  ON public.users FOR UPDATE
  USING (
    get_user_role() = 'copro'
    AND role = 'copro'
    AND id <> auth.uid()
  )
  WITH CHECK (
    get_user_role() = 'copro'
    AND role = 'copro'
  );

-- Admins can update any row
CREATE POLICY "users_update_admin"
  ON public.users FOR UPDATE
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- No INSERT or DELETE policies — profile rows are created by the trigger
-- and accounts are soft-deleted (is_active = false) via UPDATE.

-- ============================================================
-- 6. properties policies
-- ============================================================
CREATE POLICY "properties_select_authenticated"
  ON public.properties FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "properties_insert_admin"
  ON public.properties FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "properties_update_admin"
  ON public.properties FOR UPDATE
  USING (get_user_role() = 'admin');

CREATE POLICY "properties_delete_admin"
  ON public.properties FOR DELETE
  USING (get_user_role() = 'admin');

-- ============================================================
-- 7. locations policies
-- ============================================================
-- Approved locations visible to all authenticated users
CREATE POLICY "locations_select_approved"
  ON public.locations FOR SELECT
  USING (is_approved = true AND auth.role() = 'authenticated');

-- Leaders/admins see all locations including unapproved suggestions
CREATE POLICY "locations_select_leaders"
  ON public.locations FOR SELECT
  USING (get_user_role() IN ('leader', 'admin'));

-- Any authenticated user can suggest a new location
CREATE POLICY "locations_insert_authenticated"
  ON public.locations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Leaders/admins approve, reject, or edit locations
CREATE POLICY "locations_update_leaders"
  ON public.locations FOR UPDATE
  USING (get_user_role() IN ('leader', 'admin'));

CREATE POLICY "locations_delete_leaders"
  ON public.locations FOR DELETE
  USING (get_user_role() IN ('leader', 'admin'));

-- ============================================================
-- 8. roles policies (mirrors locations)
-- ============================================================
CREATE POLICY "roles_select_approved"
  ON public.roles FOR SELECT
  USING (is_approved = true AND auth.role() = 'authenticated');

CREATE POLICY "roles_select_leaders"
  ON public.roles FOR SELECT
  USING (get_user_role() IN ('leader', 'admin'));

CREATE POLICY "roles_insert_authenticated"
  ON public.roles FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "roles_update_leaders"
  ON public.roles FOR UPDATE
  USING (get_user_role() IN ('leader', 'admin'));

CREATE POLICY "roles_delete_leaders"
  ON public.roles FOR DELETE
  USING (get_user_role() IN ('leader', 'admin'));

-- ============================================================
-- 9. user_proficiencies policies
-- ============================================================
CREATE POLICY "proficiencies_select_own"
  ON public.user_proficiencies FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "proficiencies_select_leaders"
  ON public.user_proficiencies FOR SELECT
  USING (get_user_role() IN ('leader', 'admin'));

CREATE POLICY "proficiencies_insert_own"
  ON public.user_proficiencies FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "proficiencies_delete_own"
  ON public.user_proficiencies FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 10. shifts policies
-- ============================================================
-- All authenticated users see active shifts (board)
CREATE POLICY "shifts_select_active"
  ON public.shifts FOR SELECT
  USING (is_active = true AND auth.role() = 'authenticated');

-- Leaders/admins see all shifts including inactive (archive)
CREATE POLICY "shifts_select_leaders"
  ON public.shifts FOR SELECT
  USING (get_user_role() IN ('leader', 'admin'));

-- Authenticated users post their own shifts
CREATE POLICY "shifts_insert_own"
  ON public.shifts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

-- Own active shift: user can edit or soft-delete
CREATE POLICY "shifts_update_own"
  ON public.shifts FOR UPDATE
  USING (user_id = auth.uid());

-- CoPros/leaders/admins can update any shift (moderation)
CREATE POLICY "shifts_update_moderator"
  ON public.shifts FOR UPDATE
  USING (get_user_role() IN ('copro', 'leader', 'admin'));

-- ============================================================
-- 11. requests policies (mirrors shifts)
-- ============================================================
CREATE POLICY "requests_select_active"
  ON public.requests FOR SELECT
  USING (is_active = true AND auth.role() = 'authenticated');

CREATE POLICY "requests_select_leaders"
  ON public.requests FOR SELECT
  USING (get_user_role() IN ('leader', 'admin'));

CREATE POLICY "requests_insert_own"
  ON public.requests FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "requests_update_own"
  ON public.requests FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "requests_update_moderator"
  ON public.requests FOR UPDATE
  USING (get_user_role() IN ('copro', 'leader', 'admin'));

-- ============================================================
-- 12. flags policies
-- ============================================================
-- Any authenticated user can file a flag
CREATE POLICY "flags_insert_authenticated"
  ON public.flags FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only leaders/admins see and manage flags
CREATE POLICY "flags_select_leaders"
  ON public.flags FOR SELECT
  USING (get_user_role() IN ('leader', 'admin'));

CREATE POLICY "flags_update_leaders"
  ON public.flags FOR UPDATE
  USING (get_user_role() IN ('leader', 'admin'));

-- ============================================================
-- 13. black_listed policies
-- No policies = no access for regular users.
-- Server-side routes use the service role key which bypasses RLS.
-- ============================================================
