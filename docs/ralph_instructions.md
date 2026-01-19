# Ralph Agent Instructions

**Agent Name:** Ralph (or any AI coding assistant)  
**Project:** WDWShiftX  
**Last Updated:** January 19, 2026

---

## Quick Start for Ralph

Hey Ralph! You're working on WDWShiftX, a shift-trading PWA for Disney Cast Members. Here's everything you need to know.

---

## Core Documents to Read First

1. **docs/wdwshiftx_prd.md** - Complete product requirements (read sections 1-9 minimum)
2. **docs/wdwshiftx_progress.md** - Your task list and status tracker
3. **design-tokens.md** - Design system (colors, fonts, accessibility)
4. **README.md** - Project overview and tech stack

---

## Your Primary Responsibilities

1. **Update Progress Document** - After completing any task, update `docs/wdwshiftx_progress.md` with:
   - Changed emoji (📋 → 🚧 → ✅)
   - Date completed
   - Any blockers encountered
   - Notes on implementation decisions

2. **Follow PRD Exactly** - Don't deviate from PRD specs without explicit approval from Ace

3. **Maintain Code Quality**
   - Run `npm run lint` before committing
   - Run `npm run type-check` to catch TypeScript errors
   - Follow existing code patterns in the repo

4. **Security First**
   - Never store HubID or PERNER in database
   - Always validate user permissions (RBAC)
   - Use Supabase RLS policies, not just application-level checks
   - Sanitize all user inputs

---

## Critical Rules (DO NOT VIOLATE)

### ❌ NEVER Do These Things:
- Store HubID or PERNER in any database table
- Skip email verification requirements
- Bypass RBAC permission checks
- Use localStorage/sessionStorage (not supported in some contexts)
- Suggest Disney affiliation or use Disney trademarks
- Hard delete records (always soft delete with `is_active = false`)
- Ignore timezone handling (all times must be ET)

### ✅ ALWAYS Do These Things:
- Reference PRD Section 9 for database schema questions
- Test with different user roles (Guest, Cast, Copro, Leader, Admin)
- Handle mobile-first (phones are primary use case)
- Follow WCAG 2.1 AA standards (7:1 contrast, 44px touch targets)
- Document any PRD deviations in progress notes
- Ask Ace before making architectural decisions

---

## Tech Stack Quick Reference

- **Frontend:** Next.js 14+ (App Router), React 18+, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- **Deployment:** Vercel (serverless)
- **State Management:** React hooks, Supabase client
- **Forms:** Zod validation
- **Dates:** date-fns with date-fns-tz (ET timezone)
- **Icons:** Lucide React

---

## Database Schema Quick Reference

### Key Tables (see PRD Section 9 for full definitions)

```
users
├── id (UUID, PK)
├── display_name (TEXT) - format: "FirstName LastInitial."
├── email (TEXT, UNIQUE)
├── role (TEXT) - guest|cast|copro|leader|admin
└── is_active (BOOLEAN) - for soft deletes

properties → locations → roles
         ↓
   user_proficiencies (junction table)

shifts (offers)
├── created_by (TEXT) - preserved username
├── user_id (UUID, FK, nullable) - for orphaned posts
├── expires_at (GENERATED) - start_time - 30min
└── is_active (BOOLEAN)

requests
├── preferred_times (TEXT[]) - morning|afternoon|evening|late
├── expires_at (GENERATED) - requested_date 23:59 ET
└── is_active (BOOLEAN)

flags
├── target_type (TEXT) - post|user
├── status (TEXT) - pending|resolved|dismissed
└── created_at (TIMESTAMPTZ)
```

---

## Common Task Patterns

### Creating a New Feature
1. Check `docs/wdwshiftx_progress.md` for task details
2. Read relevant PRD section
3. Implement with tests (if applicable)
4. Update progress document with ✅
5. Add notes about any decisions made

### Database Migrations
```bash
# Create new migration
supabase migration new migration_name

# Apply migrations
npm run db:migrate

# Reset database (dev only)
npm run db:reset
```

### Testing RBAC
- Create test users with different roles
- Verify permissions at both RLS and application level
- Test edge cases (deactivated users, role changes)

