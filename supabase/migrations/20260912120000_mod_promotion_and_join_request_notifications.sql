-- Three new notification types:
--   'mod_promoted'    — a User is promoted to Mod on a board (congrats + email-pref note)
--   'leader_promoted' — a Mod is promoted to Leader/Admin on a board (plain congrats)
--   'join_request'    — fans out to a board's Mods/Leaders when a new member requests to join
--
-- Existing CHECK constraint has no explicit name, so Postgres auto-named it
-- <table>_<column>_check when the table was created in 20260826120000_notifications.sql.
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'shift_match', 'interest', 'comment',
  'claim_created', 'claim_resolved', 'claim_finalized',
  'board_approved', 'board_announcement',
  'mod_promoted', 'leader_promoted', 'join_request'
));
