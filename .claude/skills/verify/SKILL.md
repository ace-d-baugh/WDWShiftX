---
name: verify
description: Build/launch/drive recipe for verifying WDWShiftX changes end-to-end in the running app.
---

# Verifying WDWShiftX

Next.js 14 app, Supabase backend (project `tsnwmbdedatkajyxyvcp` — this is PRODUCTION; there is no staging DB, `.env.local` points at it).

## Launch

```bash
npx next dev -p 3111   # run in background; ready in ~1s, serves http://localhost:3111
```

Stopping the background task leaves an orphaned node child holding the port (EADDRINUSE on restart) — find it with `Get-NetTCPConnection -LocalPort 3111 -State Listen` and Stop-Process it.

## Drive

Playwright is available via `@playwright/test` in node_modules (bundled Chromium works for everything except Web Push — see the push memory). From a script outside the repo, require it by absolute path:

```js
const { chromium } = require('Z:/02_Projects/03_Code/WDWShiftX/node_modules/@playwright/test')
```

Gotchas:
- **Hydration**: after `goto`, wait ~1s before clicking — server HTML renders buttons before React attaches handlers, and pre-hydration clicks are silently lost.
- `text=Site Settings` on /profile is ambiguous (a notifications warning also matches); use `getByRole('heading', { name: ... })`.

## Auth (no seeded test creds, email confirmation required)

Create a disposable confirmed user directly in Supabase, log in via the /login form (`#email`, `input[type="password"]`, `button[type="submit"]`), delete afterward:

- INSERT into `auth.users` (instance_id `00000000-...`, aud/role `authenticated`, `crypt(pw, gen_salt('bf'))`, `email_confirmed_at now()`) **plus** a matching `auth.identities` row (provider `email`, `provider_id` = user id).
- **Must** set the token columns (`confirmation_token`, `recovery_token`, `email_change*`, `phone_change*`, `reauthentication_token`) to `''` not NULL, or GoTrue returns 500 on login.
- Triggers auto-provision `public.users`; set `membership`/`role` there for tier-gated features.
- Cleanup: DELETE from `auth.users` cascades to `user_preferences` but **not** `public.users` — delete that row explicitly.

## CSS gotcha

Class-based rules added inside `@layer base/components/utilities` in `app/globals.css` are tree-shaken unless the class name appears **literally** in files under `app/`, `components/`, or `pages/` (`lib/` is not scanned). Runtime-composed classes (e.g. `'theme-'+id`) must live in unlayered CSS.
