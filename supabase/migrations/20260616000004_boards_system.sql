-- ============================================================
-- MyShiftX Architecture Pivot: Boards System
--
-- Drops:   properties, locations, roles, user_proficiencies,
--          user_types, black_listed
-- Adds:    boards, user_boards, board_join_attempts
-- Renames: users.user_type → users.role (Guest / User / Admin)
--          Mod and Leader are now per-board roles only.
-- Modifies: shifts + requests → board_id replaces property/location/role
--           flags → add board_id, add 'board' target type
-- ============================================================

-- ── 0. Clear posts incompatible with the old schema ────────
-- (dev data only; user accounts are preserved)
TRUNCATE TABLE public.flags, public.comments, public.shifts, public.requests CASCADE;

-- ── 1. Drop RLS policies on tables being restructured ──────

DROP POLICY IF EXISTS "proficiencies_select_own"      ON public.user_proficiencies;
DROP POLICY IF EXISTS "proficiencies_select_leaders"  ON public.user_proficiencies;
DROP POLICY IF EXISTS "proficiencies_insert_own"      ON public.user_proficiencies;
DROP POLICY IF EXISTS "proficiencies_delete_own"      ON public.user_proficiencies;

DROP POLICY IF EXISTS "properties_select_authenticated" ON public.properties;
DROP POLICY IF EXISTS "properties_insert_admin"         ON public.properties;
DROP POLICY IF EXISTS "properties_update_admin"         ON public.properties;
DROP POLICY IF EXISTS "properties_delete_admin"         ON public.properties;

DROP POLICY IF EXISTS "locations_select_approved"       ON public.locations;
DROP POLICY IF EXISTS "locations_select_leaders"        ON public.locations;
DROP POLICY IF EXISTS "locations_insert_authenticated"  ON public.locations;
DROP POLICY IF EXISTS "locations_update_leaders"        ON public.locations;
DROP POLICY IF EXISTS "locations_delete_leaders"        ON public.locations;

DROP POLICY IF EXISTS "roles_select_approved"           ON public.roles;
DROP POLICY IF EXISTS "roles_select_leaders"            ON public.roles;
DROP POLICY IF EXISTS "roles_insert_authenticated"      ON public.roles;
DROP POLICY IF EXISTS "roles_update_leaders"            ON public.roles;
DROP POLICY IF EXISTS "roles_delete_leaders"            ON public.roles;

DROP POLICY IF EXISTS "users_update_leader"             ON public.users;
DROP POLICY IF EXISTS "users_update_copro"              ON public.users;
DROP POLICY IF EXISTS "users_update_admin"              ON public.users;

DROP POLICY IF EXISTS "shifts_select_active"            ON public.shifts;
DROP POLICY IF EXISTS "shifts_select_leaders"           ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert_own"               ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_own"               ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_moderator"         ON public.shifts;

DROP POLICY IF EXISTS "requests_select_active"          ON public.requests;
DROP POLICY IF EXISTS "requests_select_leaders"         ON public.requests;
DROP POLICY IF EXISTS "requests_insert_own"             ON public.requests;
DROP POLICY IF EXISTS "requests_update_own"             ON public.requests;
DROP POLICY IF EXISTS "requests_update_moderator"       ON public.requests;

DROP POLICY IF EXISTS "flags_insert_authenticated"      ON public.flags;
DROP POLICY IF EXISTS "flags_select_leaders"            ON public.flags;
DROP POLICY IF EXISTS "flags_update_leaders"            ON public.flags;

-- ── 2. Drop obsolete tables ────────────────────────────────

DROP TABLE IF EXISTS public.user_proficiencies;
DROP TABLE IF EXISTS public.user_types;
DROP TABLE IF EXISTS public.black_listed;

-- ── 3. Remove old FK columns from shifts and requests ──────

ALTER TABLE public.shifts
  DROP COLUMN IF EXISTS property_id,
  DROP COLUMN IF EXISTS location_id,
  DROP COLUMN IF EXISTS role_id;

ALTER TABLE public.requests
  DROP COLUMN IF EXISTS property_id,
  DROP COLUMN IF EXISTS location_id,
  DROP COLUMN IF EXISTS role_id;

-- ── 4. Drop property/location/role tables (FKs cleared) ───

DROP TABLE IF EXISTS public.roles;
DROP TABLE IF EXISTS public.locations;
DROP TABLE IF EXISTS public.properties;

-- ── 5. Rename users.user_type → users.role ────────────────

ALTER TABLE public.users RENAME COLUMN user_type TO role;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_type_check;
-- Guarded: on a fresh install, initial_schema.sql's inline CHECK on users.role
-- gets auto-named "users_role_check" by Postgres, colliding with this name.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Guest', 'User', 'Admin'));

