-- One-time backfill: expand existing "First L." display names to full "First Last".
-- Run MANUALLY against the WDWShiftX project (ref knzbsitknjozjhramlju) in the
-- Supabase dashboard SQL Editor. NOT a schema migration — do not `db push` this.
-- Pairs with migration 20260809120000_handle_new_user_full_name.sql; apply that
-- trigger migration first so new signups and this backfill stay consistent.
--
-- Rows whose auth.users metadata has neither given/family nor a spaced full_name
-- yield NULL and are left untouched (the user must set their name in-profile).

-- ── Step 1: DRY RUN (read-only preview) ─────────────────────────────────────
SELECT
  u.display_name AS current_name,
  CASE
    WHEN NULLIF(trim(au.raw_user_meta_data->>'given_name'),'') IS NOT NULL
     AND NULLIF(trim(au.raw_user_meta_data->>'family_name'),'') IS NOT NULL
      THEN initcap(trim(au.raw_user_meta_data->>'given_name')) || ' ' ||
           initcap(trim(au.raw_user_meta_data->>'family_name'))
    WHEN position(' ' IN trim(COALESCE(
           NULLIF(trim(au.raw_user_meta_data->>'full_name'),''),
           NULLIF(trim(au.raw_user_meta_data->>'name'),'')))) > 0
      THEN initcap(trim(COALESCE(
           NULLIF(trim(au.raw_user_meta_data->>'full_name'),''),
           NULLIF(trim(au.raw_user_meta_data->>'name'),''))))
    ELSE NULL
  END AS derived_full_name
FROM public.users u
JOIN auth.users au ON au.id = u.id
WHERE u.display_name ~ '^[A-Z][a-zA-Z]*( [A-Z][a-zA-Z]*)* [A-Z]\.$';

-- ── Step 2: APPLY (uncomment / run after reviewing Step 1) ───────────────────
WITH derived AS (
  SELECT
    u.id,
    CASE
      WHEN NULLIF(trim(au.raw_user_meta_data->>'given_name'),'') IS NOT NULL
       AND NULLIF(trim(au.raw_user_meta_data->>'family_name'),'') IS NOT NULL
        THEN initcap(trim(au.raw_user_meta_data->>'given_name')) || ' ' ||
             initcap(trim(au.raw_user_meta_data->>'family_name'))
      WHEN position(' ' IN trim(COALESCE(
             NULLIF(trim(au.raw_user_meta_data->>'full_name'),''),
             NULLIF(trim(au.raw_user_meta_data->>'name'),'')))) > 0
        THEN initcap(trim(COALESCE(
             NULLIF(trim(au.raw_user_meta_data->>'full_name'),''),
             NULLIF(trim(au.raw_user_meta_data->>'name'),''))))
      ELSE NULL
    END AS new_name
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.display_name ~ '^[A-Z][a-zA-Z]*( [A-Z][a-zA-Z]*)* [A-Z]\.$'
)
UPDATE public.users u
SET display_name = d.new_name
FROM derived d
WHERE u.id = d.id
  AND d.new_name IS NOT NULL
  AND d.new_name <> u.display_name
RETURNING u.id, u.display_name AS new_name;
