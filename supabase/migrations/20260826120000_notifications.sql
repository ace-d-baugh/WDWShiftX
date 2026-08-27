-- Notifications: a persistent, per-user record of every push/email event
-- (shift match, interest, comment, claim lifecycle, board-approved), plus
-- Mod/Admin-authored board-wide announcements ("board_announcement") that
-- fan out to every approved member of the targeted board(s).
--
-- board_announcement rows are content-once, recipient-many: one
-- `notifications` row can back several `notification_recipients` rows across
-- multiple boards, so a member of more than one targeted board sees one card
-- per board (notification_recipients.board_id), independently readable and
-- dismissable. All other types are 1:1 (one recipient row per notification).

-- ── 1. Tables ───────────────────────────────────────────────

CREATE TABLE public.notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           text NOT NULL CHECK (type IN (
                   'shift_match', 'interest', 'comment',
                   'claim_created', 'claim_resolved', 'claim_finalized',
                   'board_approved', 'board_announcement'
                 )),
  title          text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
  body           text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  link_url       text NOT NULL,
  actor_user_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Only meaningful for 'board_announcement': the "Pinned" section window.
  -- created_at + 14 days, reset to now() + 14 days on edit.
  pinned_until   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notification_recipients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Set only for 'board_announcement' — which board this particular
  -- fan-out copy belongs to. Null for every other type.
  board_id        uuid REFERENCES public.boards(id) ON DELETE CASCADE,
  read_at         timestamptz,
  dismissed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_recipients_user_unread_idx
  ON public.notification_recipients (user_id, read_at);

CREATE INDEX notification_recipients_notification_idx
  ON public.notification_recipients (notification_id);

CREATE INDEX notification_recipients_expiry_idx
  ON public.notification_recipients (read_at)
  WHERE read_at IS NOT NULL;

-- ── 2. Read-model / maintenance functions ──────────────────

-- Total unread, non-dismissed notifications — Navbar badge, mirrors
-- get_unread_message_count().
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)
  FROM notification_recipients
  WHERE user_id = auth.uid()
    AND read_at IS NULL
    AND dismissed_at IS NULL
$$;

-- Hard-expiry sweep: any notification (personal or board) is removed 14
-- days after it was read; unread ones never expire. Deletes the expired
-- recipient rows, then any notification left with zero recipients (the
-- personal 1:1 case, or a board announcement whose last reader just
-- expired). Called both by the pg_cron schedule below and opportunistically
-- from the Notifications page load, so correctness doesn't depend on cron
-- actually being enabled on this project.
CREATE OR REPLACE FUNCTION public.purge_expired_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notification_recipients
  WHERE read_at IS NOT NULL
    AND read_at < now() - interval '14 days';

  DELETE FROM notifications n
  WHERE NOT EXISTS (
    SELECT 1 FROM notification_recipients r WHERE r.notification_id = n.id
  );
END;
$$;

-- Best-effort scheduling — if pg_cron isn't enabled on this project yet,
-- this block logs a notice instead of failing the migration. Enable the
-- extension via the dashboard's Extensions tab and re-run just this DO
-- block (or the whole file; it's idempotent) to pick up the schedule.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule(
    'purge-expired-notifications',
    '0 3 * * *',
    'SELECT public.purge_expired_notifications()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped (%): enable the pg_cron extension via the dashboard, then re-run this block.', SQLERRM;
END;
$$;

-- ── 3. RLS ──────────────────────────────────────────────────

ALTER TABLE public.notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients   ENABLE ROW LEVEL SECURITY;

-- Readable only if you have a recipient row for it.
CREATE POLICY notifications_select_recipient
  ON public.notifications FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM notification_recipients r
    WHERE r.notification_id = notifications.id AND r.user_id = auth.uid()
  ));

-- Personal hard-delete: only non-announcement types, and only your own.
-- Board announcements are never deletable this way — that goes through
-- deleteBoardNotification (service-role, sender/Admin only).
CREATE POLICY notifications_delete_own_personal
  ON public.notifications FOR DELETE TO authenticated
  USING (
    type <> 'board_announcement'
    AND EXISTS (
      SELECT 1 FROM notification_recipients r
      WHERE r.notification_id = notifications.id AND r.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE policy for authenticated: all notification content is
-- written by server actions on the service-role client (app/actions/
-- notifications.ts, boardNotifications.ts), same posture as conversations.

CREATE POLICY notification_recipients_select_own
  ON public.notification_recipients FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notification_recipients_update_own
  ON public.notification_recipients FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Column-level grant: authenticated may only ever flip read_at/dismissed_at
-- on their own row, never repoint notification_id/board_id/user_id — that
-- would let a user re-point their recipient row at an arbitrary
-- notification and read content they were never sent (same rationale as
-- conversation_participants.last_read_at in 20260702120000_in_app_messaging.sql).
REVOKE UPDATE ON public.notification_recipients FROM anon, authenticated;
GRANT UPDATE (read_at, dismissed_at) ON public.notification_recipients TO authenticated;

-- No authenticated INSERT/DELETE policy: recipient rows are created by
-- server actions (service-role) and removed either by cascading a
-- notifications DELETE (personal) or by purge_expired_notifications().

-- ── 4. Realtime ─────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_recipients;
