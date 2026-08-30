-- Public-facing user profile: birthday (independently-nullable month/day/year
-- so partial dates like "month+day only" are supported), a free-text bio, and
-- a repeatable list of contact methods (phone/email/socials). Visible to any
-- authenticated user (see /users/[id]), editable only by the owning user.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birthday_month smallint;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birthday_day smallint;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birthday_year smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_birthday_month_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_birthday_month_check
      CHECK (birthday_month IS NULL OR birthday_month BETWEEN 1 AND 12);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_birthday_day_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_birthday_day_check
      CHECK (birthday_day IS NULL OR birthday_day BETWEEN 1 AND 31);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_birthday_year_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_birthday_year_check
      CHECK (birthday_year IS NULL OR birthday_year BETWEEN 1900 AND EXTRACT(YEAR FROM now()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_bio_length_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_bio_length_check
      CHECK (bio IS NULL OR char_length(bio) <= 1000);
  END IF;
END $$;

-- boards and users both use an explicit column-level SELECT grant instead of
-- table-wide (see 20260730003000 and 20260701152710) — a new column has no
-- grant until it's added here, and selecting it fails the WHOLE query with
-- "permission denied for table X", not just that column. authenticated only
-- (not anon) — public profiles require sign-in.
GRANT SELECT (bio, birthday_month, birthday_day, birthday_year) ON public.users TO authenticated;

CREATE TABLE IF NOT EXISTS public.user_contact_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'phone', 'email', 'instagram', 'facebook', 'twitter', 'tiktok',
    'discord', 'snapchat', 'linkedin', 'other'
  )),
  value text NOT NULL CHECK (char_length(value) BETWEEN 1 AND 200),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_contact_methods_user_id_idx
  ON public.user_contact_methods(user_id);

ALTER TABLE public.user_contact_methods ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_contact_methods'
      AND policyname = 'user_contact_methods_select_authenticated'
  ) THEN
    CREATE POLICY user_contact_methods_select_authenticated ON public.user_contact_methods
      FOR SELECT
      USING ((select auth.role()) = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_contact_methods'
      AND policyname = 'user_contact_methods_owner_write'
  ) THEN
    CREATE POLICY user_contact_methods_owner_write ON public.user_contact_methods
      FOR ALL
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- New table, no pre-existing table-wide REVOKE to fight (unlike users).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_contact_methods TO authenticated;
