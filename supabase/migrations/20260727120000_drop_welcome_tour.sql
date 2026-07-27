-- Welcome Tour (20260725120000_welcome_tour.sql) is being retired — a
-- better-designed onboarding is coming later, and it'll want its own state
-- rather than reusing this column. Dropping the column also drops its
-- column-scoped SELECT grant automatically; no separate REVOKE needed.

ALTER TABLE public.users
  DROP COLUMN tour_completed_at;