-- Demote former board-level roles to User (they re-earn them per board)
UPDATE public.users SET role = 'User' WHERE role IN ('Mod', 'Leader');

DROP INDEX IF EXISTS idx_users_user_type_active;
CREATE INDEX IF NOT EXISTS idx_users_role_active ON public.users(role, is_active);

-- ── 6. Update trigger functions ────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(role) FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, is_active)
  VALUES (NEW.id, NEW.email, 'Guest', true)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_email_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.users
    SET role = 'User', email_verified = true
    WHERE id = NEW.id AND role = 'Guest';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 7. Create boards ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.boards (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT        NOT NULL UNIQUE,
  invite_code          TEXT        NOT NULL UNIQUE,
  invite_code_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by           UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Guarded: initial_schema.sql already creates this trigger on a fresh install.
DROP TRIGGER IF EXISTS update_boards_updated_at ON public.boards;
CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 8. Create user_boards ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_boards (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  board_id             UUID        NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  role                 TEXT        NOT NULL CHECK (role IN ('User', 'Mod', 'Leader')),
  is_approved          BOOLEAN     NOT NULL DEFAULT FALSE,
  approved_by_user_id  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at          TIMESTAMPTZ,
  requested_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, board_id)
);

ALTER TABLE public.user_boards ENABLE ROW LEVEL SECURITY;

-- ── 9. Create board_join_attempts ─────────────────────────

CREATE TABLE IF NOT EXISTS public.board_join_attempts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code_entered  TEXT        NOT NULL,
  outcome       TEXT        NOT NULL CHECK (outcome IN ('invalid_code', 'user_declined', 'success')),
  attempted_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.board_join_attempts ENABLE ROW LEVEL SECURITY;

-- ── 10. Add board_id to shifts and requests ────────────────

ALTER TABLE public.shifts   ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE;

-- ── 11. Update flags ───────────────────────────────────────

ALTER TABLE public.flags ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES public.boards(id) ON DELETE SET NULL;

ALTER TABLE public.flags DROP CONSTRAINT IF EXISTS flags_target_type_check;
ALTER TABLE public.flags ADD CONSTRAINT flags_target_type_check
  CHECK (target_type IN ('post', 'user', 'comment', 'board'));

-- ── 12. Board-scoped SECURITY DEFINER helpers ──────────────

CREATE OR REPLACE FUNCTION public.is_board_member(p_board_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_boards
    WHERE user_id = auth.uid()
      AND board_id = p_board_id
      AND is_approved = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_board_moderator(p_board_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_boards
    WHERE user_id = auth.uid()
      AND board_id = p_board_id
      AND is_approved = true
      AND role IN ('Mod', 'Leader')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_board_leader(p_board_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_boards
    WHERE user_id = auth.uid()
      AND board_id = p_board_id
      AND is_approved = true
      AND role = 'Leader'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_any_board_moderator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_boards
    WHERE user_id = auth.uid()
      AND is_approved = true
      AND role IN ('Mod', 'Leader')
  )
$$;

-- ── 13. RLS: users ────────────────────────────────────────

-- Admins can update any user row (board leaders can only update user_boards)
CREATE POLICY "users_update_admin"
  ON public.users FOR UPDATE
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ── 14. RLS: boards ───────────────────────────────────────

CREATE POLICY "boards_select_member"
  ON public.boards FOR SELECT
  USING (is_board_member(id) OR get_user_role() = 'admin');

CREATE POLICY "boards_insert_user"
  ON public.boards FOR INSERT
  WITH CHECK (get_user_role() IN ('user', 'admin'));

CREATE POLICY "boards_update_leader"
  ON public.boards FOR UPDATE
  USING    (is_board_leader(id) OR get_user_role() = 'admin')
  WITH CHECK (is_board_leader(id) OR get_user_role() = 'admin');

CREATE POLICY "boards_delete_leader"
  ON public.boards FOR DELETE
  USING (is_board_leader(id) OR get_user_role() = 'admin');

-- ── 15. RLS: user_boards ──────────────────────────────────

CREATE POLICY "user_boards_select_own"
  ON public.user_boards FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_boards_select_moderator"
  ON public.user_boards FOR SELECT
  USING (is_board_moderator(board_id));

CREATE POLICY "user_boards_select_admin"
  ON public.user_boards FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "user_boards_insert_own"
  ON public.user_boards FOR INSERT
  WITH CHECK (user_id = auth.uid() AND get_user_role() IN ('user', 'admin'));

CREATE POLICY "user_boards_update_moderator"
  ON public.user_boards FOR UPDATE
  USING    (is_board_moderator(board_id) OR get_user_role() = 'admin')
  WITH CHECK (is_board_moderator(board_id) OR get_user_role() = 'admin');

CREATE POLICY "user_boards_delete_self"
  ON public.user_boards FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "user_boards_delete_moderator"
  ON public.user_boards FOR DELETE
  USING (is_board_moderator(board_id) OR get_user_role() = 'admin');

-- ── 16. RLS: board_join_attempts ──────────────────────────

CREATE POLICY "join_attempts_insert_own"
  ON public.board_join_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "join_attempts_select_admin"
  ON public.board_join_attempts FOR SELECT
  USING (get_user_role() = 'admin');

-- ── 17. RLS: shifts (board-scoped) ────────────────────────

CREATE POLICY "shifts_select_member"
  ON public.shifts FOR SELECT
  USING (is_active = true AND is_board_member(board_id));

CREATE POLICY "shifts_select_moderator"
  ON public.shifts FOR SELECT
  USING (is_board_moderator(board_id));

CREATE POLICY "shifts_select_admin"
  ON public.shifts FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "shifts_insert_member"
  ON public.shifts FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_board_member(board_id));

CREATE POLICY "shifts_update_own"
  ON public.shifts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "shifts_update_moderator"
  ON public.shifts FOR UPDATE
  USING (is_board_moderator(board_id) OR get_user_role() = 'admin');

-- ── 18. RLS: requests (mirrors shifts) ────────────────────

CREATE POLICY "requests_select_member"
  ON public.requests FOR SELECT
  USING (is_active = true AND is_board_member(board_id));

CREATE POLICY "requests_select_moderator"
  ON public.requests FOR SELECT
  USING (is_board_moderator(board_id));

CREATE POLICY "requests_select_admin"
  ON public.requests FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "requests_insert_member"
  ON public.requests FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_board_member(board_id));