### Handling Timezones
```typescript
// ALWAYS use date-fns-tz for ET timezone
import { formatInTimeZone } from 'date-fns-tz'

const etTime = formatInTimeZone(
  date,
  'America/New_York',
  'yyyy-MM-dd HH:mm:ss'
)
```

---

## Validation Patterns

### HubID Validation
```typescript
const hubIdRegex = /^[a-zA-Z]{5}\d{3}$/
// Valid: BAUGM007, SMITH123
// Invalid: BAU007, BAUGH0007, 12345678
```

### PERNER Validation
```typescript
const pernerRegex = /^\d{8}$/
// Valid: 00511062, 12345678
// Invalid: 511062, 123456789, ABC12345
```

### Display Name Format
```typescript
// Format: "FirstName LastInitial."
// Valid: "Matthew B.", "Sarah J."
// Invalid: "Matt", "Matthew Baugh", "M.B."
```

---

## Error Handling Patterns

### Supabase Queries
```typescript
const { data, error } = await supabase
  .from('shifts')
  .select('*')
  .eq('is_active', true)

if (error) {
  console.error('Database error:', error)
  // Handle gracefully, show user-friendly message
  return { success: false, message: 'Failed to load shifts' }
}
```

### Form Validation (Zod)
```typescript
import { z } from 'zod'

const shiftSchema = z.object({
  shift_title: z.string().min(1),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
}).refine(data => new Date(data.end_time) > new Date(data.start_time), {
  message: 'End time must be after start time'
})
```

---

## Rate Limiting Implementation

**From PRD Section 6:**
- POST /shifts: 28/24hrs per user (14 offers + 14 requests)
- POST /proficiency-suggestion: 10/24hrs per user
- POST /flag: 20/24hrs per user
- General API: 1000 req/15min per IP
- Login: 5 attempts/15min per email

Implement using Vercel Edge Middleware or Supabase Edge Functions + Upstash Redis.

---

## Security Checklist for Every Feature

- [ ] Input validation (Zod schemas)
- [ ] XSS prevention (sanitize user content)
- [ ] CSRF protection (Next.js handles this)
- [ ] Rate limiting applied
- [ ] RLS policies tested
- [ ] Permission checks at application level
- [ ] Soft deletes instead of hard deletes
- [ ] Audit trail for sensitive actions
- [ ] No PII in logs

---

## When You're Stuck

1. **Re-read the relevant PRD section** - 90% of questions are answered there
2. **Check the progress document** - See if there are notes from previous work
3. **Review existing code patterns** - Follow established conventions
4. **Ask Ace** - If PRD is unclear or you need to deviate from spec

---

## Progress Update Template

When updating `docs/wdwshiftx_progress.md`, use this format:

```markdown
### [Section Name]
- ✅ Task description
- 🚧 Task in progress
- ⏳ Blocked task
- 📋 Not started task

**Notes:**
- [Date] Completed X. Used Y approach because Z.
- [Date] Blocker: Need clarification on [topic]
```

---

## Common Gotchas

1. **Orphaned Posts** - When user is deactivated, `user_id` becomes NULL but `created_by` (TEXT) preserves username
2. **Email Changes** - Auto-promote to Copro if new email is @disney.com, auto-demote if changing from @disney.com
3. **Soft Deletes** - Check `is_active = true` in ALL queries, not just RLS
4. **Expiration Logic** - Cron jobs handle this, not application logic
5. **Timezone** - Server uses ET for all datetime operations

---

## Testing Checklist

Before marking any feature as complete (✅):

- [ ] Works on mobile (responsive)
- [ ] WCAG 2.1 AA compliant (contrast, touch targets)
- [ ] All user roles tested (Guest, Cast, Copro, Leader, Admin)
- [ ] Edge cases handled (empty states, errors, loading)
- [ ] Rate limits enforced
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] Linter passes (`npm run lint`)

---

## Your First Tasks

Ralph, start here:

1. Read PRD sections 1-9 (30 min read)
2. Read design-tokens.md
3. Set up local development environment
4. Create Supabase project
5. Begin Phase 1: Database Schema Implementation

Update `docs/wdwshiftx_progress.md` as you go!

---

**Remember:** You're building for Cast Members who work long shifts and need quick, reliable shift trades. Mobile-first, security-first, user-first. Let's build something they'll love.

Good luck, Ralph! 🚀