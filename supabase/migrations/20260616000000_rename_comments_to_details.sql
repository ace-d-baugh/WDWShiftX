-- ============================================================
-- Rename "comments" to "details" on shifts and requests
-- ============================================================

-- Guarded: on a fresh install, initial_schema.sql already names the column
-- "details" (it was rewritten after the fact to reflect the post-rename
-- state), so the source column doesn't exist to rename.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shifts' AND column_name = 'comments'
  ) THEN
    ALTER TABLE shifts RENAME COLUMN comments TO details;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'comments'
  ) THEN
    ALTER TABLE requests RENAME COLUMN comments TO details;
  END IF;
END $$;
