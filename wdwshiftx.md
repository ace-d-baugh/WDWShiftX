# WDW ShiftX — Migration Plan & Todo List

Private fork of MyShiftX for internal use only: DSA VIP Tour Guides (~225 people) and the VIP Valet team (~30 people). No ads, no Pro tier, no billing — just the Basic feature set plus always-on Live Wall instant updates, locked to two pre-seeded boards with self-serve board creation disabled.

Researched against the current `dev` branch of MyShiftX on 2026-07-21. File paths/line numbers below will drift as the codebase changes — re-grep before acting on anything that looks stale.

---

## 1. Clone vs. rebuild — recommendation

**Clone the repo.** Don't rebuild from scratch.

Reasons:
- The feature set you want (Basic tier + instant Live Wall) already exists in the code today — it's a subtraction job (remove ads, remove Stripe, remove Pro gates), not a from-scratch build.
- The gating is unusually well-centralized for exactly this kind of surgery: ads gate on one env var (`NEXT_PUBLIC_ADSENSE_PUBLISHER_ID`), Stripe gates on two (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`), and every Pro-only feature funnels through one function (`isProTier()` in [lib/auth/session.ts](lib/auth/session.ts)) — the same "hide behind an unset env var" pattern used for every unfinished feature in this codebase.
- Board creation/joining is a single file ([app/actions/boards.ts](app/actions/boards.ts)) plus one shared UI component ([components/features/MyBoardsSection.tsx](components/features/MyBoardsSection.tsx)) — small surface to lock down.

**Structure: a hard fork, not a shared branch.** Do not try to keep WDW ShiftX as a long-lived branch of the same repo that you periodically rebase onto `main`. You're permanently *removing* things (ads, Stripe, upgrade flows) that MyShiftX's `main` will keep adding to — every future merge would re-introduce code you deleted. Instead:

1. Create a new **separate GitHub repo** (`wdwshiftx`, private), copied from the current MyShiftX codebase with full git history preserved (`git clone`, then re-point `origin`).
2. Treat it as independent going forward. If you build something generically useful in one, cherry-pick the specific commit into the other by hand — don't try to keep them in sync automatically.
3. Separate Supabase project (separate database, auth users, storage). Separate Vercel project. Separate domain (`wdwshiftx.com`, which you already own).

This gives you full data isolation (tour guide PII and shift data never touches the myshiftx.com production database), independent scaling/limits, and freedom to change anything without worrying about breaking paying customers.

---

## 2. Target feature set

| Feature | MyShiftX Basic | MyShiftX Pro | **WDW ShiftX** |
|---|---|---|---|
| Shift boards, offers & requests | ✅ | ✅ | ✅ |
| Mark interest & comment | ✅ | ✅ | ✅ |
| Private messaging | ✅ | ✅ | ✅ |
| Push notifications | ✅ | ✅ | ✅ |
| Photo Schedule Import | 4/month | Unlimited | 4/month (keep Basic limit — revisit if it's annoying) |
| Ads | Ad-supported | None | **None — ad code removed entirely** |
| Live Wall instant updates | ❌ (polling) | ✅ | **✅ — always on** |
| Instant match-alert emails | ❌ | ✅ | ❌ (leave as Basic; can flip on later, trivial change) |
| Calendar sync (Google/Apple/Outlook) | ❌ | ✅ | **✅ — always on** |
| Premium themes | ❌ | ✅ | ❌ (leave as Basic, unless you want to just unlock them for fun — costs nothing) |
| Billing / Stripe / upgrade prompts | — | — | **Removed entirely, not just hidden** |
| Board creation (self-serve) | ✅ any user | ✅ any user | **❌ disabled — only 2 boards ever exist** |
| Board joining (self-serve by code) | ✅ any board | ✅ any board | **❌ disabled — pre-assigned to one of the 2 boards** |

Confirmed: calendar sync is on. Premium themes and instant email alerts cost nothing to flip too — still open, flag if you want either.

---

## 3. Migration checklist

Legend: 🤖 = I can do this (code/config), 🧑 = only you can do this (external accounts, DNS, human decisions), 🤝 = needs you to decide/approve, then I execute.

### ✅ Phase 0 — Decisions (🧑 first, blocks everything else)

- ✅ 🧑 Confirm: new private GitHub repo name (`WDWShiftX` assumed)
- ✅ 🧑 Confirm: app display name/branding (currently assumed "WDW ShiftX" — logo, colors, icons all reference "MyShiftX" today and need new assets or at least new text) ** Use "WDWShiftX" for now with same favicon,appleicon, etc**
- ✅ Board names/count confirmed: **"DSA VIP Tour Guides"** (~225) + **"DSA Valet"** (~30, VIP Valet team) — 2 boards
- ✅ Invite codes confirmed: **`DSAVIP7`** (DSA VIP Tour Guides) + **`VALET4U`** (VIP Valet team)
- ✅ Onboarding method confirmed: **self-serve registration with invite code** (not admin bulk-populate). People register themselves at `app/(auth)/register` and enter their team's code — same flow MyShiftX already supports.
- ✅ 🧑 I will still assume the role of Overlord and I will be the admin of each board. A users join, I will give some admin and mod rights.

### ✅ Phase 1 — Repo & infra setup

- ✅ 🧑 Create new private GitHub repo
- ✅ 🤖 Clone/copy MyShiftX working tree into a new local folder, re-point git remote to the new repo, push initial commit https://github.com/ace-d-baugh/WDWShiftX.git — done: `dev` and `main` pushed, this file included
- ✅ 🧑 Create new Supabase project (org, region — pick one close to Orlando/US-East since this is a Disney World team)
- ✅ 🧑 Create new Vercel project, link to the new GitHub repo
- ✅ 🧑 Add `wdwshiftx.com` as the domain in Vercel, update DNS at your registrar to point at Vercel
- ✅ 🤖 Run all 61 existing Supabase migrations (`supabase/migrations/`) against the new project — schema is identical, you're just removing app-layer gates, not tables
- ✅ 🧑 Set up Resend (or your email provider) sender domain verification for `wdwshiftx.com` if you want branded outbound email (match reminders, weekly digest) — otherwise this can be skipped/left off (`RESEND_API_KEY` unset = soft-fail, no emails sent)
- ✅ 🤖 Generate a fresh VAPID key pair for Web Push (keys are origin-specific, can't reuse myshiftx.com's) — verification needs a headed Edge/Chrome browser with a pre-seeded profile, since the bundled Chromium test browser can't do push (known from prior MyShiftX push work)
- ✅ 🤝 Decide final env var list for Vercel (see §5) and set them

### Phase 2 — Remove ads (🤖, code) & other unneeded pages ✅

- [x] Delete/neuter `components/features/AdSlot.tsx` and `components/features/AdRail.tsx` — deleted outright, along with `/upgrade` so the "Remove Ads" links are moot
- [x] Remove AdSense loader script + Funding Choices CMP script + `google-adsense-account` meta tag from `app/layout.tsx`
- [x] Remove `Mediapartners-Google` allow rule from `app/robots.ts`
- [x] Delete/empty `ads.txt`
- [x] Remove ad-consent logic from `components/features/CookieConsentBanner.tsx` (deleted) and the region-cookie plumbing in `middleware.ts` (removed entirely)
- [x] Remove ad disclosure paragraphs from `app/privacy/page.tsx`
- [x] Remove `getShowAds()`/`getPublicShowAds()` call sites from every consuming page
- [x] Remove for/ special landing pages.


### Phase 3 — Remove Stripe / Pro / upgrade paths (🤖, code) ✅

- [x] Delete `app/upgrade/` (pricing page + success page)
- [x] Delete `app/api/checkout/route.ts`, `app/api/customer-portal/route.ts`, `app/api/webhooks/stripe/route.ts`
- [x] Delete `components/features/CheckoutButton.tsx`, `components/features/UpgradeNudge.tsx`
- [x] Delete `lib/stripe.ts`, `lib/pricing.ts`
- [x] Remove "Upgrade to Pro" nav item from `components/layout/Navbar.tsx` and the `showUpgrade` prop plumbing in `app/(dashboard)/layout.tsx`
- [x] Remove Pro/billing section from `app/(dashboard)/profile/page.tsx` + `ProfileClient.tsx` (also cleaned up `admin/AdminClient.tsx`/`admin/page.tsx`, which had their own membership-tier filter/columns, and deleted the Stripe-revenue `AdminCharts.tsx`)
- [x] Simplify `lib/auth/session.ts` — kept `isProTier()`/`getMembership()` narrowly for the one still-gated feature (instant match-alert emails, intentionally left Basic-only per §2); every other consumer now hardcodes `true`
- [x] Remove `stripe` npm dependency from `package.json` (also removed now-unused `recharts`, only used by the deleted `AdminCharts.tsx`)
- [x] Drop Stripe-related columns/migrations — left as unused, lower risk per this doc's own recommendation
- [x] Skip Stripe entirely in new-project env vars — no `STRIPE_*` keys set

### Phase 4 — Flip feature gates to your target set (🤖, code) ✅

- [x] Live Wall instant updates unconditional — `wall/page.tsx` now passes `liveWall={true}`
- [x] Calendar sync unconditional — `calendar/page.tsx` now passes `isPro={true}`; DB-side gate removed via new migration `20260722120000_ical_feed_always_on.sql` (`get_or_create_ical_token`/`reset_ical_token` no longer check membership at all — cleaner than the doc's suggested "set membership='Pro' for everyone" workaround)
- [x] Premium themes and unlimited photo import left gated OFF — `ProfileClient.tsx` now uses a dedicated `PREMIUM_THEMES_UNLOCKED = false` constant instead of reusing `isPro`
- [x] Replaced the tier-flag approach with direct per-feature hardcoding (`liveWall={true}`, `isPro={true}`, `PREMIUM_THEMES_UNLOCKED = false`) rather than keeping a `Basic|Pro|Trial` enum driving unrelated features — `Membership`/`isProTier` still exist in `session.ts` solely for the intentionally-still-gated match-alert emails

### Phase 5 — Lock down to 2 boards (🤖, code + 🧑 seed data) ✅ (code side)

- [x] Removed the "Create a Board" button + modal entirely from `components/features/MyBoardsSection.tsx` and the Step-1 `+` button in `app/(dashboard)/welcome/WelcomeClient.tsx` (not just hidden — the state, handler, and modal JSX are gone)
- [x] Gated the "Join a Board" invite-code input behind a new `showJoin` prop on `MyBoardsSection`, off by default. `app/(dashboard)/profile/ProfileClient.tsx` (already-onboarded users on the dashboard) now renders it with `showJoin` omitted → hidden. `app/(dashboard)/welcome/WelcomeClient.tsx` (first-time onboarding, where the invite code is actually entered — the current `app/(auth)/register` page only prefills a code from a URL query param, it has no manual entry field) passes `showJoin` explicitly to keep the one real self-serve join path working
- [x] Short-circuited `createBoard()` in `app/actions/boards.ts` — always returns `{ error: 'Board creation is disabled...' }` regardless of input; deleted the now-fully-unused `lib/validations/boards.ts` (`createBoardSchema`/`joinBoardSchema` had no other callers)
- [x] Tightened the `boards_insert_user` RLS policy via new migration `20260722130000_lock_board_creation_to_admin.sql` — dropped the old policy (`get_user_role() IN ('user','admin')`) and replaced it with admin-only (`get_user_role() = 'admin'`), applied to the live DB
- [ ] 🧑 Once the new Supabase project exists, seed exactly 2 rows in `boards`: **"DSA VIP Tour Guides"** with invite code **`DSAVIP7`**, and **"VALET4U"** with invite code **`VALET4U`**, both `is_active=true`
- [ ] 🧑 Distribute each code to the matching team (DSAVIP7 → tour guides, VALET4U → valet team) via whatever channel you use today — people self-register at `app/(auth)/register?code=...` (or enter the code manually on the register/join screen) and land on the matching board automatically
- [ ] ⚠️ Note on these two specific codes: `DSAVIP7` and `VALET4U` are human-memorable, not random-generated like MyShiftX's default 7-char codes — easy to share verbally/in a group chat, but also easier for someone outside the 255+30 to guess or pass along than a random code would be. Since registration is self-serve and public, anyone with the code can join. Existing rate-limit/lockout in `lookupBoardByCode()` (5 failed attempts/60s, auto-deactivate after 15/24h) still protects against brute-forcing an *unknown* code, but doesn't stop a known code from spreading beyond the intended team. If that becomes a problem post-launch, rotate the code (`regenerateInviteCode()` already exists) and redistribute — low effort, no code change needed.

### Phase 6 — Rebranding (🤖 code, 🧑 assets) ✅

- ✅ 🧑 Provide app name, logo, favicon, theme color, and any copy changes you want (currently everything says "MyShiftX")
- [x] 🤖 `app/manifest.ts` already fully rebranded — name/short_name/description all say WDWShiftX
- [x] 🤖 Hardcoded domain references — confirmed via `grep -ri myshiftx` across the whole codebase: zero hits outside `TASKS.md` (legacy MyShiftX business/legal task board, not app code) and already-applied historical migration files (never edited for cosmetic reasons). The ~28-file sweep referenced here was already done earlier in this migration
- [x] 🤖 `package.json` name field was already `wdwshiftx`. Rewrote `README.md`'s status line, Board System feature bullet (board creation no longer self-serve), and Roadmap/Contributing sections, which still described the old public multi-tenant product (Stripe monetization, public launch, 500+ users, outside contributions) — none of which applies to this private internal fork
- ✅ 🧑 Replace icon/logo asset files (`app/apple-icon.png`, favicon, any `public/` logo images) with WDW ShiftX branding
- [x] Removed the dead (already `hidden`-classed, never rendered) "Users Are Saying Good Things" placeholder-testimonials section from `app/page.tsx` — its industry tags (Theme Parks, Retail Stores, Hotels & Resorts, etc.) were the same "works for any workplace" marketing conceit as the industry chips removed in Phase 2


### Phase 7 — Legal/policy pages (🤝)

- [ ] Since this is an internal tool for employees of one operation, not a public consumer product: simplify or replace `app/privacy`, `app/terms`, `app/data-deletion`, `app/contact`, `app/about` — remove all ad/consent/GDPR-CMP language (no longer applicable with no ads), keep basic data-handling disclosure since you're still storing PII (names, shift schedules, messages) for 255 people
- [ ] 🧑 Confirm whether this needs any sign-off from Disney/your employer's IT or legal, given it touches tour guide scheduling data — your call, flagging so it doesn't get missed

### Phase 8 — Verification (🤖, before rollout)

- [ ] Build + type-check + full test suite passes on the new repo
- [ ] Manually walk: register → enter invite code → land on correct board → post/offer/request a shift → Live Wall updates instantly for a second logged-in user without refresh → push notification fires → no ad slots render anywhere → no `/upgrade` route reachable (404) → attempting to create a second board is impossible from the UI
- [ ] Confirm Web Push works end-to-end on the new domain (needs the headed-browser recipe in memory, since bundled Chromium can't test push)
- [ ] 🧑 Soft-launch with a handful of real tour guides before rolling out to all 225 + 30

---

## 4. What Claude can fully own vs. what needs you

**I can do (given repo/Supabase/Vercel access is set up):** all code edits in Phases 2-6, running migrations, writing/updating tests, verifying locally.

**Only you can do:** creating the GitHub repo, Supabase project, and Vercel project (account-level actions); DNS changes at your registrar; deciding branding assets; deciding the onboarding mechanism for 255 real humans; distributing invite codes; any legal/employer sign-off; final go-live decision.

---

## 5. Env vars for the new project (much shorter than MyShiftX's)

Required:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (new Supabase project)
- `SUPABASE_SERVICE_ROLE_KEY` (admin actions — board seeding, notifications)

Recommended:
- `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` = `https://wdwshiftx.com`
- `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (freshly generated for this origin)
- `CRON_SECRET` (if keeping the expirations/weekly-digest crons)
- `RESEND_API_KEY` (only if you want outbound email)

Explicitly **not needed** (features removed): `STRIPE_*` (all), `NEXT_PUBLIC_ADSENSE_*` (all), `GEMINI_API_KEY`/`GEMINI_MODEL` (only if you drop photo import too — otherwise keep for the 4/month Basic feature), `NEXT_PUBLIC_REGISTRATION_OPEN` (decide per Phase 0 — if onboarding is invite-only anyway, you may want registration permanently "open" but gated entirely by requiring a valid invite code).

---

## 6. Risks / things to double check as you go

- The board-lockdown RLS change (Phase 5) is the one place where a UI-only fix is not enough — someone could still call the `createBoard` or `lookupBoardByCode` RPCs directly against Supabase if only the button is hidden. Do the RLS/server-action tightening, not just the UI hide.
- Deleting Stripe code entirely (rather than just leaving it unconfigured) is a bigger diff than "flip a flag," but matches your ask ("anything that points to a pro version") — leaving the routes in place but unreachable would still leave `/api/checkout` etc. live and callable.
- 255 people sharing 2 boards means the Wall/board pages will be busier than a typical small MyShiftX board — worth a quick sanity check on query pagination/perf under that load before full rollout (soft-launch in Phase 8 covers this).
- Re-run the file/line references above against the actual code before editing — this document is a snapshot from 2026-07-21 research, not live.
