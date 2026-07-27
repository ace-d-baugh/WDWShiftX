-- Welcome Tour: first-time guided walkthrough (Wall, claim flow, messaging,
-- live updates). tour_completed_at is set once the user finishes or skips
-- it; null means "show it automatically on next dashboard load."
--
-- Mirrors onboarding_dismissed_at (20260718100000_onboarding_and_weekly_digest.sql):
-- new public.users columns need an explicit SELECT grant, see
-- 20260718140000_grant_select_onboarding_columns.sql's note.

ALTER TABLE public.users
  ADD COLUMN tour_completed_at timestamptz;

GRANT SELECT (tour_completed_at) ON public.users TO anon, authenticated;
