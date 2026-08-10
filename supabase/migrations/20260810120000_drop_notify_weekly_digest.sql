-- Remove the weekly digest feature entirely. The Sunday cron, its route, the
-- unsubscribe endpoint, the email template, and the profile toggle are all gone
-- from the app; this drops the now-unused per-user opt-in column.
ALTER TABLE public.users DROP COLUMN IF EXISTS notify_weekly_digest;
