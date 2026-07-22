# WDWShiftX

> A private, invite-only bulletin board for trading shifts, giving away shifts, and posting shift requests.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.7.0--beta-orange.svg)](package.json)

**Status:** Beta — core product (auth, boards, wall, moderation, notifications, calendar sync, in-app messaging) is feature-complete. Monetization (Stripe checkout) and legal/business formation are still in progress ahead of public launch (`1.0.0`). See [TASKS.md](TASKS.md) for the full breakdown.

**⚠️ Disclaimer:** WDWShiftX is an independent platform and is not affiliated with, sponsored by, or endorsed by any specific employer.

---

## Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Tech Stack](#tech-stack)
- [Key Features](#key-features)
- [Roles](#roles)
- [Getting Started](#getting-started)
- [Development](#development)
- [Database Schema](#database-schema)
- [Security & Privacy](#security--privacy)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

WDWShiftX replaces the chaos of Facebook groups with a structured, secure platform organized around **invite-only boards**. Users join boards with a code, then post and browse shifts scoped to only the boards they belong to.

- **Trade shifts** with trusted peers on your boards
- **Give away shifts** you can't work
- **Request specific shifts** on a request section
- **Stay scoped** — only see posts from boards you've joined

Built as a Progressive Web App (PWA) for mobile-first access, with board-level moderation to ensure trust and accountability.

---

## The Problem

Users currently rely on Facebook groups to coordinate shift trades, which creates:

- **Noise:** Hundreds of unrelated posts make finding relevant shifts difficult
- **Security risks:** No verification of user status or group membership
- **No structure:** Posts lack standardized formatting, making filtering impossible
- **Ghosting:** People claim shifts but don't follow through, with no accountability

---

## The Solution

WDWShiftX provides:

1. **Board-Based Access:** Users join private boards via invite codes — posts are scoped to your boards only
2. **The Wall:** A unified, filterable feed of all shifts and requests across your boards
3. **Verification:** Email verification ensures only active users can register
4. **Two-Level Role System:** Platform-level Global Roles + per-board Board Roles for layered moderation
5. **Audit Trails:** Soft deletes and flag systems provide accountability

---

## Tech Stack

- **Frontend:** Next.js 14+ (App Router), React, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Row-Level Security)
- **Deployment:** Vercel (serverless functions for elastic scaling)
- **Target:** Progressive Web App (installable on iOS, Android, desktop)

---

## Key Features

### 🏠 The Wall
- Unified feed of shift offers and requests across all your boards
- Filter by board, date, keyword, or your own posts
- Posts auto-expire before shift start time

### 🔄 Shift Posts (Offers)
- Badges: Trade, Giveaway, Overtime Approved
- Auto-expires 30 minutes before shift start
- Edit/deactivate your own posts

### 📋 Request Posts
- Post shift requests by date and time preference
- Auto-expires at end of requested date

### 🏷️ Board System
- Private boards joined via 7-character invite codes
- Leaders create boards and manage invite codes (pause/resume, regenerate)
- Users can leave boards; Leaders can delete boards
- Pending join requests shown to Mods/Leaders for approval
- Join attempt rate limiting: 5 attempts/minute, 15 failures/24h → account deactivation

### 🚩 Moderation & Flagging
- Flag inappropriate posts or profiles
- Mods/Leaders see flags and manage them per board
- Audit trail for documentation
- Soft deletes preserve accountability

### 📱 Mobile-First Design
- WCAG 2.1 AA compliant (7:1 contrast, 44×44px touch targets)
- Responsive across phones, tablets, desktops

---

## Roles

WDWShiftX uses two independent role systems.

> **Naming note:** the labels below are what users see as of 2026-07-18. Internally
> (DB values, RLS policies, route paths, code) the board "Admin" is still stored as
> `Leader` and the global "Overlord" as `Admin` — the display mapping lives in
> `lib/roles.ts`.

### Global Roles (platform-wide)

| Role | Permissions |
|------|-------------|
| **Guest** | View landing page, login, register |
| **User** | Join boards, view The Wall, post shifts/requests, manage profile |
| **Overlord** (stored as `Admin`) | Full platform control — manage users, boards, and global settings |

### Board Roles (per-board)

| Role | Permissions |
|------|-------------|
| **User** | View and post on the board |
| **Mod** | User permissions + moderate posts, manage flags and approvals |
| **Admin** (stored as `Leader`) | Mod permissions + manage invite code, rename board, delete board, promote/demote members |

Board roles are independent of Global Roles. A platform User can be a board Admin on one board and a Mod on another.

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Vercel account (for deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/ace-d-baugh/wdwshiftx.git
cd wdwshiftx

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase URL and anon key

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

Visit `http://localhost:3000` to see the app.

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Development

### Project Structure

```
wdwshiftx/
├── app/                      # Next.js App Router pages
│   ├── (auth)/               # Auth routes (login, register, etc.)
│   ├── (dashboard)/          # Protected app routes
│   │   ├── wall/             # The Wall — main feed + new post forms
│   │   ├── profile/          # Profile + My Boards management
│   │   ├── leader/           # Mod/Leader tools (approvals, flags, archive)
│   │   └── admin/            # Admin panel (users, boards)
│   └── actions/              # Server actions (boards, shifts, requests)
├── components/               # React components
│   ├── ui/                   # Reusable UI primitives
│   └── features/             # Feature-specific components
├── lib/                      # Utilities and helpers
│   ├── supabase/             # Supabase client setup
│   └── validations/          # Zod schemas
├── public/                   # Static assets
└── supabase/                 # Database migrations
```

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler
npm run db:migrate   # Push migrations to remote Supabase
npm run db:reset     # Reset local database (dev only)
```

---

## Database Schema

### Core Tables

- **users** — User accounts with global role (`Guest | User | Admin`) and active status
- **boards** — Private boards with name, invite code, and enabled flag
- **user_boards** — Board membership with per-board role (`User | Mod | Leader`) and approval status
- **board_join_attempts** — Rate-limiting log for invite code attempts
- **shifts** — Shift offers (trades/giveaways), scoped to a board
- **requests** — Shift requests, scoped to a board
- **comments** — Comments on shifts and requests
- **flags** — Moderation flags on posts/profiles, scoped to a board

### Key Design Decisions

- **Soft Deletes:** `is_active` flags preserve audit trails on posts and comments
- **RLS via SECURITY DEFINER helpers:** `is_board_member()`, `is_board_moderator()`, `is_board_leader()`, and `is_any_board_moderator()` prevent RLS recursion while enforcing board-scoped access
- **Invite Code Format:** 7-character alphanumeric using an unambiguous charset (no O/0, I/1 confusion)
- **Generated Columns:** `expires_at` auto-calculated for shifts and requests

---

## Security & Privacy

### What We Store
- Display name, email, phone (optional)
- Board memberships and roles
- Shift/request posts, comments, flags

### What We DON'T Store
- Passwords (Supabase Auth handles hashing)

### Security Measures
- Email verification required before accessing the app
- Invite code rate limiting (DB-backed, 24-hour rolling window)
- Row-Level Security (RLS) on all tables — board membership enforced at the database level
- HTTPS only
- Server Actions for all mutations (no exposed REST endpoints for writes)

---

## Roadmap

### Phase 1: Alpha (Current)
- [x] Authentication flow (register, verify, login, reset password)
- [x] Board system (create, join, leave, manage invite codes)
- [x] The Wall — unified shift/request feed with filtering
- [x] Post shift offers and requests scoped to boards
- [x] Board-level moderation (approvals, flags, archive)
- [x] Admin panel (manage users and boards)
- [x] PWA support

### Phase 2: Beta
- [ ] Invite-only launch
- [ ] Push notifications
- [ ] Trade loop — claim a shift, owner confirms, completion tracked (reliability records that solve ghosting)
- [ ] Schedule-first onboarding — photo schedule import in the first session, so the app is useful solo on day one
- [ ] iOS push via guided Add-to-Home-Screen install flow
- [ ] Performance optimization and monitoring

### Phase 3: Public Launch
- [ ] Broader rollout
- [ ] Marketing to shift-trading communities ("N shifts covered on WDWShiftX" as the proof point)
- [ ] 500+ verified users

### Future Enhancements
- Automated shift matching
- Weekly board-activity digest emails
- Product analytics & error tracking (PostHog / Sentry — under discussion)
- Analytics dashboard for Leaders
- Multi-language support (Spanish, Portuguese)

---

## Contributing

This is currently a solo project, but contributions are welcome once the alpha is stable.

### Guidelines
- Follow existing code style (Prettier + ESLint configs)
- Write tests for new features
- Update documentation for API changes

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Support

- **Issues:** [GitHub Issues](https://github.com/ace-d-baugh/wdwshiftx/issues)
- **Discussions:** [GitHub Discussions](https://github.com/ace-d-baugh/wdwshiftx/discussions)

---

**Remember:** Always verify shift trades and OT approval on your employer's official scheduling pages. WDWShiftX is a bulletin board only — communication and final execution are your responsibility.
