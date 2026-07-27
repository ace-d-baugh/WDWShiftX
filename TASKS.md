# MyShiftX — Task Board

## What's Done ✅

### Auth & Access
- ✅ Email/password registration with display name validation
- ✅ Email verification flow (Supabase + custom HTML template)
- ✅ Login page with session management
- ✅ Forgot password + reset password pages (full flow)
- ✅ Role-based access control (User → Mod → Leader → Admin)
- ✅ Account deactivation flow

### Boards
- ✅ Board creation (Leaders only)
- ✅ Invite-code join system with moderator approval queue
- ✅ Board management: rename, invite code toggle/regenerate, member role changes, ownership transfer, deletion
- ✅ Mobile-responsive board management UI with three-dot action menu
- ✅ "My Boards" section on profile with + button to create

### The Wall (Shift & Request Posts)
- ✅ Post shift offer form with validation (title, date/time, type, OT, details)
- ✅ Post shift request form with preferred time slots
- ✅ Edit shift and edit request (owner only)
- ✅ Remove / deactivate posts (owner only)
- ✅ Wall filtered by board, date, and post type tabs (Offers / Requests)
- ✅ ShiftCard and RequestCard with collapsible details, compact mobile layout
- ✅ Interest marking (one-tap star with confirmation to remove)
- ✅ Comment system with reply, edit, delete, and flagging
- ✅ Contact button (email mailto) for non-owners; disabled state when contact not set up

### Moderation & Leadership
- ✅ Join request approvals queue
- ✅ Flagging system (posts and comments) with resolution workflow
- ✅ Archive view of past/expired posts
- ✅ User management page for Admins

### Infrastructure
- ✅ Shift and request auto-expiration via Vercel cron (`/api/cron/expirations`, runs 3 AM daily)
- ✅ Expiration cron secured with `CRON_SECRET` header
- ✅ Email delivery infrastructure: Resend SDK wired up at `/api/send`
- ✅ Transactional email templates (verify email, password reset, generic notification)
- ✅ Supabase Row-Level Security on all tables
- ✅ Form validation (client + server) across auth, shifts, and boards

### UI / UX
- ✅ Responsive layout with mobile bottom nav and hamburger menu (with open/close animation)
- ✅ Dark mode (toggle in account menu, persisted to localStorage)
- ✅ My Calendar page
- ✅ 404 page with falling stars and floating compass
- ✅ Design token system (CSS variables + Tailwind config)
- ✅ `2026-07-19`: 6 themes (Light, Nordic, Kitty, Dark, Midnight, Cyberpunk — Dracula retired, replaced by Kitty, a soft-pastel light theme built from mint/sky/lavender/blush hexes). Picker grid groups light themes together on both breakpoints (desktop 3×2: Light/Nordic/Kitty over Dark/Midnight/Cyberpunk; mobile 2×3: Light/Dark, Nordic/Midnight, Kitty/Cyberpunk) via explicit per-item grid placement in `ProfileClient.tsx`, since one DOM order can't satisfy two different row-major layouts at once.

---

## Priority To-Do List

Tasks are ordered by impact. Each has a **🤖 Claude handles** section (code I write for you) and a **👤 You handle** section (accounts, config, decisions that only you can do). Check off steps as you go.

---

### 1 — Live Updates (Supabase Realtime) ✅ DONE

**🤖 Claude handled:**
- ✅ Added Realtime channel subscriptions to `WallClient.tsx` for `shifts` and `requests` tables
- ✅ INSERT / active UPDATE → silent re-fetch (no loading spinner flicker)
- ✅ Deactivation UPDATE / DELETE → instant removal from local state
- ✅ Channels cleaned up on component unmount

**👤 You handled:**
- ✅ Enabled Realtime replication for `shifts` and `requests` tables in Supabase dashboard

**👤 Still needed:**
- ✅ Tested with two browser tabs — live updates confirmed working

---

### 2 — Interest Notification Email ✅ DONE

**Why second:** When someone marks interest on your shift, you currently have no idea unless you manually check. This closes the most critical communication loop in the app.

**🤖 Claude handled:**
- ✅ Created `app/actions/notifications.ts` — `notifyInterest()` server action using service-role Supabase client
- ✅ Reads owner's email and `notify_via_email` pref before sending (respects opt-out)
- ✅ Calls Resend directly (no intermediate `/api/send` hop needed)
- ✅ Added `interestedHtml()` template to `email-template.tsx` with matching header/footer style
- ✅ Hooked into `CommentSection.tsx` — fires on both the quick-star pill and the comment form when "Interested?" is checked; fire-and-forget so it never blocks the UI

**👤 You handled:**
- ✅ `RESEND_API_KEY` confirmed in Vercel environment variables
- ✅ Sending domain `noreply@myshiftx.com` verified in Resend
- ✅ Tested — email received successfully

---

### 3 — Shift Match Notifications ✅ DONE

**🤖 Claude handled:**
- ✅ Matching logic: same board + same date (ET) + shift start time falls within preferred time window
- ✅ `notifyShiftPosted()` — finds active requests that match and emails both parties
- ✅ `notifyRequestPosted()` — finds active shifts that match and emails both parties
- ✅ `shiftMatchHtml()` email template with role-aware copy for each recipient
- ✅ Deduplication by user ID prevents double emails from duplicate DB records
- ✅ Added `request_title` field to request form and card

**👤 You handled:**
- ✅ Added `request_title` column to `requests` table in Supabase
- ✅ Tested both directions — emails confirmed working

---

### 4 — SMS Notifications *(Revived — now a Pro-tier feature)*

SMS is now part of the Pro subscription. See **Task 11** for the full implementation plan.

---

### 5 — OAuth Login (Google + Facebook + LinkedIn) `IN PROGRESS`

**🤖 Claude handled:**
- ✅ `OAuthButtons` component — branded Google, Facebook, LinkedIn buttons with SVG icons
- ✅ Buttons added to login and register pages with a divider
- ✅ `/auth/callback` route — exchanges code, sends new OAuth users to profile to set display name
- ✅ Profile page welcome banner for first-time OAuth arrivals

**👤 You handle — complete each provider below, then test:**

#### Google
- ✅ Go to **console.cloud.google.com** → select or create a project
- ✅ APIs & Services → **OAuth consent screen** → External → fill in App name, support email, developer email → Save & Continue through all steps
- ✅ APIs & Services → **Credentials** → Create Credentials → **OAuth client ID**
  - Application type: **Web application**
  - Authorized redirect URIs → Add: `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
  - *(your ref is the subdomain part of your Supabase project URL — find it in Supabase → Settings → General)*
- ✅ Copy **Client ID** and **Client Secret**
- ✅ Supabase Dashboard → **Authentication → Providers → Google** → Enable → paste both → Save
- ✅ Test: click Google on the login page, sign in, verify you land on profile or wall

#### Facebook
- ✅ Go to **developers.facebook.com** → My Apps → **Create App**
  - Use case: **Authenticate and request data from users** → Next
  - App name: `MyShiftX` → Create app
- ✅ On the app dashboard: Add product → **Facebook Login** → **Web**
  - Site URL: `https://myshiftx.com` → Save
- [ ] Left sidebar: Facebook Login → **Settings**
  - Valid OAuth Redirect URIs → Add: `https://<your-supabase-ref>.supabase.co/auth/v1/callback` → Save
- [ ] Left sidebar: **App Settings → Basic** → copy **App ID** and **App Secret**
- [ ] Supabase Dashboard → **Authentication → Providers → Facebook** → Enable → paste both → Save
- [ ] To test in Development mode: **App Roles → Roles → Add Testers** → add your personal Facebook account
- [ ] When ready for public users: complete **App Review** and switch Mode from Development to **Live**
- [ ] Test: click Facebook on the login page

#### LinkedIn
- ✅ Go to **linkedin.com/developers** → **Create app**
  - App name: `MyShiftX`, LinkedIn Page: create/use a company page (required by LinkedIn), upload logo
- ✅ **Auth** tab → OAuth 2.0 settings → Authorized redirect URLs → **Add URL**:
  `https://<your-supabase-ref>.supabase.co/auth/v1/callback` → Update
- ✅ **Products** tab → **Sign In with LinkedIn using OpenID Connect** → **Request access** (usually instant)
- ✅ **Auth** tab → copy **Client ID** and **Client Secret**
- ✅ Supabase Dashboard → **Authentication → Providers → LinkedIn (OIDC)** → Enable → paste both → Save
  *(Use the **OIDC** provider specifically — not the older plain LinkedIn OAuth provider)*
- ✅ Test: click LinkedIn on the login page

---

### Feature Tier Reference 🗂️

This is the canonical Free vs Pro feature list. Use this when building the upgrade funnel (Task 8), feature gating (Task 10), and the ad system (Task 12). Emoji key: ✅ already built · 🔲 planned in task list · 🆕 new — not yet in roadmap

#### 🆓 Free (Basic) — $0

| Feature | Status |
|---|---|
| Account creation & profile | ✅ |
| Join unlimited boards (invite-only) | ✅ |
| Post shift offers and requests to board wall | ✅ |
| Mark interest in shifts (actual trade completed via company system) | ✅ |
| Manual shift entry & calendar view | ✅ |
| In-app comments & flagging | ✅ |
| In-app messaging with anyone in the same board | ✅ |
| In-app push notifications (web push / PWA) | 🆕 |
| 4 photo schedule imports per month (OCR → auto-creates shifts) | 🆕 |
| Ads displayed (right sidebar on desktop, static at bottom of screen on mobile) | 🔲 Task 12 |

#### ⭐ Pro — $4.99/mo · $26.99/6 mo · $47.99/year

| Feature | Status |
|---|---|
| Everything in Free | — |
| **Ad-free experience** | 🔲 Task 10 |
| **SMS notifications** for shift matches (up to 30/mo) | 🔲 Task 11 |
| **Unlimited photo schedule imports** | 🆕 |
| **Calendar export & sync** (Google Calendar, Apple iCal) | ✅ |
| **Trade preferences** — set preferred shift types, time of day, etc. for smarter matching | 🆕 |
| **Bulk shift import** — CSV upload or multi-week photo scan | 🆕 |

#### 🆕 New features not yet in the roadmap

The following Pro and Free features have not been scoped yet and will need dedicated tasks before launch or shortly after:

- ~~**Photo schedule import**~~ — ✅ Done (Task 15): user photographs their paper or on-screen schedule and Gemini 2.5 Flash reads it onto their calendar in seconds, with review/conflict handling. The highest-value Free feature and the biggest differentiator from manual entry. 4/month Free, unlimited Pro.
- ~~**In-app messaging**~~ — ✅ Done (Task 19): real in-app threads between board-mates with Realtime, unread badges, and push notifications. All tiers, shared-board only.
- **In-app push notifications** — browser-native web push (PWA-style) using the Push API and a service worker. Free tier. Works on desktop Chrome/Edge/Firefox, Android Chrome, **and iOS 16.4+ once the PWA is added to the Home Screen** (Task 23 ships a guided install walkthrough; the old "not available on iOS" note was outdated). Supplements or replaces email for non-SMS users. Medium complexity.
- ~~**Calendar export/sync**~~ — ✅ Done (Task 17): live-sync iCal feed URL + one-click `.ics` download, works with Google Calendar, Apple Calendar, and Outlook. Pro only.
- **Trade preferences** — users set preferred shift types, days of week, and time windows; the matching engine factors these in when firing notifications. Extends the existing `notifyShiftPosted`/`notifyRequestPosted` logic. Medium complexity.
- ~~**Direct messaging outside boards**~~ — Removed. Messaging is board-member only for all tiers.
- **Bulk shift import (CSV / multi-week photo)** — upload a CSV of shifts or scan multiple weeks of a schedule at once. Pro only. Extends photo import (Task 15).

---

### 6 — Membership Schema (Database) ✅ DONE

