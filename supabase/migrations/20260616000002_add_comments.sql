-- ============================================================
-- Comments on shift/request posts
-- Polymorphic post_type + post_id, mirroring the existing flags
-- table pattern (target_type + target_id) since a comment can
-- belong to either a shift or a request.
-- ============================================================

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_type TEXT CHECK (post_type IN ('shift', 'request')) NOT NULL,
  post_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) <= 500),
  is_interested BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_type, post_id, is_active, created_at);

-- Reuses the existing update_updated_at_column() trigger function (users/black_listed)
-- Guarded: initial_schema.sql already creates this trigger on a fresh install.
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Cascade: deactivating a shift/request deactivates its comments.
-- One function shared by both triggers; TG_TABLE_NAME tells it
-- which post_type to cascade into.
-- ============================================================
CREATE OR REPLACE FUNCTION cascade_deactivate_comments()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER cascade_deactivate_shift_comments
  AFTER UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION cascade_deactivate_comments();

CREATE TRIGGER cascade_deactivate_request_comments
  AFTER UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION cascade_deactivate_comments();

-- ============================================================
-- Helper: is the target post currently active? Used by the INSERT
-- policy so a single policy can check across shifts/requests.
-- SECURITY DEFINER so it can read shifts/requests regardless of the
-- caller's own RLS visibility into those tables.
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_is_active(p_post_type TEXT, p_post_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_post_type
    WHEN 'shift' THEN EXISTS (SELECT 1 FROM shifts WHERE id = p_post_id AND is_active = true)
    WHEN 'request' THEN EXISTS (SELECT 1 FROM requests WHERE id = p_post_id AND is_active = true)
    ELSE false
  END
$$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active comments (board visibility
-- for the underlying post is enforced at the app layer, same as shifts/requests)
CREATE POLICY "comments_select_active"
  ON public.comments FOR SELECT
  USING (is_active = true AND auth.role() = 'authenticated');

-- Leaders/admins can see deactivated comments too (moderation/audit)
CREATE POLICY "comments_select_leaders"
  ON public.comments FOR SELECT
  USING (get_user_role() IN ('leader', 'admin'));

-- Authenticated users comment as themselves, only on a currently active post
CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
    AND public.post_is_active(post_type, post_id)
  );

-- Owner can edit their own comment body or soft-delete it (is_active = false)
CREATE POLICY "comments_update_own"
  ON public.comments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Mods/leaders/admins can deactivate any comment (moderation, mirrors shifts/requests)
CREATE POLICY "comments_update_moderator"
  ON public.comments FOR UPDATE
  USING (get_user_role() IN ('mod', 'leader', 'admin'));

-- ============================================================
-- Extend flags to cover comments
-- ============================================================
ALTER TABLE flags DROP CONSTRAINT IF EXISTS flags_target_type_check;
ALTER TABLE flags ADD CONSTRAINT flags_target_type_check
  CHECK (target_type IN ('post', 'user', 'comment'));
