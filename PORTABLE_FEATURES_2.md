# WDWShiftX Changes Since Last Sync (2026-07-27 → 2026-08-17)

This covers every commit on WDWShiftX's `main` between `7216964` ("All audit items complete") and the current tip (`144e1e3`) — the point where MyShiftX and WDWShiftX were last brought in sync. 26 commits, spanning three feature branches merged into `dev`: **Product Tour**, **Wall Filters / Legend / Copy**, and **Admin Boards / Jump Bars / Roles**, plus a handful of smaller standalone commits.

Nothing here is blog or AdSense related. Two items are removals/renames driven by a WDW-specific decision rather than new capability — they're included per your call, flagged clearly, so you can decide per-item.

**How to use this:** read through, tell me which numbered items you want, and I'll build the task list document from your picks. Items are grouped by the page/area they touch. Where a feature was built across many small iterative commits (Wall filters especially — 15 commits), I've described the **final state only**, not the history, since that's what would actually get ported.

---

## The Wall

### 1. Type filter (Trade / Giveaway)
Two star-checkbox toggles on the Offers tab — "Trade" and "Giveaway" — checking the underlying `is_trade`/`is_giveaway` flags so a Give/Trade post matches either. Defaults to both checked (type filter is always applied; unchecking both shows nothing). Hidden on the Requests tab, since it's a shift-only distinction. Feeds Clear Filters and the active-filter indicator.

**Portability:** ✅ Genuinely new capability, self-contained to the Wall filter panel.

### 2. Days filter (day-of-week)
Seven always-visible day pills (Sun–Sat by default, or reordered to match the user's week-start preference), colored when included and grayed when clicked off. All on by default; the filter is always applied (all-off shows nothing, matching the Type filter's behavior). Available on both Offers and Requests tabs.

**Portability:** ✅ New capability. Note it evolved from an earlier Boards-style dropdown to always-visible pills after direct iteration — the pill version is the one to port, not the dropdown.

### 3. Wall filter panel layout rework
The filter panel was substantially reorganized across ~12 small commits: Board gets its own full-width row (first); My Posts/Trade/Giveaway share a row with the Days pills (justify-around spacing); Any Date shares a row with the search box; field labels dropped in favor of self-explanatory placeholders ("All Boards", "Any Date", "All Days") with aria-labels for accessibility; Clear Filters moved to the always-visible header row instead of pushing content down when the panel opens; the date field became a controlled toggle (click to open, click again to close); distinct icons per control (LayoutGrid for Board, CalendarDays for Date, calendar-1 SVG for Days).

**Portability:** ✅ Portable as a layout/UX pattern, but it's entangled with items 1 and 2 above — it only makes sense once those filters exist. Port together.

### 4. MNSSHP / HHN / MVMCP date badges
Purely decorative emoji badges (🎃 Halloween party, 🧟 Horror Nights, 🎄 Christmas party) on Wall day-headers and calendar cells for 2026's special-ticketed-event nights at Disney parks. Tapping a badge opens a shared "Party Legend" modal explaining what it means. New `lib/special-events.ts` holds the date lookup.

**Portability:** ⚠️ **WDW-specific by design** — this is Disney park event marketing, meaningful only to cast members/guides who care about MNSSHP/HHN/MVMCP nights. Almost certainly not relevant to MyShiftX's general audience unless you want a generic "special dates" badge system. Listed for completeness; my default recommendation is to skip it.

### 5. "I'll take this" renamed to "I Can Help"
Renamed everywhere user-facing: the claim pill, Help page, guided tour copy, push/email notification text, and the Trade Record empty state. The old bundle-only "I'll take all" label folded into the same "I Can Help" text, since the confirmation modal already spells out the all-or-nothing part.

**Portability:** ✅ Trivial copy change, no functional risk. Purely a naming preference — include only if you like the new wording better.

### 6. Requests now match Offers' action-row layout
Request cards previously had their own layout for the interest control. Now reads leadingAction → Comments → Message, same as Offers, and the built-in "interested" pill is restyled to match the Wall's claim pill (outline-to-solid, Handshake icon).

**Portability:** ✅ Small, self-contained visual consistency fix.

---

## Calendar