**Why first:** Everything else — Stripe, feature gating, ads — depends on knowing a user's membership tier.

**🤖 Claude handles:**
- ✅ Add `membership` column (`text`, default `'Basic'`, values: `'Basic'` | `'Pro'` | `'Trial'`) to the `users` table migration
- ✅ Add `trial_ends_at` column (`timestamptz`, nullable) — set when a Trial starts, checked on each login/request
- ✅ Add `trial_used` column (`boolean`, default `false`) — prevents a second trial on the same account even if they cancel and re-register (tracked by email)
- ✅ Update TypeScript types (`lib/database.types.ts` matches the live schema)
- ✅ Nightly downgrade job — folded into the existing `/api/cron/expirations` Vercel cron (runs 3 AM daily) rather than a separate Supabase Edge Function; flips `Trial` → `Basic` and clears `trial_ends_at` once it has passed
- ✅ RLS/write protection: a `BEFORE UPDATE` trigger (`enforce_membership_protection`) silently reverts any change to `membership`/`trial_ends_at`/`trial_used` made by the `authenticated` role — only the service role (Stripe webhook) can actually change them
- ✅ RLS/read protection: `2026-07-01` — found that `membership`/`trial_ends_at`/`trial_used` were readable by *any* logged-in user (not just the owner) via the broad `users_select_authenticated` policy. Fixed by revoking column-level `SELECT` on those three columns from `anon`/`authenticated` and adding a `get_own_membership()` RPC that returns only the caller's own values (`SECURITY DEFINER`, filtered by `auth.uid()`). Verified: selecting `membership` as the `authenticated` role now fails with "permission denied for table users"; all other columns (`display_name`, `email`, `role`, etc.) remain readable as before, so comments/board-member/admin/mod features are unaffected. Migrations: `20260701152617_membership_schema_backfill.sql`, `20260701152628_restrict_membership_column_access.sql`, `20260701152710_fix_membership_column_grant_precedence.sql`

**👤 You handle:**
- ✅ Migration SQL already run directly in Supabase — columns are live in the `users` table
- ✅ Confirmed columns appear correctly (verified via Supabase schema inspection)
- ✅ N/A — used the existing Vercel cron instead of a separate Supabase Edge Function; already enabled

**Note:** these schema changes existed live in Supabase but had no corresponding migration file in the repo (applied via SQL Editor directly). Backfilled as `20260701152617_membership_schema_backfill.sql` so a fresh DB restore from the repo stays in sync. Two unrelated migrations (`handle_new_user_google_display_name`, `handle_new_user_fullname_fallback` — from the OAuth display-name work) were *also* live but missing from the repo; backfilled as `20260624224803_handle_new_user_google_display_name.sql` and `20260624225745_handle_new_user_fullname_fallback.sql` so the full migration history (30 files) now matches production exactly.

**Follow-up hardening (2026-07-01):** ran the Supabase security advisor as a broader check and fixed two more real issues, both applied + backfilled as migrations:
- `protect_membership_fields()` (the trigger from this task) and five other trigger functions were missing a pinned `search_path`, a standard SECURITY DEFINER hardening measure — fixed in `20260701153736_harden_trigger_functions.sql`.
- `protect_membership_fields`, `auto_add_admins_to_board`, `handle_new_user`, and `handle_email_verified` are trigger-only functions but were directly callable via PostgREST RPC (`/rest/v1/rpc/...`) by any signed-in or anonymous user — revoked `EXECUTE` from `anon`/`authenticated` on all four in the same migration.
- Still open (dashboard setting, not a migration): Supabase's "Leaked Password Protection" (HaveIBeenPwned check) is disabled — recommend enabling it under Authentication → Policies.

---

### 7 — Stripe Integration & Checkout `NEXT`

**Why now:** The database schema is live; now wire up real payments before building the sales page around it.

**👤 You handle (do these first):**
- ✅ Create a Stripe account at **stripe.com** (use your business email)
- ✅ In Stripe Dashboard → **Products** → **Add product**: `MyShiftX Pro`
  - Add price: **$4.99 / month** (recurring, monthly) "Pro Monthly" Badge: None (or "Best for Flexibility") price_1TvLnJRkt6cn1JfFJ9FfomWy
  - Add price: **$13.99 / 3 month** (recurring, monthly) "6.7% off monthly" price_1TvLnJRkt6cn1JfFxwJwoVZh
  - Add price: **$26.99 / 6 months** (recurring, every 6 months) "Pro Semi-Annual" Badge: SAVE 10% "Billed every 6 months. Saves you $3." price_1TvLnJRkt6cn1JfFOwpqG5xE
  - Add price: **$47.99 / year** (recurring, yearly) "Pro Annual" Badge: SAVE 20% BEST VALUE or 2 MONTHS FREE "Billed annually. Saves you $12 compared to monthly." price_1TvLnJRkt6cn1JfFBXS1THIJ
  - Note the **Price IDs** for each (format: `price_xxxxx`) — Claude needs these
- ✅ **`MyShiftX Pro Trial` product / $0.00 price — archive this, it's a trap.** A $0.00 price that recurs every 14 days doesn't convert to paid; it renews at $0.00 forever, so anyone picking it gets permanent free Pro. Stripe deliberately doesn't expose trial days on the Price edit page either — the price-level `trial_from_plan` route is deprecated in favour of `subscription_data.trial_period_days` on the Checkout Session ([docs](https://docs.stripe.com/payments/checkout/free-trials)). The trial now lives as `trialDays: 14` on the Monthly plan in `lib/pricing.ts` and is passed to Stripe at checkout; Stripe still owns the whole trial (card verification, countdown, reminder email, first charge, dunning).
- ✅ Stripe Dashboard → **Developers → API Keys** → copy **Publishable Key** and **Secret Key**
- ✅ Add to Vercel environment variables:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET` *(generate after Claude sets up the webhook endpoint)*
- ✅ Stripe Dashboard → **Developers → Webhooks** → **Add endpoint**:
  - URL: `https://myshiftx.com/api/webhooks/stripe`
  - Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
  - Copy the **Signing Secret** → add as `STRIPE_WEBHOOK_SECRET` in Vercel
- ✅ In Stripe Dashboard → **Products** → **Add product**: `MyShiftX Pro`
  - Add test price: **$4.99 / month** (recurring, monthly) "Pro Monthly" Badge: None (or "Best for Flexibility") price_1TvRbbRkt6cn1JfFLHAmjG3N
  - Add test price: **$13.99 / 3 month** (recurring, monthly) "6.7% off monthly" price_1TvRbVRkt6cn1JfFWzCnDWPX
  - Add test price: **$26.99 / 6 months** (recurring, every 6 months) "Pro Semi-Annual" Badge: SAVE 10% "Billed every 6 months. Saves you $3." price_1TvRbKRkt6cn1JfFmxAKX8VX
  - Add test price: **$47.99 / year** (recurring, yearly) "Pro Annual" Badge: SAVE 20% BEST VALUE or 2 MONTHS FREE "Billed annually. Saves you $12 compared to monthly." price_1TvRb1Rkt6cn1JfFSWmXBHJ4
- ✅ In Stripe Create Test API Keys → copy **Publishable Key** and **Secret Key**
  - Add to Vercel env: `STRIPE_SECRET_KEY`
  - Add to Vercel env: `STRIPE_PUBLISHABLE_KEY`


**🤖 Claude handled (shipped `2026-07-20`; code complete, migration NOT yet applied):**
- ✅ `stripe` npm package (v22.3.2). Client in `lib/stripe.ts`, pinned to API version `2026-06-24.dahlia` so a future `npm update` can't shift response shapes under the webhook. Whole surface gated on `STRIPE_SECRET_KEY` via `isStripeConfigured()` — same env-flip pattern as AdSense/push/Gemini
- ✅ Migration `20260720120000_stripe_customer_columns.sql` — `stripe_customer_id` (partial unique) + `stripe_subscription_id` (partial index) on `users`. Both deliberately left OUT of the client SELECT grant (the Task 6 lockdown made grants an explicit column list, so new columns are private by default). Also extends `protect_membership_fields()` + its trigger WHEN clause to cover both columns, so `authenticated` can't repoint their row at someone else's Stripe customer
- ✅ `/api/checkout` — client posts a plan **key**, never a Price ID, so a tampered request can't check out against an arbitrary price. Reuses an existing `stripe_customer_id` rather than minting duplicate customers; blocks if already Pro; `allow_promotion_codes: true` so Task 9's coupons work with no further code; omits `payment_method_types` entirely per Stripe guidance (dynamic payment methods convert better than hardcoded card-only)
- ✅ `/api/webhooks/stripe` — signature-verified against the raw body (`req.text()`, not `req.json()`). Handles `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`. Status→tier map: `trialing`→Trial, `active`/`past_due`→Pro, everything else→Basic. **`past_due` deliberately keeps Pro** — Stripe is still retrying, and revoking features mid-dunning punishes someone for an expired card. DB write failures throw a 500 so Stripe retries rather than silently leaving a paying customer on Basic
- ✅ `trial_used` is burned the moment a trialing subscription exists, so cancel-and-resubscribe can't farm free months
- ✅ `/api/customer-portal` — Stripe-hosted portal for plan changes, card updates, **invoice downloads**, and cancellation. Nothing transactional is rebuilt in-app
- ✅ `paymentFailedHtml` email template (Resend), respects `notify_via_email`; a send failure never fails the webhook
- ✅ UI: `CheckoutButton` on all four `/upgrade` cards (Monthly reads "Start Free Trial" + a "Start with 14 days free" line), new `/upgrade/success` page that reports actual DB state rather than assuming the webhook already landed, `MembershipSection` card on Profile (`#membership`) with the Manage Billing button, new trial FAQ
- ✅ Verified: `tsc --noEmit` clean, `next lint` clean, `next build` passes with all three API routes registered

**👤 You handle (after Claude ships the code):**
- ✅ **Apply the migration** — `20260720120000_stripe_customer_columns.sql`. Applied to prod `2026-07-20` via Supabase MCP (`apply_migration`) after a first checkout test proved the columns were missing — every webhook was 500ing on `column users.stripe_customer_id does not exist`. Columns + trigger now confirmed live
- [ ] **Switch to test-mode keys before testing.** `.env.local` currently holds `sk_live_`/`pk_live_` keys — `4242 4242 4242 4242` only works in test mode, and a real card against live keys is a real charge. Note **Price IDs are mode-specific**: the four `STRIPE_PRICE_*` values in `.env.local` are live-mode IDs and need test-mode equivalents when you flip
- ✅ Add to Vercel env: `STRIPE_PRICE_PRO_MONTHLY`, `_QUARTERLY`, `_SEMIANNUAL`, `_ANNUAL` (live-mode IDs are already in `.env.local`)
- ✅ Add `customer.subscription.created` to the webhook endpoint's event list in the Stripe Dashboard — the handler covers it, but the endpoint was configured before it existed
- [ ] Archive the `MyShiftX Pro Trial` product and its $0.00 price (see the ⚠️ note above)

