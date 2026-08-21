-- Profile pictures, part 2: get_conversations() and get_messageable_users()
-- are SECURITY DEFINER RPCs (not plain table selects), so extending their
-- output needs the function's return shape changed, not a table GRANT.
-- CREATE OR REPLACE cannot change a RETURNS TABLE column list — DROP first,
-- same as the get_users_admin() precedent in 20260816230000 — which also
-- means EXECUTE grants have to be reissued (DROP+CREATE resets a function to
-- its default of EXECUTE TO PUBLIC, unlike CREATE OR REPLACE which preserves
-- existing grants).

DROP FUNCTION IF EXISTS public.get_conversations();

CREATE FUNCTION public.get_conversations()
RETURNS TABLE (
  conversation_id        uuid,
  other_user_id          uuid,
  other_display_name     text,
  other_avatar_url       text,
  last_message_body      text,
  last_message_at        timestamptz,
  last_message_sender_id uuid,
  unread_count           bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    op.user_id,
    ou.display_name,
    ou.avatar_url,
    lm.body,
    lm.created_at,
    lm.sender_id,
    (SELECT count(*)
     FROM messages m
     WHERE m.conversation_id = c.id
       AND m.sender_id IS DISTINCT FROM auth.uid()
       AND m.created_at > COALESCE(my.last_read_at, 'epoch'::timestamptz)
       AND m.created_at > COALESCE(my.hidden_at, 'epoch'::timestamptz))
  FROM conversations c
  JOIN conversation_participants my ON my.conversation_id = c.id AND my.user_id = auth.uid()
  JOIN conversation_participants op ON op.conversation_id = c.id AND op.user_id <> auth.uid()
  LEFT JOIN users ou ON ou.id = op.user_id
  LEFT JOIN LATERAL (
    SELECT body, created_at, sender_id
    FROM messages m
    WHERE m.conversation_id = c.id
      AND m.created_at > COALESCE(my.hidden_at, 'epoch'::timestamptz)
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true
  WHERE my.hidden_at IS NULL OR lm.created_at IS NOT NULL
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC
$$;

DROP FUNCTION IF EXISTS public.get_messageable_users();

CREATE FUNCTION public.get_messageable_users()
RETURNS TABLE (user_id uuid, display_name text, avatar_url text, board_ids uuid[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.display_name, u.avatar_url, array_agg(DISTINCT mine.board_id)
  FROM user_boards mine
  JOIN user_boards theirs ON theirs.board_id = mine.board_id
    AND theirs.is_approved = true AND theirs.is_hidden = false
  JOIN users u ON u.id = theirs.user_id AND u.is_active = true
  WHERE mine.user_id = auth.uid()
    AND mine.is_approved = true
    AND mine.is_hidden = false
    AND theirs.user_id <> auth.uid()
  GROUP BY u.id, u.display_name, u.avatar_url
  ORDER BY u.display_name
$$;

REVOKE ALL ON FUNCTION public.get_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conversations() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_messageable_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_messageable_users() TO authenticated, service_role;