### 7. Shift titles color-coded to match the Wall
Calendar shift titles now use the same trade/giveaway color language as Wall cards (neutral when the shift isn't posted). Month grid also splits its activity dots so offers sit left and requests sit right in the day cell.

**Portability:** ✅ Small, self-contained visual consistency fix. Built as a supporting piece of the Product Tour (item 11) but stands alone fine.

### 8. Special-event badges on Calendar (see item 4)
Same MNSSHP/HHN/MVMCP badges as the Wall, placed in Calendar List view (left of the day row's + icon) and Grid view (top-right of the day cell). Same portability caveat as item 4.

---

## Help Page

### 9. Legend section
A new Help page section: shift-type color chips (built from the exact CSS classes real cards use, not hand-rolled approximations — this mattered because several themes, Cyberpunk especially, override those specific classes for contrast and a generic swatch would've shown the wrong color), icon rows explaining Bundled / I Can Help / Comments / Message, and the three party badges with their full name + acronym.

**Portability:** ✅ Portable, but depends on whichever of the above features you actually port — a legend entry for a feature you don't have doesn't make sense. Build to match your final feature set, not copy verbatim.

### 10. Help page: Product Tour launch cards
See item 11 below — the Help page carries one card per tour chapter for jumping straight into it.

---

## Cross-cutting: Guided Product Tour

### 11. Full product tour with in-memory sample data
A four-chapter guided tour (Wall, posting a shift, Calendar, Messages) built on `driver.js`, themed from the app's CSS custom properties so it follows every theme automatically. Auto-starts once on a new member's first Wall visit; each chapter hands off to the next via `sessionStorage`; Help page has a card per chapter to re-launch any of them manually.

The interesting engineering piece: while a tour runs, three fake demo shifts (one per posting type) plus matching calendar entries and two fake conversations are merged into the real lists **in memory only** — nothing touches the database, the rows are inert/unclickable, and they vanish the instant the tour ends however it ends (finished, skipped, navigated away). This exists because a brand-new member with an empty Wall would otherwise get a tour where most steps have nothing to point at.

Steps that describe a control also operate it (expands a card's notes, sends the sample claim, opens comments, opens the filter panel), so the tour demonstrates behavior instead of just pointing at static UI.

**Portability:** ✅ Genuinely new capability and probably the single biggest lift in this list — new dependency (`driver.js`), 3 new files (~950 lines: `ProductTour.tsx`, `sample-data.ts`, `tour-state.ts`, `tour-steps.ts`, `product-tour.css`), and touches Wall/Calendar/Messages/Help/Navbar/layout. Worth it if onboarding new members is a pain point on MyShiftX; skip if it isn't. The tour steps reference the exact UI copy/controls, so porting requires either matching MyShiftX's current UI or updating the step text — not a pure copy-paste if MyShiftX's Wall doesn't have the same filters (items 1–3) by the time this ports.

---

## Messaging / Notifications

### 12. Push notification when a comment is posted
Comments previously notified nobody unless the commenter also marked interest. New `notifyComment` server action pushes the post owner plus everyone else who has commented on that post (minus the commenter themself). **Push only** — comments never send email, so a busy thread can't burn through the Resend send quota. Recipients and message content are read server-side from the DB, and the caller must have their own comment on the post already, closing the same class of hole S1 fixed elsewhere (can't be used to blast arbitrary pushes).

**Portability:** ✅ Genuinely new capability, and written with the S1 lesson already applied (auth-checked, DB-derived content). Clean port.

---

## Auth / Profile / Display Names

### 13. ⚠️ Display names: "First L." → "First Last" *(optional — WDW-specific decision)*
Changes the derived display-name format from "First L." (first name + last initial) to the full "First Last" everywhere it's constructed or validated: the regex, profile editor, register-page live preview, the OAuth callback, and the `handle_new_user()` DB trigger. Includes a one-time backfill script to expand existing "First L." names.

**Portability:** ⚠️ This is a product decision about how much of a coworker's identity to show, not a bug fix. MyShiftX currently uses "First L." — before porting, decide whether you actually want full last names visible on MyShiftX too (different context: WDW is ~255 known coworkers at one employer; MyShiftX is a broader public product where showing full last names to strangers on a shared board is a different privacy tradeoff). Flagged per your instruction, not recommended by default.

### 14. Display-name copy clarification
Small follow-up to item 13 — updates helper text/placeholders to say "full first and last name" instead of the old copy. Only relevant if you take item 13.

### 15. User first_name / last_name split
`users.first_name` / `users.last_name` added as separate columns alongside `display_name` (part of the larger Aug 17 migration, item 18). Lets the app reason about the two parts independently rather than parsing `display_name`.

**Portability:** ✅ Reasonable schema hygiene independent of item 13 — you can split the columns without changing the display format. Consider decoupling if you want the data model improvement without the visibility change.

---

## Admin ("Overlord") Panel

### 16. Board-less user detection
Users tab shows a "Boards-N" pill per user (counting non-hidden memberships, approved + pending) that turns warning-colored at 0, plus a "Show only users with 0 boards" filter checkbox and a warning dot on the tab itself. Built after finding two real users who registered but never landed on any board and had to be found by hand. No new RPC — reuses the existing member-count query.

**Portability:** ✅ Small, useful, no schema change. Good candidate regardless of what else you take.

### 17. Admin panel overhaul (final state)
This was built across two branches (`feat/admin-rows-and-count-pills`, `feat/admin-boards-jumpbars-and-roles`) and is presented here as one item per your call — final state, not the intermediate steps:

- **Users tab:** icon → name → count → actions row layout. Site role shown as an icon (crown/user/ghost) with the label as a tooltip instead of a text badge (also fixes the badge literally reading "Admin" instead of "Overlord"). Board count is a bare number that doubles as the accordion toggle. Edit/Deactivate stay inline on wider screens, fold into a ⋮ menu on mobile.
- **Boards tab:** right side now mirrors the real board header (Invite / Rename / Delete), with Pause/Resume (renamed from Deactivate/Reactivate) moved into a ⋮ menu so a board can be parked without deletion. Delete became a genuine **soft delete** (new `boards.status` column: active/paused/deleted) rather than a hard delete, everywhere it's triggered (Overlord, `/boards`, profile).
- **Sticky, letter-sectioned tabs** with a vertical A–Z jump bar once a list passes 25+ results, collapsible-but-sticky Filters, an Inactive-user filter, always-visible Reactivate.
- **`/boards` and `/boards/[slug]`:** sticky headers/search rows, member rows switched from per-section tables to a grid layout (fixes column misalignment across sections), role icons (Crown/Award/UserRound) replacing text badges with a matching icon key.
- Shared `CountPill` component unifies count styling across Wall tab-counts, day-headers, and admin panel counts.
- Along the way: found and fixed that `invite_code` has no client SELECT grant (the S8 lockdown from the last sync) — admin now reads codes through `get_board_invite_codes()` like `/boards` already does, instead of selecting the column directly.

**Portability:** ✅ The soft-delete/status model and jump-bar/sticky-header patterns are genuinely useful UX. This is the largest single change in the list (two commits, ~2,700 lines) and touches `AdminClient.tsx`, `BoardsClient.tsx`, `boards.ts` heavily. Recommend treating it as its own dedicated work session if chosen — it's not a quick cherry-pick.

### 18. New admin form: assign a user to a board
A "User Boards" section on the admin Edit User form: an overlord can add a user directly to a board (board + role picker), bypassing the normal self-service join flow (runs on the service client since the S16 fix from last sync intentionally only allows self-service *pending* joins now). Full member-management parity with `/boards/[slug]` — message, change role, remove, transfer ownership — with admin-correct transfer semantics (promotes the target, steps down the visible Leader, leaves the hidden Overlord auto-memberships untouched).

**Portability:** ✅ Useful, and correctly threads through the S16 authorization fix rather than working around it. Depends on nothing else in this list.

---

## Infrastructure / Removed

### 19. ⚠️ Weekly digest removed entirely *(optional — WDW-specific decision)*
Deletes the Sunday digest cron route, the unsubscribe route, the email template, the profile toggle, and drops the `notify_weekly_digest` column. Reason given: avoiding Resend send-cap risk at WDW's send volume.

**Portability:** ⚠️ This is a removal, and MyShiftX still has the weekly digest live today. Only relevant if MyShiftX is *also* approaching a Resend send-cap concern, or if you've independently decided the feature isn't worth keeping. Not recommended by default — flagged per your instruction since it does touch shared code (email templates, profile settings) that a future merge could otherwise conflict on.

---

## Since last sync (2026-08-20 → 2026-08-21)

New work on `dev`/`main` since the 26-commit sync above — the Wall post sharing feature, profile pictures (upload, crop, and display everywhere a user's identity shows), and a handful of related fixes. All commits: `b53f097`, `19850bc`, `8f6753d`, `c89d995`, `6fafba9`, `3e14b52`, `5f45f69`, `9e358ee`, `e4f86e2`, `07ed1ec`, `8bb22f2`.

**Not included below, and deliberately not for porting:** `9d30910` ("Re-add join-a-board on profile page for users who register directly") — this opened up entering an invite code for WDWShiftX's two boards from the Profile page. MyShiftX's board-join flow already works this way as part of its existing model, so there's nothing to port here.

### 20. Wall post sharing (native share sheet, image + link)

Owner-only **Share** control on Wall posts — appears inline in the post's action row (in the spot "Message" would occupy on the poster's own card, since you can't message yourself: icon+text on larger screens, icon-only on mobile) and as a "Share" item in the `⋮` menu, on both Shift Offer and Shift Request cards.

Clicking it renders a branded off-screen card (title, board, date/time, details, left-border + type-badge colors, footer) and captures it to an image via `html-to-image`, then calls `navigator.share()` with the image + text + a `/wall?post=<id>` deep link (falling back to text+link only if the browser can't share files, falling back further to a copy-text/download-image modal if `navigator.share` doesn't exist at all — most desktop browsers). Opening the deep link switches to the right tab, clears filters so the post can't be hidden, expands its day-group, and scrolls to + briefly highlights the card.

The colors on the captured image (left border, type badge background/text) are read live off the actual DOM at capture time rather than hardcoded — a CSS custom property for the border accent, and an off-screen instance of the real badge class for the pills — so the image automatically matches whichever of this app's many themes (dark, cyberpunk, nordic, christmas, patriotic, ...) the poster has active, instead of only ever matching one.

New files: `components/features/ShareCard.tsx`, `ShareHandler.tsx`, `ShareModal.tsx`, `lib/share/buildWallPostShare.ts`. New dependency: `html-to-image`. Also added a "Share" row to the Help page's icon Legend.

**Portability:** ✅ Genuinely new capability, self-contained. The one thing to redo rather than copy verbatim: the color-matching technique (read live computed colors instead of hardcoding hex) only pays off if you apply it against *MyShiftX's own* theme tokens — a straight file copy would carry over WDWShiftX's CSS variable names, which won't exist there.

### 21. Post-a-Request form: Board field reordered to match Post-a-Shift

`PostRequestForm.tsx`'s Board field was second (after Title); moved to first, matching `PostShiftForm.tsx`'s field order. Confirmed both forms already correctly hide the Board field entirely for single-board users (`boards.length > 1` gate) — no fix needed there, just verified consistent.

**Portability:** ✅ Trivial UI-consistency fix, no functional risk.

### 22. Wall card poster-name resize + reflow (profile-pictures prep)

On both `ShiftCard` and `RequestCard`, the poster name grew from a tiny `text-xs` label to `text-lg` — matching the title's size, explicitly **not** bold — and its icon grew `w-3→w-4`. This is prep, not the feature itself: a plain generic-user icon reads fine at 12px, but an actual avatar image needs real size to be recognizable, so the name (and the space around it) had to grow first to make room for one.

Desktop keeps the name inline with the title, in its existing position — just larger. Mobile moves the name to its own row below the date/time row, and takes the accordion chevron down with it (desktop's chevron stays on the date/time row, unchanged). The collapsible notes/board panel still expands directly beneath whichever row holds the active chevron on both breakpoints. Does **not** touch the share image in any way (confirmed via `git diff --stat` before committing — `ShareCard.tsx`/`ShareHandler.tsx`/`buildWallPostShare.ts` untouched).

**Portability:** ✅ Straightforward, but sequence it as prep-then-feature there too, same as here — don't skip straight to dropping in avatar images without first confirming the surrounding layout has room for them at each breakpoint.

### 23. Wall card spacing tightened on mobile

Two small follow-up spacing fixes on the same cards: mobile's date/time row and poster-name row now sit flush against each other (bottom margin removed) instead of carrying the same 12px gap desktop uses to separate date/time from the collapsible content beneath it — desktop still needs that gap, since it has no intervening name row, so it kept it. Separately, the divider above the Comments/Message/Share pill row (`CommentSection.tsx`) had its top margin halved (12px → 6px) on both breakpoints.

**Portability:** ✅ Trivial, cosmetic only.

---

## Profile Pictures

### 24. Upload, crop, and store a profile picture

New capability: any user can upload a photo, crop it to a circle, and have it show up as their avatar everywhere their identity is shown. Built from scratch — nothing like it existed before this.

**Storage & schema:**
- First Supabase Storage bucket in this project: `avatars` — **public-read** (so `<img>` tags load the URL directly, no signed-URL dance), 2MB size limit, `image/jpeg`/`image/png`/`image/webp` MIME allowlist.
- `storage.objects` RLS: anyone can `SELECT` (public bucket); `INSERT`/`UPDATE`/`DELETE` restricted to `(storage.foldername(name))[1] = auth.uid()::text` — a user can only ever touch objects under their own `<user_id>/` path.
- New `users.avatar_url text` column + a `GRANT SELECT (avatar_url) ON public.users TO anon, authenticated` in the same migration (this app uses explicit column-level grants instead of table-wide — a new column with no grant fails the *whole* query for every reader, not just that column, so the grant has to land in the same migration as the column).
- Migration: `supabase/migrations/20260821120000_avatars_storage_and_column.sql`.

**Client-side flow (`components/features/AvatarUpload.tsx`, new):**
1. Hidden `<input type="file" accept="image/*">` triggered by a styled button.
2. On file pick, opens a modal with `react-easy-crop`'s `<Cropper aspect={1} cropShape="round">` — drag to reposition, a range slider to zoom.
3. On save, draws the returned crop region onto a fixed 512×512 `<canvas>`, `.toBlob(..., 'image/jpeg', 0.85)`.
4. Uploads via `supabase.storage.from('avatars').upload(path, blob, { upsert: true })` to **always the same path** (`<user_id>/avatar.jpg` — the client always re-encodes to JPEG regardless of the source format, so the path never varies and a re-upload is a clean overwrite, no orphaned files).
5. Builds the public URL and appends a cache-busting `?v=<timestamp>` query string before writing it to `users.avatar_url` — the Storage object path never changes on re-upload, so without this a viewer who already loaded the page would keep seeing the old cached image.
6. Includes a "Remove photo" action (clears `avatar_url`, best-effort deletes the Storage object).

New dependency: `react-easy-crop`.

**Portability:** ✅ Genuinely new capability, but the Storage bucket and RLS policies need to be created fresh against *MyShiftX's own* Supabase project — a bucket reference can't be copied between projects. The crop/compress/cache-bust techniques are directly reusable as code.

### 25. Shared `Avatar` component + display rollout everywhere

New `components/ui/Avatar.tsx` — the single place avatar-or-fallback rendering lives, used everywhere a user's identity is shown:
- Shows the real photo (circular, `object-cover`) when `avatarUrl` is set.
- Falls back to a single letter (the first letter of the person's first name/display name) in a colored circle when there's no photo but there is a name.
- Falls back further to a generic person icon when there's neither.
- Clicking a real photo opens a lightbox with the full image (self-contained — no extra wiring needed at each call site).
- `size` prop (diameter in px) floors at 20px internally — a circle never renders illegibly small regardless of what a caller passes.

**Every place it was wired in**, each requiring the relevant query/RPC to also select `avatar_url`:
- **Wall cards** (`ShiftCard`/`RequestCard`): both the desktop inline spot (next to the post title) and the mobile-only spot (its own row below date/time) — replaces the old generic user icon.
- **Profile page**: the Account Info card, next to the upload control (item 24).
- **Comments** (`CommentSection.tsx`): each comment row, and the owner-only "who's interested" list.
- **Messages**: the "Start a chat" board-mate picker, the conversation list, the chat header, and the new-message toast.
- **Boards** (`/boards` and `/boards/[slug]` — both render through one shared `BoardsClient.tsx`, so one component edit covers both routes) and the **Overlord panel's Users tab**: here the placement is different from everywhere else — the avatar goes **between the existing role icon (Crown/Award/UserRound) and the member's name**, not replacing anything, since that icon means *role*, not identity.

**The one non-obvious gotcha for whoever ports this:** two of the places above (`get_conversations()`/`get_messageable_users()` for Messages, `get_users_admin()` for the Overlord panel) are `SECURITY DEFINER` RPC functions, not plain table selects. Postgres won't let `CREATE OR REPLACE FUNCTION` change a `RETURNS TABLE` column list — extending them needs `DROP FUNCTION` then `CREATE FUNCTION`, and critically, **the DROP resets the function's EXECUTE grants to the Postgres default (`PUBLIC`)**, so the original `REVOKE`/`GRANT EXECUTE` statements have to be explicitly reissued in the same migration or the function becomes callable by roles that shouldn't have it. Migrations: `20260821130000_avatar_url_in_messaging_rpcs.sql`, `20260821140000_avatar_url_in_admin_rpc.sql`.

Every one of these was verified to **degrade cleanly** (icon/initials fallback, no crash, no console error) if a query hasn't been extended yet — worth keeping that property when porting, so a partial rollout never breaks a page.

**Portability:** ✅ The `Avatar.tsx` component and the display-integration pattern are directly reusable. The RPC-extension technique (DROP+CREATE+reissue-grants) is worth documenting for MyShiftX's own team even beyond this feature — it'll bite again on any future RPC signature change.

### 26. Avatar fallback: single-letter initial, and a real light-theme contrast bug

Two rounds of polish on the fallback state (no photo) in `Avatar.tsx`:

- **Single letter, not two-letter initials** — sized 14px inside every 20px circle, 28px inside the one 40px circle (Profile page). An early version showed two-letter initials at a flat proportional size; simplified after checking how it looked in practice.
- **Real accessibility bug, not just a style tweak:** the fallback letter's color used to inherit whatever tint color the calling card passed in (trade blue, giveaway green, board-role accent, etc.) so the fallback would echo that card's color language. On WDWShiftX's light theme, several of those tint tokens measured as low as **1.26:1 contrast** against the fallback circle's background — WCAG AA requires 4.5:1 for normal text, so this was functionally invisible, not just suboptimal. Root cause: those color tokens are pastel/light values by design, tuned for icon strokes and badge fills, not small foreground text. Fixed by always using the app's solid body-text color for the letter regardless of the passed tint; re-measured at 11.54:1 on the same theme.

**Portability:** ⚠️ The single-letter/sizing choice is a straightforward copy. **The contrast fix itself must be re-verified against MyShiftX's own theme tokens, not copied as a hex value** — this is the exact same lesson as the Wall-share-image color-matching technique (item 20): measure contrast live against whatever MyShiftX's light theme actually resolves those tokens to, don't assume WDWShiftX's numbers transfer. If MyShiftX has only one theme, this may be a non-issue there, or a different token may be the culprit — check before assuming a fix is needed at all.

---

## Since last sync (2026-08-23)

Two small Overlord panel fixes, both from the same round of work as a couple of WDW-only items (a past-day Calendar badge tweak and a new Wall reminder banner — not included here since they're not relevant to MyShiftX). Commit: `4a88ec8`.

### 27. Overlord panel: "Clear Filters" on Boards and Users tabs

Both tabs' sticky Filters header row now shows a **Clear Filters** link — same convention as the Wall's existing one (`text-warning`, small `X` icon, positioned at the end of the header row) — whenever any filter is actually active on that tab, and disappears when none are. Clicking it resets that tab's filters back to defaults in one action instead of clearing each control by hand.

- **Boards tab:** counts as active if `boardSearch` (trimmed) or `boardStatusFilter` is set. Clears both.
- **Users tab:** counts as active if `userSearch` (trimmed), `filterRole`, or the Boardless checkbox is set. Clears all three.

**Portability:** ✅ Trivial, self-contained UI consistency fix — no schema/RPC involved. Only depends on each tab already having its own filter state (which any admin/user-management panel will).

### 28. Overlord Users tab: inactive users no longer leak into the default view

Real bug, not a feature: inactive users used to show up under "All Users" and under every role filter — the "Inactive" role-filter option was meant to be the *only* place they'd appear, but the filtering logic never actually excluded them anywhere else. Fixed in four places, all in the same filtering logic:

- **Default/role list** (`filteredUsers`): now excludes `!u.is_active` unless the "Inactive" filter is explicitly selected.
- **Boardless count/filter** (`zeroBoardsCount`): now counts only `u.is_active && u.board_count === 0` — an inactive user with zero boards was previously inflating this count for something nobody needed to act on.
- **Users tab header count badge**: now counts only active users (`activeUserCount`), not `users.length` (which included inactive).
- The "Inactive" filter itself is unaffected — selecting it still shows exactly the inactive users, with the Boardless pill's count switching to show `inactiveCount` for that view (pre-existing behavior, untouched).

**Portability:** ✅ Straightforward filtering-logic fix, no schema/RPC change — check whether MyShiftX's own admin/user-management view has the same "inactive leaks into the default view" bug before assuming it needs the fix; if MyShiftX's filter logic was written correctly from the start, this may be a non-issue there.

---

## Porting prompt — items 27 & 28 (hand this to the MyShiftX agent)

> Port two small Overlord/admin-panel fixes from WDWShiftX to MyShiftX. Both are pure client-side filtering/UI logic — no schema or RPC changes involved. Read `PORTABLE_FEATURES_2.md` items 27 and 28 in the WDWShiftX repo for full context; summary below.
>
> **1. "Clear Filters" on the admin panel's Boards and Users tabs (item 27).** Find MyShiftX's equivalent admin/user-management filter UI. For each tab that has its own filter state (search text, a status/role select, any boolean toggle filters), add a small link — same visual convention as wherever MyShiftX already has a Clear Filters control elsewhere (check the main board/list view first, e.g. a "Wall" or dashboard filter panel, and match that convention; if none exists, use `text-warning`-equivalent color + a small X icon). Show it only when at least one filter on that tab is currently active (non-empty search, a non-default select value, a checked toggle); clicking it resets every filter on that tab back to its default in one action. Reference implementation: `app/(dashboard)/admin/AdminClient.tsx` in WDWShiftX — search for `boardsHasActiveFilters`/`clearBoardFilters` and `usersHasActiveFilters`/`clearUserFilters`.
>
> **2. Fix inactive users leaking into the default admin Users view (item 28).** Before touching anything, check whether MyShiftX's admin Users view actually has this bug: does an inactive/deactivated user show up under "All Users" or under a specific-role filter, when it should only show up under an explicit "Inactive" (or equivalent) filter? If MyShiftX's filtering was already written correctly, skip this item entirely — don't introduce a fix for a bug that doesn't exist there. If the bug is present, the fix is: (a) the main filtered-user list must exclude inactive users unless the inactive filter is explicitly selected, (b) any "boardless"/zero-boards-style count or filter must only count active users, (c) any header/tab count badge showing a total user count must count active users only, not the raw total. Reference implementation: same file, `filteredUsers`/`zeroBoardsCount`/`activeUserCount` in `AdminClient.tsx`.
>
> Verify both live in the browser (apply a filter, confirm Clear Filters appears and works; toggle a user inactive, confirm it's excluded from the default view and counts, and only shows under the Inactive filter) before committing.

---

## Since last sync (2026-08-26)

A full Notifications feature: a persistent, per-user record of every event WDWShiftX already pushed/emailed (shift match, interest, comment, claim lifecycle, board-approved), plus a new capability — Mods/Admins can broadcast pinned, board-wide announcements. Commit: (pending — implemented on `dev`, not yet merged/deployed).

### 29. Notifications page + Mod/Admin board announcements

The biggest addition since the initial sync. Two new tables (`notifications` — one row per event/announcement; `notification_recipients` — per-user, and for board announcements per-board, read/dismiss state), retrofitted into every existing push call site so the in-app page shows the exact same title/body/link that was pushed:

- `notifyInterest`, `notifyComment`, `sendMatchNotifications` (shift/request match), `notifyClaimCreated`, `notifyClaimResolved`, `notifyClaimFinalized`, `notifyBoardApproved` — all in `app/actions/notifications.ts`, each now calls a small `createNotification()` helper right next to its existing `sendPushNotification()` call.

New capability: `app/actions/boardNotifications.ts` lets a Mod (boards they moderate) or global Admin (any board) send a title+details announcement to one or more boards at once. It's pinned (yellow background, "Pinned" section) for 14 days from send/last-edit, then moves into the regular chronological list but keeps the yellow tint. Editing resets it to unread for every recipient and re-fires push/email, as if newly sent. Regular members get a per-user, non-destructive **Dismiss**; the sender or an Admin get **Edit** and a hard **Delete** that removes it for everyone. A member of several targeted boards gets one card per board (each labeled with that board's name — the label is suppressed entirely for a user who only belongs to one board), since one `notifications` row can fan out to several `notification_recipients` rows.

Any notification — personal or board — is hard-deleted 14 days after being read; unread ones never expire. A `purge_expired_notifications()` SQL function handles this, scheduled via `pg_cron` where available, and also called opportunistically (non-blocking) from the Notifications page load as a fallback in case cron isn't enabled on the project.

UI: `app/(dashboard)/notifications/` (page + `NotificationsClient.tsx`), a Bell entry in the account dropdown (`components/layout/AccountDropdown.tsx`) with an unread-count badge, and the same red-dot-on-closed-menu treatment the Approvals badge already uses (`Navbar.tsx`'s `hasUnresolved`). The 3-dot card menu and card-list layout deliberately reuse the exact patterns already in the codebase — `ShiftCard.tsx`'s fixed-position portal menu, `MessagesClient.tsx`'s card-list/avatar/unread-badge structure — rather than inventing new ones.

Two judgment calls made without an explicit spec, worth re-deciding for MyShiftX rather than copying blind: (1) only the original sender of a board announcement or a global Admin may edit/delete it — not any Mod who happens to moderate one of its target boards, to avoid ambiguous multi-board co-ownership; (2) editing an announcement changes title/body only, not its target boards — re-targeting isn't supported.

**Portability:** ✅ Genuinely new capability (the board-announcement half) plus a real gap-fill (the persisted-history half) — but it's the largest single lift in this document after item 11/17: 2 new tables + RLS + 2 SQL functions, ~8 existing notifier call sites touched, 2 new server-action files, and a new page. If MyShiftX doesn't have `pg_cron` enabled, the expiry sweep degrades gracefully to the opportunistic page-load purge — confirm that's acceptable there or enable the extension. **Not yet verified end-to-end** — the migration needs to be applied by hand (no MCP path to this project's DB) and then walked through logged-in as a regular member and as a Mod/Admin before treating this as done, let alone porting it.

### 30. Profile page: Account Security section (add password / connect-disconnect OAuth)

New card on the Profile page, placed just above Danger Zone: `components/features/AccountSecuritySection.tsx`. Lets a user manage how they log in, whichever way their account started out:

- **OAuth-only account** (signed up via Google/LinkedIn, no password): shows "Add Password" — a password + confirm form (same strength meter/requirements as registration and reset-password) that calls `supabase.auth.updateUser({ password })`. Once set, the account can log in with either the OAuth provider or email+password.
- **Account with a password already** (whether it started that way or had one added): the same form relabels to "Update Password" — no old-password re-entry needed since Supabase authenticates via the existing session.
- **Connected Accounts** subsection: any linked OAuth identity (Google/LinkedIn — Facebook omitted, matching `OAuthButtons.tsx`'s `ENABLED` map, no Meta app configured) shows with a Disconnect button; any not-yet-linked provider shows a Connect button that calls `supabase.auth.linkIdentity()` and redirects through the existing `/auth/callback` route (`?next=/profile`) to complete the flow. Disconnect is disabled with a tooltip when it's the user's only identity, since Supabase's `unlinkIdentity()` requires at least 2 identities to remain — this is deliberately conservative for a password-added-to-OAuth account (which has only 1 identity row even though password login works); a stricter check that accounted for that case wasn't worth the complexity here.

Detection quirk worth knowing before porting: Supabase does **not** retroactively create an `'email'` identity when a password is added to an OAuth-originated account, so `getUserIdentities()` alone can't reliably answer "does this account have a password." The component works around this with a local `passwordOverride` flag that flips the UI the instant `updateUser({password})` succeeds, rather than depending on a refetch to reflect it.

**Requires Manual Linking enabled** in Supabase Dashboard → Authentication → Settings (confirmed already on for this project) — without it, `linkIdentity()` fails outright.

**Portability:** ✅ Self-contained (one new component + a 3-line import/render in the Profile client), no schema changes. Before porting, confirm Manual Linking is enabled on MyShiftX's own Supabase project — it won't work otherwise — and re-derive the connectable-provider list from whatever MyShiftX actually has configured (don't assume Google+LinkedIn match there).

---

## Since last sync (2026-08-28)

One small auth/UX fix, prompted by real users who registered but never received (or never noticed) their confirmation email and were stuck unable to log in with no way to trigger a second attempt themselves. Commit: `0668fe3` (merged to `main` at `1622684`).

### 31. Resend-verification-email flow for unconfirmed accounts

Two entry points, both calling Supabase's built-in `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo } })` — no new backend/schema, Supabase already tracks confirmation state and its own resend rate limit:

- **`/verify-email` page** (`app/(auth)/verify-email/page.tsx`): the register flow now passes the just-registered email through as a `?email=` query param (`app/(auth)/register/page.tsx`). The page shows the address back to the user and adds a "Resend Verification Email" button with a 60s client-side cooldown (separate from whatever cooldown/quota Supabase itself enforces server-side), success/error feedback, and a more explicit "check spam/junk folder" line.
- **`/login` page** (`app/(auth)/login/page.tsx`): if `signInWithPassword` fails specifically because the email isn't confirmed (`error.code === 'email_not_confirmed'`, matched with a message-text regex fallback for older/self-hosted Supabase versions that may not set `.code`), the generic error banner is replaced with an inline "your email hasn't been verified yet" banner carrying the same resend button + cooldown + spam-folder note, using the email the user just typed into the form (no session or extra round-trip needed — `resend()` works pre-session for `type: 'signup'`).

**Portability:** ✅ Trivial, self-contained, no schema or migration involved — pure client-side use of an existing Supabase Auth API. The only thing to double check on the target project: confirm Supabase's error code for an unconfirmed-email sign-in attempt is still `email_not_confirmed` on whatever supabase-js version MyShiftX pins (WDWShiftX is on `^2.108.1`); the regex fallback on the message text covers most drift, but worth a quick live test either way.

---

## Since last sync (2026-08-30)

Public user profiles, plus linkifying names throughout the app so they lead somewhere. Commit: `d66dce3` (merged to `main` at `091d0c5`).

### 32. Public user profiles + names linkified site-wide

New per-user public profile page and a matching self-service editor, following the same "click a name, land on a person" pattern most social apps have but this app didn't yet:

- **Schema** (`supabase/migrations/20260830120000_public_profile_fields.sql`): `users` gets `bio text`, `birthday_month/day/year smallint` (each independently nullable — a user can show just month+day, a full date, or nothing at all; CHECK constraints bound the ranges, no cross-validation between month/day at the DB level). New table `user_contact_methods` (`user_id`, `type`, `value`, `sort_order`) — a repeatable list rather than fixed columns, since a user can add as many phone/email/social rows as they want. `type` is a CHECK-constrained enum: `phone, email, instagram, facebook, twitter, tiktok, discord, snapchat, linkedin, other`.
- **The column-grant gotcha strikes again** (see item 24/25's notes and every migration since `20260701152710`): `users` has table-wide SELECT revoked, columns exposed one at a time via explicit `GRANT SELECT (col, ...)`. The new bio/birthday columns needed their own grant line — `GRANT SELECT (bio, birthday_month, birthday_day, birthday_year) ON public.users TO authenticated;` — deliberately **`authenticated` only, not `anon`**, since public profiles require sign-in (unlike avatar_url/email which are anon-visible). `user_contact_methods` is a brand-new table so it just gets a normal table-wide grant, no precedent to fight.
- **RLS split by concern, not by table**: `user_contact_methods` SELECT is open to any authenticated user (mirrors `users_select_authenticated`'s `(select auth.role()) = 'authenticated'` idiom); INSERT/UPDATE/DELETE is owner-only (`(select auth.uid()) = user_id`, the init-plan-wrapped form used throughout the newer migrations).
- **Editor**: a new "Public Profile" tab on the existing Profile page (`app/(dashboard)/profile/ProfileClient.tsx` — no tab primitive existed anywhere in the codebase, built a plain two-button `border-b-2` bar rather than pulling in a UI library for it), rendering `components/features/PublicProfileEditor.tsx`. Birthday is three independent `<select>`s (month/day/year, all optional). Contact methods are edited via `components/features/ContactMethodsEditor.tsx` — add/remove rows, a type dropdown, and light regex validation on Phone/Email only (socials stay freeform, e.g. "Insta @handle"). Saving contact methods does a delete-all-then-reinsert for that user rather than 3-way diffing inserts/updates/deletes — simpler and safe given the tiny row counts involved.
- **Public page**: `app/(dashboard)/users/[id]/` (page + `PublicProfileClient.tsx`) — read-only for everyone, including the owner viewing their own page (owners edit only from the Profile tab, never inline here). A deliberately "not a boring settings page" hero card (gradient banner + a couple of decorative `lucide-react` sparkle/star icons) rather than a plain form dump. **Terminology note:** an early draft used "cast member" language throughout (fits WDWShiftX's Disney-park framing) — this was deliberately generalized to plain "user" wording since it doesn't fit MyShiftX's context; if porting, grep the ported files for any leftover Disney-specific phrasing before shipping.
- **Every blank field gets an explicit note**, not silent omission — "This user hasn't shared their birthday / a bio / any contact info," per section, so a sparse profile still reads as intentional rather than broken.
- **New dependency: `react-icons`** (added to `package.json` this feature) — used only for real brand marks (Instagram/Facebook/X/TikTok/Discord/Snapchat/LinkedIn) via `react-icons/fa6`, imported per-icon (tree-shakes fine) in `lib/contactMethods.ts`. Phone/Email keep `lucide-react` icons since they aren't "brand" marks. This is the first icon dependency beyond lucide-react anywhere in the codebase — small package, but worth knowing it's now a dependency at all.
- **Linkification**: new `components/ui/UserLink.tsx` — links to the viewer's own `/profile` when the name belongs to them, otherwise `/users/[id]`; renders plain (non-linked) text when no id is available (e.g. a shift whose original poster's account no longer exists — `shifts.user_id` can be null while `created_by` is a denormalized text snapshot). Rolled out to `ShiftCard`, `RequestCard`, `CommentSection`, `TradeRecordSection`, `ClaimSection`, the messages conversation header, `AdminClient`, `AdminLeaderboard`, and `BoardsClient`'s member list. **Deliberately left unlinked**, and confirmed with the user as fine to skip: `Navbar`/`LandingHeader`'s account-menu name (it's already a dropdown trigger, not free text — nesting a link would fight the click handler), `MessageToast`/`MessagesClient`/`NotificationsClient` rows (each row is already a click target for a different action — open the conversation, start a chat, open the notification's link), and the Leader Approvals/Archive/Flags-detail-modal names (each would need a small RPC or query change to expose a real user id that isn't currently selected — judged not worth doing pre-emptively).

**Portability:** ⚠️ Real lift, but modular — schema (2 migrations' worth of pattern to replicate: new columns + grants + a new RLS-protected table), one new npm dependency, ~6 new files, and ~9 existing files touched for linkification (each a small, mechanical `UserLink` swap once you confirm that call site actually has a real user id in scope — several places in this codebase only have a denormalized display-name string, not an id, and those were skipped rather than guessed at). Before porting: (1) apply the migration and double-check the column grants against MyShiftX's own users-table grant setup (don't assume it matches WDWShiftX's `anon`/`authenticated` split); (2) decide MyShiftX's own visibility policy for public profiles (this build made it "any signed-in user can view anyone's" — a `SECURITY DEFINER` RPC would be needed instead of plain column grants if MyShiftX wants row-level scoping, e.g. "same board only"); (3) re-derive the contact-method type list/icons to whatever platforms actually make sense there; (4) re-decide the "cast member" vs "user" wording, and any other Disney-specific copy, for MyShiftX's own voice.

### 33. Custom email sender no longer reads "no-reply"

Resend's deliverability audit flagged two things on the account: the shared `EMAIL_FROM` sender used by every app-triggered email (notifications, help/support, board announcements, schedule-import reports) read `noreply@wdwshiftx.com`, and the *Supabase Auth* signup-confirmation email's verify link (`https://<project-ref>.supabase.co/auth/v1/verify?...`) doesn't match the `wdwshiftx.com` sending domain.

Only the first is a code fix: `lib/email-constants.ts`'s `EMAIL_FROM` changed from `WDWShiftX <noreply@wdwshiftx.com>` to `WDWShiftX <support@wdwshiftx.com>` — a monitored inbox that already exists (`SUPPORT_EMAIL` in the same file). The second isn't reachable from app code at all: that email is Supabase's own built-in template, sent via `supabase.auth.resend()`/the signup flow, and its verify link always points at the project's own `*.supabase.co` domain unless a **Custom Domain for Supabase Auth** is configured in the dashboard (Authentication → URL Configuration → Custom Domains — typically a paid add-on). Left unresolved here; flagged for whoever owns the Supabase project.

**Portability:** ✅ The sender-name fix is a one-line constant change, trivially portable if MyShiftX's own `EMAIL_FROM` (or equivalent) also uses a `noreply@` address. The custom-domain gap is project-specific dashboard config, not something to port — check whether MyShiftX's Supabase project already has a custom Auth domain set up before assuming it has the same Resend warning.

---

## Summary table

| # | Feature | Area | Portability |
|---|---|---|---|
| 1 | Type filter (Trade/Giveaway) | Wall | ✅ |
| 2 | Days filter | Wall | ✅ |
| 3 | Filter panel layout rework | Wall | ✅ (pairs with 1–2) |
| 4 | MNSSHP/HHN/MVMCP badges | Wall/Calendar | ⚠️ WDW-specific |
| 5 | "I Can Help" rename | Wall | ✅ trivial |
| 6 | Requests match Offers layout | Wall | ✅ |
| 7 | Calendar color-coding + dot split | Calendar | ✅ |
| 8 | Special-event badges on Calendar | Calendar | ⚠️ WDW-specific (=4) |
| 9 | Help Legend section | Help | ✅ (build to your feature set) |
| 10 | Tour launch cards | Help | ✅ (needs 11) |
| 11 | Guided Product Tour | Cross-cutting | ✅ biggest lift |
| 12 | Push on comment posted | Notifications | ✅ |
| 13 | Full "First Last" display names | Auth/Profile | ⚠️ optional, decide first |
| 14 | Display-name copy update | Auth/Profile | ✅ (needs 13) |
| 15 | first_name/last_name columns | Database | ✅ decoupled from 13 |
| 16 | Board-less user detection | Admin | ✅ |
| 17 | Admin panel overhaul + board soft-delete | Admin | ✅ largest scope |
| 18 | Admin: assign user to board | Admin | ✅ |
| 19 | Weekly digest removal | Infra | ⚠️ optional, WDW-specific |
| 20 | Wall post sharing (native share sheet) | Wall | ✅ redo the color-matching technique, not just the code |
| 21 | Request form Board-field reorder | Wall | ✅ trivial |
| 22 | Poster-name resize + reflow (avatar prep) | Wall | ✅ sequence as prep-then-feature |
| 23 | Mobile card spacing tightened | Wall | ✅ trivial |
| 24 | Profile picture upload (Storage + crop + compress) | Profile | ✅ redo the Storage bucket/RLS against your own project |
| 25 | Avatar component + rollout everywhere | Wall/Profile/Comments/Messages/Boards/Admin | ✅ watch the SECURITY DEFINER RPC grant-reissue gotcha |
| 26 | Avatar fallback: single letter + contrast fix | Avatar component | ⚠️ re-measure contrast against your own theme, don't copy the fix verbatim |
| 27 | Overlord panel: Clear Filters (Boards + Users tabs) | Admin | ✅ trivial |
| 28 | Overlord Users tab: inactive users excluded from default view | Admin | ✅ check if the bug even exists there first |
| 29 | Notifications page + Mod/Admin board announcements | Notifications/Admin | ✅ largest lift after 11/17; not yet verified end-to-end |
| 30 | Profile: Account Security (add password / connect-disconnect OAuth) | Profile/Auth | ✅ requires Manual Linking enabled on target project |
| 31 | Resend-verification-email flow (verify-email page + login banner) | Auth | ✅ trivial, no schema |
| 32 | Public user profiles + names linkified site-wide | Profile/Cross-cutting | ⚠️ real lift, modular — new table/columns/dependency, decide visibility scope first |
| 33 | Email sender fix (drop "no-reply") | Infra/Auth | ✅ one-line constant change; Supabase Auth link-domain gap not portable (dashboard config) |

---

**Next step:** tell me which numbers you want (e.g. "1, 2, 3, 6, 9, 11, 12, 16, 18, 20, 21, 22, 23, 24, 25, 26"), and I'll turn your picks into a task list document, same format as the security-fix one, before we start porting.