**✅ Local sandbox testing — all four flows verified end-to-end `2026-07-20` (test user Lucas Hayes):**
- ✅ Checkout → Stripe → webhook → DB: `membership` flips to `Trial` (monthly), `billing_cycle=monthly`, `trial_used=true`, customer + subscription IDs linked
- ✅ First real gotcha caught: every webhook was 500ing because migration `20260720120000` had been marked done but never applied — fixed by applying it (see the migration line above)
- ✅ Renewal-failure path: forced a real `invoice.payment_failed` (attached Stripe's always-fails card `pm_card_chargeCustomerFail`, ended the trial early). Email **delivered** via Resend ("Your MyShiftX Pro payment did not go through"); member correctly **stayed Pro** (`past_due` keeps Pro by design). Note: the $2.25 charge in that test was a proration artifact of ending the trial early — a real trial user is charged the full $4.99 on day 14, no proration
- ✅ Cancel path: immediate cancel → `customer.subscription.deleted` → `membership` back to `Basic`, `billing_cycle`/`stripe_subscription_id` cleared, `stripe_customer_id` retained (so a re-subscribe reuses the same customer)
- ✅ Fixed along the way: canceled users no longer keep a stale `trial_ends_at` (webhook now nulls it for Basic). Duplicate test subs (from pre-fix retries) all shared one `user_id`, so deleting them fired delete-webhooks that flipped the user to Basic — a test-only artifact, impossible in prod where the "already Pro" guard blocks a second sub
- ✅ Test the Customer **Portal** UI itself once in the browser (Manage Billing → cancel / update card / download invoice) — the cancel path was verified via API, but clicking through the hosted portal is worth doing once

---

#### 🚀 Production go-live checklist (Stripe + Vercel) — do these before real customers

Everything above was **test mode**. Live mode is a completely separate world in Stripe: separate keys, separate products/prices, separate webhook endpoint, separate portal config. Nothing configured in the sandbox carries over.

**Stripe Dashboard — switch to LIVE mode (toggle off "Test mode" top-right):**
- ✅ Confirm the live `MyShiftX Pro` product exists with all four live prices (the live Price IDs are already in TASKS.md / commented in `.env.local`: monthly `price_1TvLnJ…FJ9FfomWy`, quarterly `…FxwJwoVZh`, semiannual `…FOwpqG5xE`, annual `…FBXS1THIJ`)
- ✅ Archive the live `MyShiftX Pro Trial` $0.00 product (the trap price) if it still exists in live mode
- ✅ **Developers → Webhooks → Add endpoint** (live mode): URL `https://myshiftx.com/api/webhooks/stripe`, events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Copy that endpoint's **live** `whsec_` — it is NOT the local `stripe listen` one
- ✅ **Settings → Billing → Customer portal** (live mode): enable Cancel subscription, Update payment method, Invoice history, then **Save** (portal config is per-mode; the test-mode save doesn't count)
- ✅ Confirm business/branding is set for live invoices: **Settings → Branding** (logo, accent color, support email) so live invoice PDFs read "MyShiftX"

**Vercel → Project → Settings → Environment Variables (Production):**
- ✅ `STRIPE_SECRET_KEY` = the **live** `sk_live_…` key
- ✅ `STRIPE_PUBLISHABLE_KEY` = the **live** `pk_live_…` key
- ✅ `STRIPE_WEBHOOK_SECRET` = the **live** endpoint's `whsec_…` (from the step above — not the CLI one)
- ✅ `STRIPE_PRICE_PRO_MONTHLY` / `_QUARTERLY` / `_SEMIANNUAL` / `_ANNUAL` = the four **live** Price IDs
- ✅ Redeploy so the new env vars take effect (Vercel doesn't apply env changes to the running deployment automatically)

**Post-deploy smoke test (live mode, real card, small commitment):**
- [ ] On production, run one real checkout on the **Monthly** plan (real card, you can cancel immediately after) → confirm you land on `/upgrade/success` as Trial and your DB row flips
- [ ] In Stripe live **Developers → Webhooks**, confirm the endpoint shows recent `200` deliveries (not `4xx`/`5xx`)
- [ ] Cancel that subscription via Manage Billing → confirm you return to Basic
- [ ] (Optional) Refund the proration/charge from the live Dashboard if you charged yourself

---

### 8 — Subscription Sales / Upgrade Page `NEXT`

**Why now:** Users need a destination to convert. Build this alongside Stripe so the checkout button has somewhere to go.

**🤖 Claude handles:**
- ✅ `2026-07-09`: `/upgrade` page built — hero ("Stop Refreshing. Start Swapping."), 4 pain-point cards, 4-card pricing grid (Monthly/3-Month/6-Month/Annual with per-month framing + savings badges, Annual featured), Basic-vs-Pro comparison table (coming-soon rows labeled honestly), FAQ accordion, footer CTA. Plan data + comparison rows live in `lib/pricing.ts` (single source of truth; each plan carries its future `STRIPE_PRICE_*` env name). Buy buttons render "Launching Soon" until `STRIPE_SECRET_KEY` is set — same env-flip pattern as everything else. Already-Pro members see a thank-you ribbon instead of CTAs. Added to sitemap.
- ✅ Wire each "Go Pro" button to `/api/checkout` with the correct Price ID (blocked on Task 7 Stripe setup — buttons + price IDs are staged in `lib/pricing.ts`)
- ✅ `2026-07-09`: "Upgrade to Pro" ⭐ entry in the account dropdown for Basic users (`showUpgrade` prop on Navbar, driven by the tier signal in the dashboard layout)
- ✅ `2026-07-09`: Dismissible-per-session upgrade nudge banner on the Wall for Basic users (`UpgradeNudge`, sessionStorage)
- ✅ Post-purchase: redirect to a `/upgrade/success` confirmation page (with Task 7)

**👤 You handle:**
- ✅ Review the copy Claude writes — adjust any phrasing to match your voice
- ✅ Approve the design before Claude calls it done
- ✅ Decide trial length: 7 days, 14 days, or 30 days
- ✅ Decide whether trial requires a credit card upfront (Stripe supports both options)

---

### 9 — Discount Codes & Promotional Pricing `NEXT`

**Why now:** Set these up in Stripe before launch so they're ready to share.

**👤 You handle (all in Stripe Dashboard → Promotions → Coupons):**
- [ ] **Disney Cast Member discount** — create a coupon (e.g., 20–30% off monthly, forever or for 6 months) + a Promotion Code (e.g., `CASTMEMBER`) to share via internal Cast Member channels
- [ ] **Friends & Family discount** — create a coupon + Promotion Code (e.g., `FRIENDS`) for personal sharing
- [ ] **Holiday / event promos** — create time-limited coupons with expiration dates (e.g., `SUMMER25`, `HOLIDAY25`) — set amount off or % off and an expiration date on the coupon
- [ ] Decide whether promo codes are one-time-use per customer or unlimited

**🤖 Claude handles:**
- [ ] Add a **Promo Code input field** to the Stripe Checkout Session (one line of config — Stripe renders the UI automatically in hosted Checkout)
- [ ] If using Stripe Elements instead: build a custom promo code field that calls the Stripe API to validate and apply the discount before confirming

---

### 10 — Feature Gating (Pro vs Basic) `NEXT`

**Why now:** The membership column exists and Stripe is wired up — now enforce the tiers in the app.

**🤖 Claude handles:**
- ✅ `2026-07-09`: `getMembership()` + `isProTier()` server helpers in `lib/auth/session.ts` (wrap the `get_own_membership` RPC; fail toward Basic so a lookup error never leaks a paid perk)
- ✅ `2026-07-09`: **Shift match notifications** — match alert *emails* in `sendMatchNotifications()` are now per-recipient gated to Pro/Trial (membership fetched via service role in both `notifyShiftPosted` and `notifyRequestPosted`); web push stays free-tier per the Feature Tier Reference
- ✅ `2026-07-09`: **Wall auto-refresh (Realtime)** — Basic users' realtime events raise a "New activity — refresh to see it" banner (with a "Pro members see new posts instantly" upsell link) instead of applying live; Pro/Trial get the live Wall via the `liveWall` prop
- ✅ **Ad suppression** — already live via `getShowAds()` + `AdRail` (Task 12)
- ✅ **Trial expiration** — handled by the existing daily expirations cron (demotes Trial→Basic and clears `trial_ends_at`); the profile badge shows days remaining, so no separate page-load gate/modal needed
- ✅ **Trial eligibility check** (`trial_used`) — lands with the trial start flow in Task 7 (Stripe); `getMembership()` already surfaces `trialUsed`
- ✅ `2026-07-09`: Membership badge on Profile — Basic shows "Basic · Upgrade ⭐" linking to /upgrade; Pro shows "⭐ Pro"; Trial shows "⭐ Trial · N days left"

**👤 You handle:**
- [ ] Test each gated feature as a Basic user (create a second test account)
- [ ] Test trial expiration by temporarily setting `trial_ends_at` to a past timestamp in the DB

---

### 11 — SMS Notifications (Pro Tier) `NEXT`

**Previously deferred** — now a core Pro benefit. Up to 30 SMS/month per user.

**👤 You handle (do these first):**
- [ ] Create a **Twilio** account at **twilio.com**
- [ ] Buy a phone number (or use the trial number for testing)
- [ ] In Twilio Console → copy **Account SID** and **Auth Token**
- [ ] Add to Vercel environment variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

**🤖 Claude handles:**
- [ ] Add `phone_number` field to the user profile form and `users` table (optional, user-supplied)
- [ ] Add `notify_via_sms` preference (boolean, default `false`) and `sms_count_this_month` counter (integer, default `0`) to users table
- [ ] Add `sms_reset_date` column — reset `sms_count_this_month` to `0` on the 1st of each month via Supabase cron
- [ ] Install `twilio` npm package; create `lib/sms.ts` with a `sendSms()` helper that:
  - Checks `membership === 'Pro' || 'Trial'`
  - Checks `notify_via_sms === true`
  - Checks `sms_count_this_month < 30`
  - Sends via Twilio, then increments `sms_count_this_month`
- [ ] Wire `sendSms()` into `notifyShiftPosted()` and `notifyRequestPosted()` alongside the existing email
- [ ] Add SMS opt-in/out toggle and current month usage counter (`X / 30 SMS used`) to the Profile / Notifications settings page

**👤 You handle (after Claude ships the code):**
- [ ] Add your own phone number to your test account and confirm SMS arrives when a match fires
- [ ] Test that the 30/month cap is enforced (set `sms_count_this_month = 30` in DB and verify no SMS sends)

---

### 12 — Ad System (Placeholders + Google AdSense) `IN PROGRESS`

**Why last:** Ads are a Basic-tier experience. Get subscriptions shipping first; then monetize the free tier.

**Placement (as of 2026-07-01):** Wall, My Calendar, Profile, individual Board (Members) page, Approvals, Flags, Archive, Help & Support. Sticky right rail on desktop/tablet (≥ 1024px, reserves real layout space so it never overlaps page content), sticky bar just above the mobile bottom nav on phones. No ads on the landing/marketing pages or any auth/OAuth page.

**🤖 Claude handles:**
- ✅ `2026-07-01`: `<AdSlot>` component (`components/features/AdSlot.tsx`) — styled placeholder ("Advertisement", dashed border) when no `data-ad-slot` ID is wired for a placement yet; swaps to a real AdSense `<ins>` unit once one is added
- ✅ `2026-07-01`: `<AdRail>` wrapper (`components/features/AdRail.tsx`) — path-gated, renders the sticky desktop rail + mobile bottom bar only on the 8 pages listed above
- ✅ `2026-07-01`: Ads suppressed for Pro/Trial — `getShowAds()` in `lib/auth/session.ts` reads membership via the existing `get_own_membership()` RPC (defaults to **no ads** if the lookup ever fails, so an error can't accidentally show ads to a paying member)
- ✅ `2026-07-01`: AdSense account script wired into the root layout via `next/script`, gated on `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` being set
- ✅ `2026-07-01`: Cookie consent banner (built earlier, disabled) now tied to the same `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` env var instead of a separate flag — activates automatically now that the AdSense script is live
- ✅ `2026-07-01`: `public/ads.txt`, `google-adsense-account` meta tag, `app/robots.ts`, `app/sitemap.ts` added — none of these existed before (site had zero SEO/crawl config)
- ✅ `2026-07-01`: Google-certified CMP (Funding Choices) wired in — 3-choice consent message (Consent / Do Not Consent / Manage) for EEA/UK/Switzerland. `middleware.ts` reads Vercel's `x-vercel-ip-country` edge header (no geo-IP service needed) and sets a `myshiftx-region` cookie; the custom `CookieConsentBanner` reads it and suppresses itself for EEA/UK/CH visitors so they don't get two consent prompts — Google's CMP handles that region instead
- ✅ `2026-07-01`: First real ad unit live — "Sticky Desktop" (slot `2239887190`) wired into the desktop rail via `NEXT_PUBLIC_ADSENSE_SLOT_STICKY_DESKTOP`. Along the way, corrected `<AdSlot>` to mirror whatever format AdSense actually generated per-unit instead of forcing one template on every slot. Originally created as fixed 300×600; switched to auto/responsive (`display:block`, min-height 250px reserved in the sticky rail) to match the updated unit
- ✅ `2026-07-01`: Second real ad unit live — "Sticky Mobile" (auto/responsive format, slot `5339481808`) wired into the mobile bottom bar via `NEXT_PUBLIC_ADSENSE_SLOT_STICKY_MOBILE`. Both placements from the original plan (desktop rail + mobile bar) now have real ad units — no more placeholders on either.
- ✅ `2026-07-08`: Now that the U.S. states message is published in AdSense too, `middleware.ts` buckets `US` visitors into their own `myshiftx-region=us` cookie value (previously lumped into `other`), and `CookieConsentBanner` suppresses itself for that region same as it already did for `eea` — Google's CMP now handles consent for both EEA/UK/CH and U.S. visitors, our own banner only shows to the remaining "other" regions.

**👤 You handle:**
- ✅ Publisher ID confirmed: `ca-pub-4865817496577079` (added to `.env.local`and to Vercel env for production)
- ✅ Sign up for **Google AdSense** at **adsense.google.com** if not already approved (requires a live site with content)
- ✅ **Create the actual consent message(s)** in AdSense → Privacy & messaging — the EEA/UK/CH GDPR message and the U.S. states message are both published now
- ✅ Ad units created in AdSense and wired in — "Sticky Desktop" (`2239887190`) and "Sticky Mobile" (`5339481808`) are the only two placements needed; `AdRail` reuses them across all `AD_ENABLED_PATHS` rather than needing one unit per page
- ✅ Review the placeholder layout — confirm sizing/placement (300×600 desktop rail, mobile bar above the bottom nav) feels right before real ad units go live
- ✅ Google flagged crawl trouble — **Vercel Authentication** was on for Production, blocking Googlebot entirely; scoped it to Preview deployments only so myshiftx.com is publicly crawlable again (Wall/Calendar/Profile/etc. still require login, so Google can only ever crawl the public marketing/legal pages — expected)
- ✅ `2026-07-08`: Went through AdSense's site-readiness checklist — found two gaps (no standalone About/Contact pages; footer only linked Terms/Privacy/Log In). Claude built `/about` and `/contact`, extracted the previously-duplicated landing footer into `components/landing/Footer.tsx`, and added About/Contact/Data Deletion links to it (Data Deletion existed but was never linked from anywhere public-facing). Both new pages are in the sitemap and ad-enabled, matching Terms/Privacy
- [ ] Confirm ads are now working

### 13 — Business Entity & Legal Protection `PARALLEL`

**Structure:** The LLC is **Digital Elegance LLC** (parent company). MyShiftX operates as a registered **DBA (fictitious name)**. All revenue, contracts, and bank accounts go under Digital Elegance LLC d/b/a MyShiftX. This is Florida-based — steps and links reflect Florida law.

Complete in order — each step unlocks the next.

---

#### 👤 Formation (do these first, in order) — one-time cost ~$175

- ✅ **1. Get your EIN** — free, instant at **irs.gov** → Apply for EIN Online. Do this before anything else; you need it for the bank account. Takes 5 minutes.
- ✅ **2. File LLC Articles of Organization** — **sunbiz.org** → File Online → LLC Articles. Fee: **$100** + $25 registered agent. Processing: 2–3 business days online. Keep the stamped copy.
  - Registered agent: you can serve as your own agent using your Florida business address — free. No need to pay a registered agent service.
- ✅ **3. File MyShiftX fictitious name (DBA)** — **sunbiz.org** → File Online → Fictitious Name. Fee: **$50**. Renew every 5 years. File simultaneously with or right after the Articles.
- ✅ **4. Open a dedicated business bank account** — **Mercury** (mercury.com) or **Relay** recommended — both are free, online-first, and built for small businesses. Do NOT use a personal account. Mixing funds can pierce the LLC's liability protection.
- ✅ **5. Draft an Operating Agreement** — not required in FL but strongly recommended. AI-drafted is sufficient at launch. Have an attorney review once revenue is consistent. Defines ownership, decision-making, and what happens if you bring in a partner.

---

#### 👤 IP & Legal — one-time cost ~$421

- [ ] **6. Post Privacy Policy, Terms of Service & DMCA notice** — required before launch. Claude drafts these (see below). Flag for attorney review once shift-trading employment nuances matter (FL + Disney are non-trivial). Cost: $0 if AI-drafted.
- [ ] **7. Register DMCA designated agent** — **dmca.copyright.gov** → Register. Fee: **$6 / 3 years**. Post the DMCA policy page on the site at the same time. Copyright Office emails a renewal reminder before expiration.
- [ ] **8. Register Twilio 10DLC brand + campaign** — required by carriers to send A2P SMS (the Pro-tier match notifications). In Twilio Console: **Messaging → Regulatory → 10DLC**. Cost: **~$16 one-time** (~$4.50 brand registration + ~$11.50 campaign vetting). Do this before launching SMS features.
- [ ] **9. File USPTO trademark — MyShiftX (Class 42)** — **USPTO Trademark Center** → TEAS Plus. **Class 42** = Software as a Service. Fee: **$350**. Use the ID Manual dropdown to select the exact description — this avoids the $200 surcharge for non-standard descriptions. Processing: 8–14 months, but protection dates back to your filing date. Can file after launch.
- [ ] **10. Register copyright — MyShiftX code & UI** — **copyright.gov** → Register → Online Registration. Fee: **~$65**. File as a "collection" — covers all original code, email templates, and UI copy in one filing. Can file after launch.

---

#### 🤖 Claude handles — Legal Documents

- ✅ **Terms of Service** (`/terms`) and **Privacy Policy** (`/privacy`, covers cookies in Section 7) exist and are substantive. **Still missing:** standalone **Refund & Cancellation Policy** and **Cookie Policy** pages. *(Flag all for attorney review before charging real money.)*
- ✅ `2026-07-01`: Cookie consent banner built (`components/features/CookieConsentBanner.tsx`, bottom bar with Accept/Decline, stores the choice in localStorage) — but intentionally **disabled** (`COOKIE_BANNER_ENABLED = false`) until Google AdSense actually ships. Right now the only cookies MyShiftX sets are Supabase Auth session cookies, which are "strictly necessary" and exempt from GDPR/ePrivacy/CCPA consent requirements, so showing a banner today would be friction with no legal purpose. Flip the flag to `true` as part of Task 12 (Ad System).

---

#### 👤 Ongoing Compliance — annual

- [ ] **Florida LLC annual report** — due **May 1** every year at **sunbiz.org**. Fee: **$138.75**. Late filing penalty: **+$400**. Set a calendar reminder for April 15 so you don't miss it.
- [ ] **Quarterly estimated federal taxes** — due **Apr 15, Jun 15, Sep 15, Jan 15** (IRS Form 1040-ES). Florida has no state income tax, so federal only. Set aside ~25–30% of net revenue each quarter.
- [ ] **DMCA agent renewal** — every 3 years at dmca.copyright.gov (~$6). Copyright Office will email a reminder.
- [ ] **USPTO trademark maintenance** — Section 8 declaration due between **years 5–6** of registration. USPTO will NOT remind you — calendar it now.
- [ ] **S-Corp election** — once net profit consistently exceeds ~$40k/year, an S-Corp election reduces self-employment tax. Talk to a CPA at that point.
- [ ] **Business insurance** — General Liability + Tech E&O (Errors & Omissions) once revenue starts. Hiscox, Next Insurance, and CoverWallet offer online quotes.

---

#### 💰 Monthly Infrastructure Costs (Reference)

| Service | Cost | Notes |
|---------|------|-------|
| RackNerd VPS (digitalelegance.com) | $10/mo | Existing VPS, 1 TB transfer |
| Vercel Pro | $20/mo | 1 seat, includes 1M edge requests |
| Supabase Pro | $35/mo | $25 base + usage; budget $35–$60/mo at launch |
| Claude Pro (dev) | $20/mo | Includes Claude Code |
| Domains (myshiftx + digitalelegance) | $2/mo | ~$11/yr each, amortized |
| Stripe | Per transaction | 2.9% + $0.30 flat fee; no monthly fee |
| Twilio SMS (paid users only) | ~$0.37/paid user/mo | At 30 SMS/user; base + carrier cost |
| **Floor total (excl. Twilio + Stripe)** | **$88/mo** | Scales with paid users beyond this |

**Year 1 estimated total:** ~$175 formation + $421 IP/legal + ($88 × 12 infra) = **~$2,652 all-in before Stripe/Twilio variable costs.**

---

### 14 — Dedicated Mobile App (React Native / Expo) `YEAR 2+`

**When to start:** Not during beta. The right trigger is **three conditions met simultaneously:**
1. The web app is feature-stable (most tasks above are complete)
2. You have consistent paid users — roughly **50+ active Pro subscribers** justifies the investment
3. You are ready to expand beyond the first park/employer (Year 2 in the financial model: WDW + Universal)

Building the app before these conditions wastes development time on a moving target. The web app handles 100% of use cases until then.

---

**Why a dedicated app matters at scale:**

- **Native push notifications (FCM/APNs)** — free via Firebase, works on Android and iOS without requiring SMS. At scale this replaces or dramatically reduces the Twilio SMS cost (~$0.012/message) while delivering a better user experience
- **Home screen presence** — app icon on a Cast Member's phone vs. a browser bookmark is a significant engagement difference
- **Faster interactions** — native navigation, haptic feedback, and background sync feel noticeably better than a mobile browser
- **App Store discoverability** — users searching for shift swap tools can find MyShiftX organically

---

**Technology recommendation: Expo (React Native)**

Because the existing codebase is React/TypeScript, Expo is the natural path — business logic, TypeScript types, Zod schemas, and Supabase client calls can all be shared with the web app. The app mirrors the web rather than duplicating it.

**What the app includes (mirrors the web):**
- The Wall (shift offers and requests, with real-time updates)
- Post/edit shift and request forms
- Board management and member list
- Profile and notification settings
- Calendar view
- Native push notifications for shift matches (replacing SMS for in-app users)

**What stays web-only:**
- Admin tools and moderation pages (not worth building for the small admin audience)
- Legal pages (Terms, Privacy, Data Deletion) — link to myshiftx.com
- The upgrade/subscription sales page — Apple takes 30% on in-app purchases; link to web checkout instead

---

**👤 You handle — Before Development:**
- [ ] **Apple Developer Program** — enroll at developer.apple.com. Fee: **$99/year**. Required to publish to the App Store and test on real iOS devices. Takes 24–48 hrs to approve.
- [ ] **Google Play Developer account** — enroll at play.google.com/console. Fee: **$25 one-time**. Required to publish to the Play Store. Takes 1–3 days to verify.
- [ ] **Firebase project** — create a Firebase project (free) for FCM push notifications. One project covers both iOS and Android.
- [ ] **App Store listing assets** — icon (1024×1024), screenshots at required sizes for iPhone and iPad, short and long description, keywords, privacy policy URL, support URL
- [ ] **Decide subscription model for App Store** — Apple takes 30% (15% after year 1) on in-app purchases. Recommended: gate subscription purchase behind a web link to avoid Apple's cut. Users subscribe at myshiftx.com, app detects Pro status via Supabase.
- [ ] **Trademark** — confirm USPTO trademark for MyShiftX is filed before App Store submission (prevents another party from filing a takedown on your listing)

**🤖 Claude handles:**
- [ ] Scaffold Expo project with shared TypeScript types from the web codebase
- [ ] Set up Supabase auth in the app (same session system, supports OAuth and email/password)
- [ ] Build the Wall screen with real-time Supabase subscription (same logic as WallClient)
- [ ] Build post/edit forms (reuse validation schemas from `lib/validations/`)
- [ ] Implement FCM/APNs push notification registration and handlers
- [ ] Build profile and settings screens
- [ ] App Store and Play Store submission configuration (app.json, EAS Build)

**👤 You handle — Submission:**
- [ ] **Apple App Review** — 1–7 day review process. Common rejection reasons: missing privacy policy, incomplete app, metadata mismatch. Submit early.
- [ ] **Google Play Review** — typically 1–3 days for new apps. Less strict than Apple but requires a privacy policy URL in the listing.
- [ ] **App Store Connect setup** — pricing, age rating (likely 12+ or 17+), primary category (Business or Productivity), territories

**💰 Additional costs once live:**
| Item | Cost | Notes |
|------|------|-------|
| Apple Developer Program | $99/yr | Required to stay on the App Store |
| Google Play Developer | $25 one-time | Already paid at enrollment |
| Firebase (FCM) | Free | Up to 10,000 subscribers free; scales cheaply beyond that |
| Expo EAS Build | ~$0–$99/mo | Free tier handles early stage; paid tier for faster builds |

---

### 15 — Photo Schedule Import (Gemini 2.5 Flash) `CODE COMPLETE — needs your testing`

**Fix 2026-07-18 (found in Ace's onboarding test):** wide weekly-grid screenshots returned "No shifts were found" while tall list layouts worked. Root cause: the client downscale capped the *longest* side at 1600px, so a 2000×661 grid shrank to 1600×529 — crushing the text height (which lives in the short side) below what Gemini could read. `toJpeg` now scales by pixel *area* (small screenshots upload untouched; big photos shrink but never below ~720px on the short side), and the extraction prompt explicitly describes weekly-grid layouts (dates as column headers, multiple stacked week-tables, "No Shifts" cells). Re-test both orientations.

**Feedback loop 2026-07-18:** when the reader disappoints, the user can now send the exact processed photo to support@myshiftx.com with one tap — new `/api/schedule-import/report` route (auth-required, Resend email with the image attached, what the reader returned as JSON, and reply-to set to the user). Links appear in the "no shifts found" error banner and the review-step footer; explicit user action only, never automatic. 👤 Test: trigger a bad import, tap "Send this photo to our team", confirm the email lands in support@ with the attachment.

**Tier:** Free = 4 imports/month · Pro = unlimited
**Why it matters:** The single biggest UX unlock for Cast Members. Instead of manually entering each shift, they photograph their paper or screen schedule and MyShiftX reads it onto their calendar in seconds.

**Architecture overview:**
```
Browser → /api/schedule-import (Next.js) → Gemini 2.5 Flash (Google API) → parsed JSON → review UI → Supabase
```

Gemini reads the photo with a hand-tuned parsing prompt that isolates the target employee's row (the modal sends the user's display name), resolves year-less dates by day-of-week alignment, and returns explicit overnight `end_date`s. The route tries the free-tier `generativelanguage` endpoint first and falls back to the billing-gated Vertex `aiplatform` endpoint on 401/403 (Google issues look-alike `AQ.` keys for both surfaces). Photos are processed per-request and never stored. Whole feature is gated on `GEMINI_API_KEY` — invisible until the env var lands in Vercel, then flips on automatically (marketing on the landing page and the Help docs section are gated the same way).

**Final benchmark (2026-07-08):** 2/2 exact on a real scheduling-app screenshot (dates, times, titles) and 8/8 exact on a dense synthetic 2-week schedule incl. an overnight shift, 5–10s per image, ~1k tokens (~0.1¢ paid / $0 free tier).

---

**👤 You handle:**
- ✅ `2026-07-08`: Created Google AI Studio project + free-tier API key (in `.env.local` as `GEMINI_API_KEY`); wrote the parsing prompt the route now uses
- ✅ `2026-07-23`: Added `GEMINI_API_KEY` to Vercel env vars — free-tier key works; the paid Vertex key (project 126596084990) still needs API + billing enabled in its Cloud project if/when volume justifies it
- ✅ `2026-07-08`: Remove the retired `VPS_OLLAMA_URL` / `VPS_OLLAMA_SECRET` / `OLLAMA_VISION_MODEL` vars from Vercel
- ✅ `2026-07-08`: Delete the `ai.myshiftx.com` DNS A record; refund/repurpose the Contabo VPS (wiped clean 2026-07-08)

**🤖 Claude handles:**
- ✅ `schedule_import_count` + `schedule_import_month` columns on `users`, with `get_schedule_import_status()` / `consume_schedule_import()` `SECURITY DEFINER` RPCs that reset the counter lazily when the ET month rolls over — no cron changes needed (`supabase/migrations/20260701235216_schedule_import_quota.sql`)
- ✅ `/api/schedule-import/route.ts` — verifies auth, checks quota up front (consumed only after a successful parse so a backend hiccup doesn't burn an import), accepts multipart image upload (8 MB max, JPEG/PNG/WebP) + the user's display name, calls Gemini, extracts/validates the JSON (zod, AM/PM salvage), returns shifts + remaining count
- ✅ `ScheduleImportModal` — camera/file picker (client-side downscale + JPEG re-encode keeps HEIC/multi-MB photos out of the pipeline), photo shown above the editable review table, live any-overlap conflict detection against the selected board with keep/replace/edit resolution (replace uses the `deactivate_own_shift` RPC), overnight-shift handling, manual add-a-row, remaining-imports counter
- ✅ Import button wired into the Calendar page; landing-page selling-point section + Help page section/FAQ, all gated on `GEMINI_API_KEY`
- ✅ `2026-07-08`: **VPS backend evaluated and retired.** Full story in `schedule-from-image.md`: built Ollama + qwen2.5vl:3b on a Contabo VPS (nginx/TLS/secret-gated at ai.myshiftx.com), found and fixed a prompt bug (today-date anchoring caused models to extract only today's row) and an nginx 180s timeout that was killing production imports; benchmarked 3B/7B/granite — best case was still minutes-per-photo with unreliable extraction on app-screenshot layouts. Gemini 2.5 Flash scored perfectly in seconds, so the route moved to Gemini exclusively and the VPS was wiped (Ollama, nginx vhost, TLS cert removed; sshd hardened to key-only while it lived)

---

### 16 — In-App Push Notifications (Web Push) `CODE COMPLETE — needs Vercel env vars`

**Tier:** Free (Basic and Pro both get push)
**Why it matters:** Silent real-time alerts without SMS cost. Works on desktop and Android Chrome; limited on iOS Safari (supported since iOS 16.4 via PWA install).

**Architecture:** Browser Push API + VAPID keys. Next.js stores push subscriptions in Supabase. When a match or interest fires, the notification action also sends a web push to subscribed devices. Entire feature is gated on `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — all push UI stays hidden until the env vars land in Vercel, then flips on automatically.

**🤖 Claude handled:**
- ✅ `2026-07-01`: Generated VAPID key pair — in `.env.local`; **needs adding to Vercel** as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
- ✅ `2026-07-01`: `push_subscriptions` table created + applied live (RLS: users manage only their own rows; sending reads via service role). Migration: `20260702000000_push_subscriptions.sql`
- ✅ `2026-07-01`: `/api/push/subscribe` (upsert on `user_id,endpoint`) and `/api/push/unsubscribe` routes with zod validation
- ✅ `2026-07-01`: `public/sw.js` — shows notifications on `push` (graceful on non-JSON payloads), focuses/opens the target URL on click. Registered lazily from `lib/push.ts` only when a user enables push
- ✅ `2026-07-01`: `sendPushNotification()` in `notifications.ts` — fires alongside email for interest, both match directions, and board approval; prunes dead subscriptions (410/404). Deliberately *not* exported (exports from a `'use server'` file are client-callable — would let anyone push to anyone). Push is independent of the `notify_via_email` pref; that pref now only gates email
- ✅ `2026-07-01`: "Push Notifications" toggle in Profile → Notifications (per-device, instant, hidden on unsupported browsers) + one-time dismissible prompt banner on the Wall
- ✅ `2026-07-01`: `app/manifest.ts` web app manifest (`display: standalone`) — required for iOS 16.4+ push via Add to Home Screen
- ✅ `2026-07-01`: Verified end-to-end locally in Edge: subscribed against a real WNS push endpoint with the site VAPID key, sent via web-push, service worker displayed the notification (title/body/url/icon all correct); unauthenticated API calls → 401; wrong VAPID keys rejected by the push service

**👤 You handle:**
- ✅ `2026-07-01`: Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (values in `.env.local`) to Vercel env vars — the feature is invisible in production until then
- ✅ `2026-07-01`: Test on desktop Chrome, Android Chrome, and iOS Safari (requires "Add to Home Screen" first on iOS): enable via the Wall banner or Profile toggle, then have a second account mark interest on your post
- ✅ `2026-07-01`: Square 512×512 app icon supplied — moved to `app/apple-icon.png` (Next.js serves it and emits the `apple-touch-icon` link automatically); manifest and push notification icons now use it
- ✅ `2026-07-01`: Live two-device test found pushes *delivered* but not *popping up* (OS presentation settings, not code). Response: `requireInteraction: true` so desktop toasts stay until dismissed, `urgency: 'high'` on sends so dozing devices get them promptly, and a per-platform "Push Notifications" how-to (Windows / Mac / Android / iPhone) added to Help & Support

---

### 17 — Calendar Export & Sync (iCal / Google Calendar) ✅ CODE COMPLETE

**Tier:** Pro only
**Why:** Users want their shift calendar to live in their native calendar app, not just in MyShiftX. A live-sync iCal feed means it updates automatically when shifts change.

**Architecture:** Generate a secret per-user iCal feed URL. Calendar apps (Google Calendar, Apple Calendar, Outlook) subscribe to it and refresh periodically. No OAuth required — the URL is the authentication.

**🤖 Claude handled:**
- ✅ `2026-07-01`: `ical_token` column on `users` (UUID, unique, nullable, generated on first use). Because it's the feed's only credential, it's excluded from the client-readable SELECT column grant (same idiom as the membership fields) — access goes through two `SECURITY DEFINER` RPCs scoped to `auth.uid()`: `get_or_create_ical_token()` and `reset_ical_token()`, both returning NULL for Basic. Migration `20260702010000_ical_feed_token.sql`, applied live
- ✅ `2026-07-01`: `/api/calendar/[token].ics` route (token also accepted without `.ics`) — hand-rolled RFC 5545 generation in `lib/ical.ts` (UTC times, escaping, 75-octet line folding, 1-hour refresh hints). Serves active shifts from 30 days back through all upcoming — the same `user_id + is_active` definition My Calendar uses. Bad token, unknown token, deactivated account, and non-Pro membership all return a uniform 404
- ✅ `2026-07-01`: Token rotation via the `reset_ical_token()` RPC + server action (`app/actions/calendar.ts`) rather than a dedicated route — same behavior, matches the codebase's server-action convention
- ✅ `2026-07-01`: Calendar Sync card on Profile (Pro/Trial only): copyable feed URL with a treat-it-like-a-password note, link to the setup guides, one-click Download .ics (`?download=1` → attachment), and Reset feed URL behind a subscriptions-will-break confirmation
- ✅ `2026-07-01`: Step-by-step subscribe guides for Google Calendar, Apple Calendar (iPhone/Mac), and Outlook written into Help & Support (`/help#calendar-sync`); the Profile card links there
- ✅ `2026-07-01`: Verified live: real feed URL returns valid ICS with correct UTC event times, escaping, and folding (tested with a temporary shift, since deleted); all invalid-token paths 404; `ical_token` confirmed absent from client SELECT grants; roadmap card moved to Done

**👤 You handle:**
- ✅ Your feed token is already generated — open Profile → Calendar Sync for the URL. Test the subscription flow in Google Calendar (Other calendars → From URL) and Apple Calendar
- ✅ Heads-up for testing: Google refreshes subscribed feeds on its own schedule (often 6–24 h), so don't judge sync speed by it — Apple Calendar lets you pick the refresh interval

---

### 18 — Trade Preferences (Smart Matching) `WITH PRO LAUNCH`

**Tier:** Pro only
**Why:** Extends the shift matching system so Pro users only get notified for shifts that actually fit their preferences — reducing notification fatigue.

**🤖 Claude handles:**
- [ ] Add `trade_preferences` JSONB column to `users` (nullable):
  ```json
  {
    "preferred_types": ["trade", "giveaway"],
    "preferred_times": ["morning", "afternoon"],
    "preferred_days": [1, 2, 3, 4, 5]
  }
  ```
- [ ] Add Trade Preferences section to Profile → Notifications for Pro users:
  - Preferred shift types (Trade / Giveaway / Either)
  - Preferred time of day (Morning / Afternoon / Evening / Late Night / Any)
  - Preferred days of week (multi-select Mon–Sun)
- [ ] Update `notifyShiftPosted()` and `notifyRequestPosted()` — before sending match notifications, check if the recipient has trade preferences set and whether the shift/request satisfies them. If preferences are set and the match doesn't fit, skip the notification.

---

### 19 — In-App Messaging (Within Boards — All Tiers) ✅ CODE COMPLETE

**Tier:** Free and Pro — available to all users, within shared boards only. Direct messaging outside of boards is not permitted.
**Why:** Replaces the current email mailto: contact button with a real in-app conversation thread. Keeps communication on the platform and creates network stickiness.

**🤖 Claude handled:**
- ✅ `2026-07-02`: `conversations`, `conversation_participants`, `messages` tables created + applied live. Migration `20260702120000_in_app_messaging.sql`. RLS: participants can only read conversations/messages they belong to; only the sender can insert their own messages (`sender_id = auth.uid()` enforced); `last_read_at` is the *only* updatable participant column (column-level grant, so a row can't be moved to another conversation/user)
- ✅ `2026-07-02`: Conversations are created only through the `get_or_create_conversation()` RPC (`SECURITY DEFINER`) — verifies the other user is active, not yourself, and that both users share ≥1 approved board ("You can only message members of your boards."); idempotent (same pair always returns the same thread, advisory-locked against double-click races). No INSERT policies exist for `authenticated`, so the RPC is the only door in
- ✅ `2026-07-02`: `messages` added to the `supabase_realtime` publication — postgres_changes respects RLS, so subscribers only receive messages from their own conversations
- ✅ `2026-07-02`: `/messages` page — conversation list (via `get_conversations()` RPC: other participant, last-message preview, unread count) with unread badges, newest activity first, live-refreshes on incoming messages
- ✅ `2026-07-02`: `/messages/[conversationId]` page — chat-bubble thread with Realtime append, send box (max 1000 chars, Enter to send), marks read on open and on incoming messages, `router.refresh()` so the navbar badge clears immediately
- ✅ `2026-07-02`: Unread badge in Navbar via `get_unread_message_count()` RPC — Messages tab added to the desktop sub-nav and the mobile bottom nav (Wall · Calendar · Messages), both with count badges
- ✅ `2026-07-02`: Disabled "Contact — coming soon" replaced with a working **Message** action on both ShiftCard and RequestCard (⋮ menu + pill row) — opens or creates the thread with the post owner; disabled for posts whose owner account is gone
- ✅ `2026-07-02`: Web push on new message ("New message from X" + preview, links to the thread) — `sendPushNotification()` moved from `notifications.ts` into shared `lib/push-server.ts` (still not client-callable) so both notification actions and messaging use it
- ✅ `2026-07-02`: Verified with role-impersonated SQL against the live DB (10/10 pass): shared-board rule enforced, outsider sees 0 rows, sender spoofing blocked by RLS, unread counts correct before/after mark-read, participant-row move blocked by column grant, conversation creation idempotent. `npm run build` + type-check clean; test data cleaned up

**🤖 Follow-up round (same day, from live testing feedback):**
- ✅ `2026-07-02`: **Read receipts** — own messages show an eye (read) / crossed-out eye (not read yet) in front of the timestamp, based on the other participant's `last_read_at`; updates live while the thread is open (`conversation_participants` added to the Realtime publication). Migration `20260702130000_message_reactions_read_receipts.sql`, applied live
- ✅ `2026-07-02`: **Reactions** — one per message, recipient-only (can't react to your own): 👍 😂 😮 😢 😠 + the site's yellow star. An empty yellow star sits right of the other person's bubble (vertically centered); clicking it opens a popup bar under the star with the six options; the choice replaces the star and can be tapped again to swap. Enforced in the DB: `reaction` column with CHECK constraint, UPDATE policy limited to non-senders, column-level grant so *only* `reaction` is updatable (body/sender/timestamps immutable). Optimistic UI with rollback; syncs to the other side via Realtime UPDATE events
- ✅ `2026-07-02`: **Message hygiene** — bodies are sanitized server-side (control characters stripped, 3+ blank lines collapsed, trimmed, 1000-char cap) and always rendered as plain text (React escaping — `<script>` etc. stays inert text; there is no HTML rendering path). Reaction values validated server-side against the allowed list on top of the DB constraint
- ✅ `2026-07-02`: **Ads on Messages** — `/messages` and `/messages/[id]` added to the AdRail page list (same sticky desktop rail + mobile bottom bar as Wall/Calendar; Pro/Trial still ad-free)
- ✅ `2026-07-02`: **Stale-thread bug fixed** — opening a chat from the list could show an outdated (even empty) thread because Next's client-side router cache re-serves a prior render for up to ~30s. Both the list and the thread now re-fetch fresh data from Supabase on mount, treating server-rendered props as a starting point only
- ✅ `2026-07-02`: **Start a chat** — button on `/messages` opens a directory modal of everyone sharing an approved board with you (`get_messageable_users()` RPC, active users only) with a name search filter; picking someone opens/creates the thread
- ✅ `2026-07-02`: Reaction rules verified with role-impersonated SQL against the live DB (7/7 pass): recipient can react + replace, sender gets 0 rows on own message, invalid value hits the CHECK constraint, body edit hits column permissions, outsider gets 0 rows, directory returns board-mates only. Sanitizer unit-tested (NUL/ESC/DEL/CR stripped, `\n`/`\t` kept); build + type-check clean
- ✅ `2026-07-02`: **Chat delete** — trash icon on each row in `/messages` (with confirmation). Per-user semantics like WhatsApp: sets `hidden_at` on *your* participant row only — the other person keeps the full conversation; your list entry disappears, your view of the history is cleared, and a newer message from either side brings the chat back showing only messages after that point. Nothing is ever removed from the `messages` table. Unread counts and previews respect `hidden_at`. Migration `20260702140000_conversation_delete.sql`, applied live; verified with impersonated SQL (hidden → unlisted + 0 unread; reappears with only the new message; other participant unaffected)
- ✅ `2026-07-02`: **Polish round from live testing:** (1) reaction picker is now portalled + viewport-clamped so it never gets cut off at the screen edge on short messages; (2) unread dot (same style as the approvals/flags dot) added to the desktop Messages tab icon alongside the count badges; (3) read receipts + unread badge now update *instantly* while both users have the chat open — marking read fires a Realtime **broadcast** to the other side (with the postgres_changes participant subscription kept as fallback) and `router.refresh()` keeps the navbar badge live; (4) Start-a-chat gained a board filter dropdown above the search (checkbox multi-select with an "All boards" master; hidden when the user has only one board); the directory RPC now returns `board_ids` and excludes `is_hidden` memberships on both sides, so auto-added admins only appear on boards they joined explicitly (verified: hidden admin absent from Halle's directory, present where explicitly joined) — migration `20260702150000_directory_boards_filter.sql`, applied live; (5) app-wide `MessageToast` (mounted in the dashboard layout): a new message while not viewing that thread shows a 5-second bottom toast with sender + preview that links to the chat, and refreshes the navbar badge live
- ✅ `2026-07-02`: **Live-receipt reliability + chat management round:** (1) Root-caused the "seen/badge still needs a refresh" report — Realtime's replication pipeline picks up newly published tables lazily, and the logs show `conversation_participants` was only registered ("Found new oids") after the earlier tests; belt-and-braces fix: an open thread now also polls every 4 s (tab-visible only, incremental — participants row + only messages newer than the last one held) so new messages and read receipts converge within seconds even if realtime drops events entirely; (2) chat header gained a ⋮ menu with **Flag User** (reuses `FlagModal` with `target_type='user'`, lands in the admin/mod flag queue; modal copy now adapts to the target type instead of always saying "Report Post") and **Delete Chat** (same per-user semantics as the list delete, returns to `/messages`); (3) **Terms** Section 5 gained a Direct Messaging conduct clause (professional use, no profanity/offensive language/harassment/spam; misuse → suspension/removal; MyShiftX may review messages when investigating flags) and Section 7 now covers messages as User Content; (4) **Privacy** Section 2 and Section 5 updated: messages/reactions/read-status listed as collected data, message visibility spelled out (participants only, not moderators; reviewable on abuse reports), per-user delete semantics disclosed, and the stale "Contact button email" bullet replaced; (5) **Help & Support**: stale Contact FAQ rewritten for in-app messaging, two new FAQs (who can message / how deletion works), and a dedicated Messages section (`/help#messages`) covering starting chats, read receipts, reactions, notifications, delete semantics, and a keep-it-professional note linking to the Terms and the Flag User path
- ✅ `2026-07-02`: **Testing incident (disclosed):** two of the SQL verification runs used `get_or_create_conversation` between the real Ace and Ace-User B accounts, which returned their *existing* live thread instead of creating a fresh one — the cleanup step then hard-deleted that conversation, including a few real messages from live testing. Unrecoverable. The Ace-Admin ↔ Halle N. conversation was untouched. Later verification runs build throwaway conversations directly and never call `get_or_create_conversation` on real user pairs

**👤 You handle:**
- ✅ `2026-07-02`: Two-account smoke test in the browser: from account A open the ⋮ menu on one of B's posts → **Message** → send; confirm B sees the navbar badge, the thread updates live in a second window, and a "New message from…" push arrives on a push-enabled device
- ✅ `2026-07-02`: In that same test: watch your sent message flip from crossed-out eye → eye when B opens the thread; as B, react to A's message (star → picker → emoji) and confirm A sees the reaction appear live
- ✅ `2026-07-02`: Try **Start a chat** — search for a board-mate by name and confirm the thread opens
- ✅ `2026-07-02`: Try **Delete chat** (trash icon on a row): confirm it disappears for you but not the other account, and that a new message from them brings it back without the old history
- ✅ `2026-07-02`: Confirm messaging someone after leaving your only shared board is blocked (expected: "You can only message members of your boards.")

---

### 20 — Bulk Shift Import (CSV + Multi-Week Photo) `YEAR 1 POST-LAUNCH`

**Tier:** Pro only — extends Task 15 (Photo Import)
**Why:** Power users with multi-week schedules don't want to import one photo at a time. CSV gives IT-minded users a clean path; multi-photo handles paper schedules.

**🤖 Claude handles:**

**CSV import:**
- [ ] Create a CSV template for download: `date, start_time, end_time, title, type`
- [ ] Build CSV upload UI — parse client-side with PapaParse, show preview table, validate each row (past dates, valid times, required fields), then bulk-insert approved rows
- [ ] Handle errors gracefully: flag individual bad rows and let user fix or skip before importing

**Multi-week photo import:**
- [ ] Allow uploading up to 4 photos in a single import session (one per schedule week)
- [ ] Batch the images to Ollama sequentially — collect all returned shifts, deduplicate by date, then show a unified review table
- [ ] Add a "This is a multi-week schedule" toggle to the import modal (Task 15) that enables multi-photo mode for Pro users

---

### 21 — Trade Loop: Claims, Confirmation & Reliability `CODE COMPLETE — needs your testing`

**Tier:** All tiers (this is core product, not a perk)
**Why:** The README names ghosting as a core problem, but nothing in the app addresses it — interest is just a comment flag, contact ends in email, and the app never learns whether a trade actually happened. Closing the loop unlocks: (1) a per-user reliability record (the real answer to ghosting), (2) the marketing proof number ("N shifts covered on MyShiftX"), and (3) the "your shift got covered 🎉" retention moment.

**Lifecycle:** claimant taps **"I'll take this shift"** → owner **Accepts** (post auto-archives as "Covered") or **Declines** → after the handshake, owner marks the claim **Completed** (trade went through in the company system) or **Fell through**. Claimant can withdraw a pending claim.

**🤖 Claude handled (all shipped 2026-07-18; migration applied to production):**
- ✅ Migration `20260717150000_trade_loop_shift_claims.sql` — `shift_claims` table (`id, shift_id, claimant_id, owner_id, board_id, status, created_at, responded_at, finalized_at`) + partial unique indexes (one open claim per user per shift; one accepted claim per shift) + RLS (parties-only SELECT; all writes via RPCs; anon revoked)
- ✅ RPCs (SECURITY DEFINER, pinned search_path, authenticated-only): `claim_shift` (validates board membership, active post, not-own-shift), `respond_to_claim` (accept auto-declines rivals + archives post as `covered`, returns rival ids for notification), `withdraw_claim`, `finalize_claim`
- ✅ `get_trade_stats_for_users(uuid[])` — aggregate picked-up/covered/fell-through counts only, no claim details leaked
- ✅ `removed_reason` CHECK extended with `'covered'`; leader Archive shows a green "Covered 🤝" badge + filter chip
- ✅ TypeScript types (`ClaimStatus`, `shift_claims`, RPC signatures) in `lib/database.types.ts`
- ✅ `app/actions/claims.ts` — claimShift / respondToClaim / withdrawClaim / finalizeClaim, notifications fire-and-forget
- ✅ Notifications: owner push+email on new claim (`claimReceivedHtml`); claimant push+email on accept/decline (`claimResultHtml`); rivals get "shift covered" push; claimant push on finalize. Emails respect `notify_via_email`
- ✅ `ClaimSection.tsx` on ShiftCard: "I'll take this shift" for non-owners (sent/declined states, withdraw); Accept/Decline panel for owners with each claimant's reliability record inline
- ✅ Reliability badge (🤝 N completed trades) next to poster name on ShiftCard, batch-fetched in WallClient
- ✅ `TradeRecordSection.tsx` on Profile (`#trade-record`): stats tiles, "needs your attention" (confirm completed/fell-through as owner, withdraw as claimant), history
- ✅ Wall banner for owners with accepted claims past shift end → links to Profile Trade Record
- Verified: `tsc --noEmit` clean, ESLint clean, `next build` passes, RPCs confirmed live in prod, security advisor shows no new issues (pre-existing anon-executable functions flagged as a separate cleanup task)
- [ ] Follow-up (post-v1): public `get_platform_trade_stats()` for the landing-page proof number; claims on request posts; mod visibility into board claim disputes; realtime on `shift_claims` for live claim updates

**👤 You handle:**
- [ ] Test the full loop with two accounts: claim → accept → complete, plus decline / withdraw / fell-through paths
- [ ] (Optional) Enable Realtime replication for `shift_claims` in Supabase dashboard if we want live claim updates without refresh

---

### 22 — Schedule-First Onboarding & Weekly Digest (Cold-Start Fix) `CODE COMPLETE — needs your testing`

**Tier:** All tiers
**Why:** A new user's wall is empty until their board has density — but the photo schedule import (Task 15) makes the app useful **solo on day one** as a schedule keeper. Put it in the first-session flow instead of buried in the calendar. A weekly digest resurfaces quiet boards instead of letting them die silently.

**🤖 Claude handled (all shipped 2026-07-18; migration applied to production):**
- ✅ Migration `20260718100000_onboarding_and_weekly_digest.sql` — `users.notify_weekly_digest` (default true) + `users.onboarding_dismissed_at`; types updated
- ✅ `/welcome` wizard (`app/(dashboard)/welcome/`): Step 1 photo schedule import (embeds the Task 15 `ScheduleImportModal`; falls back to manual-calendar link when `GEMINI_API_KEY` is unset, matching the env-gate pattern), Step 2 join/create board (embeds `MyBoardsSection` — full invite-code flow), Step 3 push notifications (`PushNotificationsToggle`). Steps show live done-states (counts refresh on focus/modal close); "Take me to the Wall" / "Skip for now" both set `onboarding_dismissed_at`
- ✅ Routing: the Wall server page redirects brand-new users (no boards + no shifts + never dismissed) to `/welcome`; completing either step or skipping ends the redirect — covers email, OAuth, and returning-login paths without touching auth flows
- ✅ Empty-wall states for no-board users now point at `/welcome` ("Get Set Up") instead of the profile page
- ✅ Weekly digest: new `/api/cron/weekly-digest` (CRON_SECRET-protected, same pattern as expirations) — pulls posts created in the last 7 days that are still live, aggregates per user across their approved boards, excludes their own posts, skips users with nothing new, caps at 6 items per email. `weeklyDigestHtml` template added
- ✅ One-click unsubscribe: `/api/digest/unsubscribe?uid&sig` — HMAC-signed (keyed with CRON_SECRET, `lib/digest.ts`), no login needed, flips only `notify_weekly_digest`
- ✅ Profile → Notifications: "Weekly Digest" toggle, saved with the existing Save button
- ✅ `vercel.json`: digest cron scheduled `0 22 * * 0` (Sunday 22:00 UTC ≈ 6 PM ET during daylight time)
- Verified: `tsc` clean, ESLint clean, `next build` passes with `/welcome` + both API routes registered

**Onboarding v2 (2026-07-18, after Ace's first-user test):**
- ✅ **Bug fix (was "Failed to load profile"):** the Task 6 membership lockdown replaced the table-wide SELECT on `users` with an explicit column list, so the two new Task 22 columns had no SELECT grant — any new-code page selecting them (Profile, Wall) failed with permission denied. Fixed + applied: `20260718140000_grant_select_onboarding_columns.sql`. **Rule for future migrations: every new `users` column that clients read needs an explicit `GRANT SELECT`.**
- ✅ **Registration collects First + Last Name** — passed as `given_name`/`family_name` metadata (same keys Google OAuth sends), so the existing `handle_new_user` trigger derives the site display name ("First L.") with zero schema changes; `full_name` fills the Supabase auth Display Name. Live preview under the fields shows exactly what boards will see. Names restricted to letters/spaces/hyphens so the derived name always passes `displayNameRegex`.
- ✅ **Welcome is 3 easy steps (v3):** (1) join/create board, (2) schedule import ("works even while your join request is pending"), (3) push notifications. No display-name step — registration guarantees the name now, so the display-name gatekeeping was removed everywhere (welcome, Profile's create-board button, and the `displayNameReady` prop deleted from `MyBoardsSection`). Completed steps swap their number for the site-wide yellow star (`#ffea80`, same as the interest star — Nordic theme override applies automatically), so a QR-invited registrant effectively sees 2 steps.
- ✅ **Invite code carries through registration:** the QR/share link already lands on `/register?redirect=/boards/slug?c=CODE`; the register page now extracts the code (also accepts a direct `?code=`), shows an "invite detected" banner, and stores it in signup metadata + localStorage. `/welcome` redeems it once on first load — auto-sends the join request via the existing `lookupBoardByCode`/`confirmJoinBoard` actions, shows "request sent to <board>", then clears the code from both stores.
- ✅ `next.config.mjs`: `NEXT_DIST_DIR` override so verification builds can run beside `next dev` without corrupting `.next` (the recurring random `PageNotFoundError` build flake)
- ✅ **Pending members can build their calendar (v3, found in Ace's onboarding test):** schedule import + manual shift adds failed for users whose join request was still awaiting approval (both flows listed approved boards only, and the shifts INSERT policy required approved membership). Fixed end to end — migration `20260718160000_pending_member_calendar_shifts.sql` (applied to prod): INSERT policy now accepts pending-member boards (+ personal `board_id NULL` shifts), and a new `enforce_wall_post_membership` trigger blocks trade/giveaway flags on boards the user isn't approved in (insert AND later flag-flips; cron/service-role safe). Import modal + PostShiftForm list pending boards with "(pending approval)" labels, lock the Post-to-Wall section with an explainer, force wall flags off client-side, and match alerts now fire only for actual wall posts. Wall empty state for unapproved users says posts appear after leader approval, with a Join-or-Create button → `/profile#my-boards`.

**👤 You handle:**
- [ ] Re-test the new-user flow end to end: register with first/last name → verify → land on /welcome with display name pre-filled → join or create a board (should work now that the grants bug is fixed)
- [ ] Test the QR path: scan a board QR while logged out → register → confirm the join request fires automatically on /welcome
- [ ] Confirm digest day/time — currently Sunday 22:00 UTC; edit `vercel.json` to change
- [ ] Test the digest manually once there's recent activity: `curl -H "Authorization: Bearer $CRON_SECRET" https://myshiftx.com/api/cron/weekly-digest`, then click the unsubscribe link in the email and confirm the profile toggle flips off

---

### 23 — iOS Push via Add-to-Home-Screen Flow `CODE COMPLETE — needs your iPhone testing`

**Tier:** Free (extends Task 16 web push)
**Why:** In a first-come marketplace, notification latency is the product. Since iOS 16.4, web push **works** on iPhone for PWAs added to the home screen — the "no iOS push" note in Task 16 was outdated. A guided install flow unlocks real-time alerts for the biggest platform now, years before the Task 14 native app.

**🤖 Claude handled (shipped 2026-07-18):**
- ✅ Detection helpers in `lib/push.ts`: `isIOS()` (incl. iPadOS-masquerading-as-Mac), `isStandalone()`, `needsIosInstallForPush()`, `isIosSafari()`
- ✅ `IosInstallPrompt` component — numbered walkthrough (Share → Add to Home Screen → open from Home Screen and allow notifications), with an extra "open in Safari first" step when browsing from Chrome/Firefox/Edge on iOS. Appears **only** in iOS browser tabs where the Push API is absent
- ✅ Placements: dismissible banner on the Wall (localStorage-persisted, same pattern as PushPromptBanner) + always-visible inline versions in Welcome step 3 and Profile → Notifications (both spots where the push toggle silently hides itself on iOS)
- ✅ Installed/standalone mode needs nothing new: once opened from the Home Screen the Push API exists, so the existing Task 16 prompts take over automatically
- ✅ Manifest verified already correct (`display: standalone`, 512px icon, apple-touch-icon via `app/apple-icon.png`) — no changes needed
- ✅ Help page + Task 16 note updated to reflect iOS 16.4+ support and the in-app walkthrough
- Verified: `tsc` clean, ESLint clean, `next build` passes

**👤 You handle:**
- [ ] Test on a real iPhone (iOS 16.4+): browse the Wall in Safari → walkthrough banner appears → install → open from Home Screen → enable push → have your second account claim one of your shifts and confirm the push arrives
- [ ] Also glance at the walkthrough from Chrome on iOS — it should add the "open in Safari" step

---

### 24 — Product Analytics & Error Tracking `NEEDS DISCUSSION`

**Why (plain English):** Right now the app has no way to answer questions like "how many people who register actually join a board?", "which upgrade nudge do people click?", or "did anyone hit a crash last night?". Analytics = anonymous event counters that answer the first two; error tracking = automatic crash reports that answer the third. Without them, every pricing/paywall/ad decision in Tasks 7–12 is a guess. Both have free tiers (PostHog, Sentry) and take ~a day to wire in.

**Status:** Ace wants more clarification before green-lighting — discuss before starting. Questions to resolve: which tool(s), what events to track, cookie-consent interaction with the existing CMP setup.

---

## Optional Improvements (Code Scan 2026-07-18)

Full report: [docs/code-scan-2026-07-18.md](docs/code-scan-2026-07-18.md). Serious findings were fixed same-day (email HTML injection, stale createBoard display-name gate, transparent-PNG black-canvas bug, hot-path index gaps — see report). These are the non-urgent leftovers, ordered roughly by value; tackle one at a time.

**Database (Supabase performance advisor):**
- [x] ✅ `2026-07-19` Wrap `auth.uid()` as `(select auth.uid())` in the 27 RLS policies flagged `auth_rls_initplan` — done via `20260719120000_rls_initplan_auth_wrap.sql` (ALTER POLICY only, expressions otherwise verbatim from pg_policies; all 34 `auth.uid()`/`auth.role()` calls wrapped). Advisor re-run confirms 0 findings remain. Smoke-test the app normally — behavior should be identical, just faster on large scans
- [x] ✅ `2026-07-19` Consolidate overlapping permissive RLS policies (48 findings) — done via `20260719140000_consolidate_permissive_policies.sql`: merged each action's policies into one with the original expressions OR'd verbatim (comments UPDATE 2→1, requests SELECT 3→1 + UPDATE 2→1, shifts SELECT 4→1 + UPDATE 2→1, user_boards SELECT 4→1 + DELETE 2→1, users UPDATE 3→1), and scoped everything TO authenticated (all expressions are anon-impossible). Verified: exactly 1 policy per table+action, advisor re-run shows 0 findings. 👤 Smoke-test the moderation flows (flag resolution, member role changes, board approvals) plus normal wall/profile use — semantics are preserved by construction, but these paths exercise the merged policies hardest
- [x] ✅ `2026-07-19` Add covering indexes for the 9 remaining unindexed FKs — `20260719150000_remaining_fk_indexes.sql`, applied to prod; advisor's unindexed_foreign_keys findings now fully cleared
- [x] ✅ `2026-07-19` Revoke anon EXECUTE on SECURITY DEFINER functions — `20260719151000_function_execute_lockdown.sql`. Root cause found: Task 6's revoke never held because PUBLIC retained EXECUTE (functions default to EXECUTE TO PUBLIC). Now grouped properly: trigger-only fns callable by no one, cron fns service-role-only, user RPCs authenticated-only. Verified: anon-executable 32 → 10, and the 10 are deliberate RLS-predicate exceptions (revoking those would make TO-public policies *error* for anon instead of returning empty — documented in the migration)
- [ ] 👤 Enable Leaked Password Protection (Supabase dashboard → Authentication → Policies) — open since Task 6

**Application:**
- [x] ✅ `2026-07-19` Rate-limit `/api/schedule-import/report` — 3 reports per 10 min per user (in-memory per warm instance; blunts rapid-fire spam, documented serverless caveat). Post/comment/flag write paths remain covered by the Ongoing-table rate-limiting item for post-launch
- [x] ✅ `2026-07-19` Closed the OAuth loophole: `lib/registration.ts` centralizes the `REGISTRATION_PAUSED` flag (was duplicated inline in the register page); `app/auth/callback/route.ts` now detects a brand-new account (`created_at` ≈ `last_sign_in_at`, the standard "first-ever session" signal) and, while paused, signs it back out and bounces to `/register?oauth_blocked=1` instead of granting a session — same as the email flow. Note: the DB account itself still gets created by the `handle_new_user` trigger before this check runs (Supabase creates it during the code exchange) — this closes *session access*, not row creation; the account is otherwise inert (Guest role → redirected to `/verify-email` with no real access, per `app/(dashboard)/layout.tsx`). Register page shows a specific "sign-in with Google/Facebook/LinkedIn is paused too" message when bounced this way
- [x] ✅ `2026-07-19` Extracted duplicated board-list fetch → `lib/boards.ts` `fetchMyBoards()` (used by ScheduleImportModal + PostShiftForm)
- [x] ✅ `2026-07-19` Extracted shared service-role client → `lib/supabase/admin.ts` `createAdminClient()`, and sender/support constants → `lib/email-constants.ts` (notifications, both crons, digest unsubscribe, report route, help action all updated; the plain `noreply@` senders unified to the branded one)
- [x] ✅ `2026-07-19` Wall realtime: shifts/requests channels now filtered to the user's boards (`board_id=in.(…)`), and `loadClaimData` debounced 300ms. Known trade-off (commented in code): filtered DELETE events don't fire, so hard-deleted rows (board-deletion cascade) linger until refresh — soft removals are UPDATEs and stay live
- [ ] Weekly digest at scale: chunk the members/posts query and batch Resend sends — deferred by design until membership passes a few hundred
- [x] ✅ `2026-07-19` Removed dead exports `notificationHtml` / `betaClosingHtml` (git history keeps them)
- [x] ~~`beta_survey_responses` INSERT `WITH CHECK (true)`~~ — reviewed: intentional (anonymous survey), accepted

---

## Vernacular (2026-07-18)

Board role **"Leader" now displays as "Admin"**; global role **"Admin" now displays as "Overlord"**. Display-layer only — DB values, RLS policies, route paths (`/leader/*`, `/admin`), and code comparisons still use `Leader`/`Admin`. The label maps live in `lib/roles.ts`; all user-facing prose (dialogs, empty states, pending-approval notes, archive labels, help copy, nav labels) was updated to match. README documents the stored-vs-displayed mapping.

---

## 🔒 Security & Stability Fixes — Audit of 2026-07-27

**The full checklist lives in `MyShiftX/TASKS.md`** under this same heading. It is kept in one place on purpose — 15 of the 17 issues exist in both apps, and maintaining two copies would guarantee they drift apart. Work items are numbered **S1–S15** there.

### 🗄️ ACTION REQUIRED — run two SQL files on this project's database

Claude can reach MyShiftX's Supabase directly but not this one, so these are run by hand. Both sit in the repo root:

1. **`APPLY_TO_DATABASE_STEP1.sql`** — ✅ **safe to run right now**, even with the site live. Nothing is dropped, no data changes, no page breaks. Open Supabase → SQL Editor → paste → Run. The last query prints PASS/FAIL per fix.
2. **`APPLY_TO_DATABASE_STEP2_AFTER_DEPLOY.sql`** — ⛔ **do NOT run yet.** It removes the app's direct access to invite codes and **will break every board page** until the new app code is deployed. That code is still to be written. The file's header has a three-item checklist and a one-line undo.

Both files record themselves so a later `supabase db push` won't re-run them. Both verification blocks were dry-run against MyShiftX first to confirm they're real checks, not ones that always pass.

### Progress on this repo

| # | Status | Commit |
|---|---|---|
| S1 — fake emails/alerts 🔴 | ✅ **DONE 2026-07-27 02:14** (fixed here first) | `0b73827` |
| S15 — silent notification failures | ✅ **DONE 2026-07-27 02:14** (shipped with S1) | `0b73827` |
| S2 — import quota bypass 🟠 | ✅ code **DONE 2026-07-27 02:41** · ⏳ needs STEP1 SQL | `8e5d008` |
| S11 — memory/timeout | ✅ **DONE 2026-07-27 02:41** (shipped with S2) | `8e5d008` |
| S3 — guessable invite codes 🟠 | ✅ **DONE 2026-07-27 02:52** · existing codes left alone per your call | `a361be7` |
| S4 — trade stats exposure 🟠 | ✅ code **DONE 2026-07-27 03:01** · ⏳ needs STEP1 SQL | `3234c39` |
| S5 — inert REVOKE 🟡 | ✅ **DONE 2026-07-27 03:05** · ⏳ needs STEP1 SQL · *originated in this repo* | `440e3b7` |
| S7 — claim-count scoping 🟡 | ✅ **DONE 2026-07-27 03:05** · ⏳ needs STEP1 SQL | `440e3b7` |
| S8 — invite code leak 🟠 | ⚠️ **half done** — DB function ready; app code + STEP2 SQL still to do | `440e3b7` |
| SQL files for this database | ✅ **DONE 2026-07-27 03:22** | `6ae7247` |
| S6 | ❌ **N/A here** — no billing in this fork | — |
| S9, S10, S12, S13, S14 | ⏳ not started | — |
| **S16** *(new — found while fixing S8)* | ⏳ not started — see below | — |

**🟠 S16 — NEW. Anyone can join any board's approval queue without an invite code.**
Found while fixing S8. The database rule for creating a membership only checks "is this row yours?" — never the invite code, never which board. So any verified account can insert itself as *pending* on any board it can name, and the board page hands non-members that board's id. It was step one of the invite-code leak (now blocked at step two), and on its own it lets someone flood a board's approval queue with junk. Fix is to route joining through a function that checks the code and drop the direct insert permission.

**What's different for WDWShiftX specifically:**

- **S1 (fake emails/alerts) is MORE serious here, and should be fixed here first.** MyShiftX's Pro tier limits how many people a forged match email can reach; that limit was removed with billing here, so a forged email reaches everyone. Combined with every user being a real coworker at one employer, a fake internal-looking message is considerably more convincing.
- **S3 (guessable invite codes) is much less urgent here.** Board creation is disabled, so nobody can generate samples to study the pattern. But the two existing board codes were still made the old way and are worth rotating during a quiet period.
- **S6 (Stripe event ordering) does NOT apply here** — billing was removed, the webhook doesn't exist.
- **S5 (the database lock-down that never took effect) originated in this repo**, in `supabase/migrations/20260726120000_shift_bundles.sql`. It was copied into MyShiftX during the feature backport. Both need fixing.

**⚠️ Blocker for the database-side fixes here (S4, S5, S7, S8):** Claude can read and modify MyShiftX's Supabase project directly, but this project (`knzbsitknjozjhramlju`) is on a different Supabase account it cannot reach. Either add it to the same account/token, or run the SQL manually from commands Claude provides. Code-side fixes are unaffected.

---

## Ongoing / Maintenance

| Task | Who | Notes |
|------|-----|-------|
| Cross-browser testing (Safari, Chrome, Firefox, Edge) | 👤 You | Especially test on iOS Safari — it has the most quirks |
| Security audit (RLS policies, input sanitization) | 🤖 Claude | Run `/code-review ultra` on the branch when you're ready |
| Accessibility audit (WCAG 2.1 AA) | 🤖 Claude | Can audit and fix after core features are stable |
| Rate limiting on post/flag endpoints | 🤖 Claude | Add after real users are on the platform |
| User acceptance testing with a pilot group | 👤 You | Pick 5–10 coworkers to test before wider rollout |
| Dependency vulnerabilities (`npm audit`, 2026-07-22) | 🤖 Claude | 20 findings, none in shipped runtime code. Safe now via `npm audit fix` (non-breaking): `picomatch` (high, ReDoS in glob matching — jest/chokidar dev-time only), `yaml` (moderate, stack overflow on deep nesting). Needs a breaking bump + regression testing later: Next.js 14→16 (fixes a `postcss` XSS chain), Supabase CLI bump (fixes a critical `tar` path-traversal chain, dev-tooling only, not shipped). Same lockfile as MyShiftX — fix once, apply to both. |

---

## Deferred / Dropped

| Item | Reason |
|------|--------|
| Proficiency system (Property → Location → Role hierarchy) | Replaced by the Boards system — boards serve this purpose more flexibly |
| Multi-language support (Spanish) | Good idea, defer until user base justifies it |
| PWA offline capability | Nice-to-have, not needed for core use |
| Analytics dashboard for Leaders | Defer until post-launch |
| Automated DB backups | Supabase handles this automatically on paid plans |
| Unit tests | Defer until the feature set stabilizes |
| Facebook OAuth | Lower priority for this audience; add if users request it |
