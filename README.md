# WDWShiftX

> A dedicated bulletin board for Walt Disney World Cast Members to trade shifts, give away shifts, and post shift requests.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRD Version](https://img.shields.io/badge/PRD-v2.0-green.svg)](docs/PRD.md)

**⚠️ Disclaimer:** WDWShiftX is not affiliated with, authorized by, or endorsed by The Walt Disney Company.

---

## Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Tech Stack](#tech-stack)
- [Key Features](#key-features)
- [User Roles](#user-roles)
- [Getting Started](#getting-started)
- [Development](#development)
- [Database Schema](#database-schema)
- [Security & Privacy](#security--privacy)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

WDWShiftX replaces the chaos of Facebook groups with a structured, secure platform where Walt Disney World Cast Members can:

- **Trade shifts** with qualified peers
- **Give away shifts** they can't work
- **Request specific shifts** from others
- **Filter by proficiency** to see only relevant opportunities

Built as a Progressive Web App (PWA) for mobile-first access during breaks, with role-based permissions to ensure trust and accountability.

---

## The Problem

Cast Members currently rely on Facebook groups to coordinate shift trades, which creates:

- **Noise:** Hundreds of unrelated posts make finding relevant shifts difficult
- **Security risks:** No verification of Cast Member status
- **No structure:** Posts lack standardized formatting, making filtering impossible
- **Ghosting:** People claim shifts but don't follow through, with no accountability

---

## The Solution

WDWShiftX provides:

1. **Structured Data:** Every post follows a consistent format (Property → Location → Role → DateTime)
2. **Smart Filtering:** Users only see shifts they're qualified for based on saved proficiencies
3. **Verification:** HubID + PERNER validation ensures only active Cast Members can register
4. **Role-Based Moderation:** Copros, Leaders, and Admins maintain platform integrity
5. **Audit Trails:** Soft deletes and flag systems provide accountability

---

## Tech Stack

- **Frontend:** Next.js 14+ (App Router), React, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **Deployment:** Vercel (serverless functions for elastic scaling)
- **Target:** Progressive Web App (installable on iOS, Android, desktop)

---

## Key Features

### 🔄 Shift Board (Offers)
- Auto-filtered by user proficiencies
- Badges: Trade, Giveaway, Overtime Approved
- Auto-expires 30 minutes before shift start
- Edit/deactivate your own posts

### 📋 Request Board
- Post shift requests by date and time preference
- Sorted by urgency and specificity
- Auto-expires at end of requested date

### 🔐 Security & Verification
- HubID + PERNER validation (never stored)
- Email verification required
- Auto-promotion to Copro for @disney.com emails
- Inactivity management (3-month warning, 5-month deactivation)

### 🎯 Proficiency System
- 3-tier hierarchy: Property → Location → Role
- User suggestions with Leader approval queue
- Only see shifts you're qualified for

### 🚩 Moderation & Flagging
- Flag inappropriate posts or profiles
- Leaders see flags filtered by their proficiencies
- Audit trail for HR/legal documentation
- Soft deletes preserve accountability

### 📱 Mobile-First Design
- WCAG 2.1 AA compliant (7:1 contrast, 44x44px touch targets)
- Optimized for Saturday night traffic spikes (23:30–02:00 ET)
- Responsive across phones, tablets, desktops

---

## User Roles

| Role | Permissions |
|------|-------------|
| **Guest** | View landing page, login, register |
| **Cast** | View/filter boards, post shifts/requests, edit profile |
| **Copro** | Cast permissions + CRUD all posts, flag users, deactivate other Copros |
| **Leader** | Copro permissions + approve suggestions, manage flags, access archives |
| **Admin** | Full system control, manage Properties, assign Leader permissions |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- Supabase account
- Vercel account (for deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/wdwshiftx.git
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
├── app/                  # Next.js App Router pages
│   ├── (auth)/          # Auth-related routes
│   ├── (dashboard)/     # Protected app routes
│   └── api/             # API routes
├── components/          # React components
│   ├── ui/              # Reusable UI components
│   └── features/        # Feature-specific components
├── lib/                 # Utilities and helpers
│   ├── supabase/        # Supabase client and queries
│   └── validations/     # Zod schemas
├── public/              # Static assets
└── supabase/            # Database migrations and types
```

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler
npm run db:migrate   # Run database migrations
npm run db:reset     # Reset database (dev only)
```

---

## Database Schema

### Core Tables

- **users** - User accounts with RBAC
- **properties** - Top-level locations (Magic Kingdom, EPCOT, etc.)
- **locations** - Specific areas within properties
- **roles** - Job functions
- **user_proficiencies** - User's qualified Property/Location/Role combinations
- **shifts** - Shift offers (trades/giveaways)
- **requests** - Shift requests
- **flags** - Moderation flags

See [PRD Section 9](docs/PRD.md#9-database-schema) for full schema definitions.

### Key Design Decisions

- **Soft Deletes:** `is_active` flags preserve audit trails
- **Orphaned Posts:** Deactivated users leave posts intact with `created_by` name
- **Generated Columns:** `expires_at` auto-calculated for shifts and requests
- **Foreign Key Cascades:** Carefully designed to prevent data loss while maintaining referential integrity

---

## Security & Privacy

### What We Store
- Display name, email, phone (optional), proficiencies
- Shift/request posts, flags, edit history

### What We DON'T Store
- **HubID** - Used only for registration validation, immediately discarded
- **PERNER** - Used only for registration validation, immediately discarded
- Passwords (only bcrypt/Argon2 hashes)

### Security Measures
- Email verification required
- Rate limiting on posts, flags, and API calls
- Row-Level Security (RLS) policies in Supabase
- HTTPS only
- Auto-logout on role changes

---

## Roadmap

### Phase 1: Alpha (Current)
- [x] PRD finalized
- [ ] Database schema implementation
- [ ] Authentication flow
- [ ] Basic shift board UI
- [ ] Proficiency system

### Phase 2: Beta
- [ ] Moderation tools
- [ ] Archive/history access
- [ ] Flag management
- [ ] Invite-only launch (3 properties)

### Phase 3: Public Launch
- [ ] Full property rollout
- [ ] Performance optimization
- [ ] Marketing to CM communities
- [ ] 500+ verified Cast Members

### Future Enhancements
- Automated shift matching (AI-powered)
- Push notifications
- Analytics dashboard for Leaders
- Multi-language support (Spanish, Portuguese)

See [PRD Section 11](docs/PRD.md#11-future-enhancements) for full roadmap.

---

## Contributing

This is currently a solo project, but contributions are welcome once the alpha is stable.

### Guidelines
- Follow existing code style (Prettier + ESLint configs)
- Write tests for new features
- Update documentation for API changes
- Keep PRD and README in sync

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built with ❤️ for the Cast Member community.

Special thanks to all Cast Members who provided feedback on the Facebook group pain points.

---

## Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/wdwshiftx/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/wdwshiftx/discussions)
- **Feedback:** Use the thumbs down button in-app to report bugs or suggest features

---

**Remember:** Always verify shift trades and OT approval in Disney's official HUB system. WDWShiftX is a bulletin board only—final execution is your responsibility.
