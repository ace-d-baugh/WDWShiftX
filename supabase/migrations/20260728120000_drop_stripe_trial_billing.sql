-- Stripe/Pro checkout was already fully removed from the app (Phase 3 of the
-- de-Stripe pass — no /upgrade page, no checkout API, no webhook). These five
-- columns exist only to support that removed flow and are dead weight now:
-- every real user is 'Basic' and nothing can ever change that again.
--
-- `membership` itself is NOT touched — it's still load-bearing for the Photo
-- Schedule Import quota (get_schedule_import_status/consume_schedule_import
-- read it directly to pick 4/month vs. unlimited).

-- ── 1. Drop the trigger before the columns it protects ──────────────────────
-- (a trigger's WHEN clause creates a real dependency on the columns it
-- references — drop it explicitly rather than relying on cascade.)

DROP TRIGGER IF EXISTS enforce_membership_protection ON public.users;
DROP FUNCTION IF EXISTS public.protect_membership_fields();

-- Recreated narrower: membership is the only field left that a regular user
-- must never be able to write directly.
CREATE OR REPLACE FUNCTION public.protect_membership_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'authenticated' THEN
    NEW.membership := OLD.membership;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER enforce_membership_protection
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  WHEN (NEW.membership IS DISTINCT FROM OLD.membership)
  EXECUTE FUNCTION public.protect_membership_fields();

-- Trigger-only: no role calls this directly (matches the blanket lockdown in
-- 20260719151000_function_execute_lockdown.sql, which this DROP+recreate
-- would otherwise reset to Postgres's PUBLIC-EXECUTE-by-default).
REVOKE ALL ON FUNCTION public.protect_membership_fields() FROM PUBLIC, anon, authenticated;

-- ── 2. Drop the dead per-user membership RPC ────────────────────────────────
-- get_own_membership()'s only caller was lib/auth/session.ts's getMembership(),
-- which itself had zero callers anywhere in the app — fully dead, not just
-- the trial/billing fields it exposed.

DROP FUNCTION IF EXISTS public.get_own_membership();

-- ── 3. Drop the columns ──────────────────────────────────────────────────────
-- Dropping a column auto-drops its indexes, CHECK constraints, and column-
-- scoped grants — no separate cleanup needed for those.

ALTER TABLE public.users
  DROP COLUMN stripe_customer_id,
  DROP COLUMN stripe_subscription_id,
  DROP COLUMN trial_ends_at,
  DROP COLUMN trial_used,
  DROP COLUMN billing_cycle;

-- ── 4. get_users_admin() loses the billing_cycle column it returned ────────
-- (membership stays — harmless either way, and matches what's still on the
-- table; the admin UI doesn't currently render either field).
--
-- DROP first: CREATE OR REPLACE cannot change a RETURNS TABLE function's
-- column list, only CREATE OR REPLACE preserves existing grants — so this
-- one needs its grants reissued explicitly afterward (same as the original
-- 20260701200638 migration did when it last changed this function's shape).

DROP FUNCTION IF EXISTS public.get_users_admin();

CREATE FUNCTION public.get_users_admin()
RETURNS TABLE (
  id uuid,
  display_name text,
  role text,
  is_active boolean,
  created_at timestamptz,
  membership text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, display_name, role, is_active, created_at, membership
  FROM public.users
  WHERE get_user_role() = 'admin'
  ORDER BY display_name;
$$;

REVOKE ALL ON FUNCTION public.get_users_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_users_admin() TO authenticated, service_role;