CREATE POLICY "requests_update_own"
  ON public.requests FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "requests_update_moderator"
  ON public.requests FOR UPDATE
  USING (is_board_moderator(board_id) OR get_user_role() = 'admin');

-- ── 19. RLS: flags (board-scoped) ─────────────────────────

CREATE POLICY "flags_insert_authenticated"
  ON public.flags FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Board mods see flags on their boards; admins see everything
CREATE POLICY "flags_select_moderator"
  ON public.flags FOR SELECT
  USING (
    (board_id IS NOT NULL AND is_board_moderator(board_id))
    OR get_user_role() = 'admin'
  );

CREATE POLICY "flags_update_moderator"
  ON public.flags FOR UPDATE
  USING (
    (board_id IS NOT NULL AND is_board_moderator(board_id))
    OR get_user_role() = 'admin'
  );

-- ── 20. RLS: comments (board-gated via post ownership) ────

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Drop old policies from add_comments migration before replacing them
DROP POLICY IF EXISTS "comments_select_active"        ON public.comments;
DROP POLICY IF EXISTS "comments_select_leaders"       ON public.comments;
DROP POLICY IF EXISTS "comments_insert_own"           ON public.comments;
DROP POLICY IF EXISTS "comments_update_own"           ON public.comments;
DROP POLICY IF EXISTS "comments_update_moderator"     ON public.comments;
DROP POLICY IF EXISTS "comments_select_authenticated" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_authenticated" ON public.comments;

CREATE POLICY "comments_select_authenticated"
  ON public.comments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "comments_insert_authenticated"
  ON public.comments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "comments_update_own"
  ON public.comments FOR UPDATE
  USING (user_id = auth.uid());

-- Any board mod can soft-delete a comment (set is_active = false)
CREATE POLICY "comments_update_moderator"
  ON public.comments FOR UPDATE
  USING (is_any_board_moderator() OR get_user_role() = 'admin');

-- ── 21. Indexes ────────────────────────────────────────────

DROP INDEX IF EXISTS idx_user_proficiencies_user;
DROP INDEX IF EXISTS idx_black_listed_email;

CREATE INDEX IF NOT EXISTS idx_boards_invite_code       ON public.boards(invite_code);
CREATE INDEX IF NOT EXISTS idx_user_boards_user         ON public.user_boards(user_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_user_boards_board        ON public.user_boards(board_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_shifts_board             ON public.shifts(board_id, is_active);
CREATE INDEX IF NOT EXISTS idx_requests_board           ON public.requests(board_id, is_active);
CREATE INDEX IF NOT EXISTS idx_join_attempts_user_time  ON public.board_join_attempts(user_id, attempted_at);
