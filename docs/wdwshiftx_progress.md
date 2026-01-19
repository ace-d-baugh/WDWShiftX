# WDWShiftX Development Progress

**Last Updated:** January 19, 2026  
**Project Lead:** Ace Baugh  
**Status:** Implementation Phase - Alpha

---

## How to Use This File

- ✅ = Completed
- 🚧 = In Progress
- ⏳ = Blocked/Waiting
- 📋 = Not Started
- ❌ = Cancelled/Deprecated

**For AI Agents:** Update status emojis and add notes under each task. Include date, blocker details, or completion notes as needed.

---

## Phase 0: Foundation Setup

### Project Infrastructure
- ✅ PRD finalized (v2.1)
- ✅ Design system established (Lato + Philosopher fonts, color palette)
- ✅ Tailwind config created
- ✅ Next.js project structure initialized
- ✅ MIT License added
- ✅ README.md created
- 📋 Environment variables documented (.env.example)
- 📋 Supabase project created
- 📋 Vercel deployment pipeline configured

**Notes:**
- Design tokens finalized January 19, 2026
- Fonts: Lato (body), Philosopher (headings)
- Primary color: #BD80FF

---

## Phase 1: Database & Backend (Alpha Priority)

### Database Schema Implementation
- 📋 Create `users` table with RBAC fields
- 📋 Create `properties` table (seed with MK, EPCOT, AK, Resorts)
- 📋 Create `locations` table with approval workflow
- 📋 Create `roles` table with approval workflow
- 📋 Create `user_proficiencies` junction table
- 📋 Create `shifts` table with expiration logic
- 📋 Create `requests` table with expiration logic
- 📋 Create `flags` table for moderation
- 📋 Create `black_listed` table for banned emails
- 📋 Add indexes per PRD Section 6
- 📋 Set up foreign key constraints

**Blockers:**
- None currently

**Notes:**
- Reference PRD Section 9 for exact schema definitions
- Use `gen_random_uuid()` for all primary keys
- All timestamps should be `TIMESTAMPTZ` for ET timezone handling

---

### Row-Level Security (RLS) Policies
- 📋 `users` - Users can read own profile, Leaders can read all
- 📋 `shifts` - Read: all authenticated; Write: own posts only
- 📋 `requests` - Read: all authenticated; Write: own posts only
- 📋 `flags` - Read: Leaders filtered by proficiency; Write: Cast+
- 📋 `user_proficiencies` - Read: own; Write: own
- 📋 `locations` - Read: all; Write: Admin only (except suggestions)
- 📋 `roles` - Read: all; Write: Admin only (except suggestions)
- 📋 `properties` - Read: all; Write: Admin only
- 📋 `black_listed` - Read: none; Write: system only

**Notes:**
- Test RLS with different role levels before moving to auth
- Ensure soft deletes (`is_active = false`) respected in policies

---

### Database Triggers & Functions
- 📋 Auto-expire shifts (cron job: 30min before `start_time`)
- 📋 Auto-expire requests (cron job: 23:59 ET on `requested_date`)
- 📋 Auto-promote to Copro on @disney.com email verification
- 📋 Auto-demote from Copro/Leader on email change to non-Disney
- 📋 Increment `black_listed.failed_attempts` on registration failure
- 📋 Block registration if email in `black_listed` with `blocked = true`
- 📋 Update `users.updated_at` on profile changes

**Notes:**
- Use Supabase cron jobs (pg_cron) for expiration
- Email promotion/demotion should trigger re-login

---

## Phase 2: Authentication & User Management

### Registration Flow
- 📋 Build registration form UI (Email, Password, HubID, PERNER)
- 📋 HubID validation regex: `/^[a-zA-Z]{5}\d{3}$/`
- 📋 PERNER validation regex: `/^\d{8}$/`
- 📋 Check email against `black_listed` table
- 📋 Hash password (bcrypt/Argon2)
- 📋 Create user with `email_verified = false`
- 📋 Send email verification link
- 📋 Handle 5 failed attempts → add to `black_listed`
- 📋 Terms & Conditions checkbox (required)
- 📋 T&C modal/page content

**Blockers:**
- None currently

**Notes:**
- HubID and PERNER NEVER stored in database
- Failed registration shows warning: "HubID or PERNER or both are not correct..."

---

### Login & Session Management
- 📋 Login form UI (Email, Password)
- 📋 Supabase Auth integration
- 📋 Rate limit: 5 attempts per 15min per email
- 📋 Session persistence across page refreshes
- 📋 Auto-logout on role change (promotion/demotion)
- 📋 Password reset flow (forgot password)
- 📋 Email verification enforcement (redirect unverified users)

**Notes:**
- Use Supabase Auth built-in rate limiting where possible
- Store role in JWT claims for RLS

---

### Profile Management
- 📋 Display name editor (format: "FirstName LastInitial.")
- 📋 Email change flow with new email verification
- 📋 Phone number field (optional)
- 📋 Notification preferences (email/SMS toggles)
- 📋 Proficiency multi-select UI (Property → Location → Role)
- 📋 Warning modal for @disney.com → non-Disney email change
- 📋 Account deactivation (user-initiated)

**Notes:**
- Email change requires re-login after verification
- Deactivated accounts: posts become orphaned

---

## Phase 3: Core Features - Shift Board

### Shift Board UI (Offers)
- 📋 Dynamic filter by user proficiencies
- 📋 Sorting: `start_time` ASC, then `created_at` DESC
- 📋 Badge display: Trade, Giveaway, OT Approved
- 📋 Shift card component (display all fields)
- 📋 Contact poster button (phone/email)
- 📋 Edit button (own posts, while `is_active = true`)
- 📋 Deactivate button (own posts)
- 📋 Expired shifts hidden from board
- 📋 Tab toggle: Offers / Requests

**Notes:**
- Use Supabase Realtime for live updates (nice-to-have)
- OT badge shows legal disclaimer tooltip

---

### Posting Form (Offers)
- 📋 Shift title dropdown (from user's proficiencies)
- 📋 Property/Location/Role selectors (filtered by proficiency)
- 📋 Start DateTime picker (ET timezone)
- 📋 End DateTime picker (ET timezone)
- 📋 Trade checkbox
- 📋 Giveaway checkbox (at least one required)
- 📋 OT Approved checkbox (optional)
- 📋 Comments textarea (optional)
- 📋 Conflict warning (overlapping existing posts)
- 📋 Rate limit enforcement (14 offers/24hrs)
- 📋 Validation: end_time > start_time

**Notes:**
- DateTime pickers must handle ET timezone explicitly
- Conflict check queries own active posts

---

## Phase 4: Core Features - Request Board

### Request Board UI
- 📋 Dynamic filter by user proficiencies
- 📋 Sorting: `requested_date` ASC, time slot specificity, `created_at` DESC
- 📋 Request card component (all fields)
- 📋 Contact poster button
- 📋 Edit/deactivate buttons (own requests)
- 📋 Expired requests hidden

**Notes:**
- Time slot specificity sorting: see PRD Section 5.B for order
- No automated matching in Alpha

---

### Posting Form (Requests)
- 📋 Property/Location/Role selectors
- 📋 Requested date picker (single date)
- 📋 Preferred times multi-select (Morning, Afternoon, Evening, Late)
- 📋 Comments textarea (optional)
- 📋 Rate limit enforcement (14 requests/24hrs)
- 📋 Validation: at least one time slot selected

---

## Phase 5: Proficiency System

### User Suggestions
- 📋 "Suggest New Location" button (on posting form)
- 📋 "Suggest New Role" button (on posting form)
- 📋 Suggestion form modal (name, property for locations)
- 📋 Add suggestion to `locations`/`roles` with `is_approved = false`
- 📋 Immediately add to suggester's proficiencies
- 📋 Make suggestion available to all users (before approval)

**Notes:**
- Suggestions go into pending queue for Leaders

---

### Leader Approval Queue
- 📋 Queue page (Leaders only)
- 📋 Badge notification on login (pending count)
- 📋 Filter by submission timestamp
- 📋 Approve button → `is_approved = true`, set `approved_by_user_id`
- 📋 Reject button → delete suggestion system-wide
- 📋 Display suggester name

**Notes:**
- Rejected suggestions remove from all user proficiencies
- Queue sorted by `created_at` ASC

---

## Phase 6: Moderation & Flagging

### Flagging System
- 📋 Flag button on posts (shift/request cards)
- 📋 Flag button on user profiles
- 📋 Flag modal with reason dropdown + comments
- 📋 Rate limit: 20 flags/24hrs per user
- 📋 Flag enters `pending` status
- 📋 Flagged content remains visible

**Notes:**
- Flag reasons: Fake post, Inappropriate, Posting for others, Other

---

### Flag Management (Leaders)
- 📋 Flag queue page (filtered by Leader's proficiencies)
- 📋 Display target info (Property/Location/Role via `target_id`)
- 📋 Resolve button (change status to `resolved`)
- 📋 Dismiss button (change status to `dismissed`)
- 📋 Action log (audit trail)
- 📋 No notification to flagged user until action taken

**Notes:**
- Leaders can deactivate users (Copros/other Leaders)
- Deactivated user's posts show original `created_by` name

---

## Phase 7: Archive & History

### Archive Page (Leaders/Admins)
- 📋 Access control (Leaders+ only)
- 📋 Display posts ≤90 days old
- 📋 Show deactivated posts
- 📋 Filter by Property/Location/Role/Date range
- 📋 Keyword search (shift title, comments)
- 📋 Orphaned posts show original username

**Notes:**
- Separate route from live boards
- Same card components as live boards

---

## Phase 8: Security & Rate Limiting

### API Rate Limiting
- 📋 POST /shifts: 28/24hrs per user
- 📋 POST /proficiency-suggestion: 10/24hrs per user
- 📋 POST /flag: 20/24hrs per user
- 📋 General API: 1000 req/15min per IP
- 📋 Login: 5 attempts/15min per email

**Notes:**
- Use Supabase Edge Functions + Upstash Redis for rate limiting
- Or Vercel Edge Middleware if not using Supabase functions

---

### Security Hardening
- 📋 HTTPS enforcement
- 📋 CORS configuration
- 📋 Input sanitization (prevent XSS)
- 📋 SQL injection prevention (Supabase client handles this)
- 📋 Rate limiting on all endpoints
- 📋 Audit log for admin actions

---

## Phase 9: Mobile & Accessibility

### Mobile-First Design
- 📋 Responsive breakpoints (mobile, tablet, desktop)
- 📋 Touch target size: 44x44px minimum
- 📋 Bottom navigation for mobile
- 📋 Swipe gestures (nice-to-have)
- 📋 PWA manifest.json
- 📋 Service worker for offline shell

**Notes:**
- No offline mode for data (requires live connection)
- PWA installable on iOS/Android/desktop

---

### WCAG 2.1 AA Compliance
- 📋 Color contrast: 7:1 ratio (all text)
- 📋 Keyboard navigation (all interactive elements)
- 📋 Focus indicators visible
- 📋 Screen reader testing (nice-to-have)
- 📋 Alt text for all images
- 📋 ARIA labels for dynamic content

---

## Phase 10: Testing & QA

### Unit Tests
- 📋 HubID/PERNER regex validation
- 📋 Email format validation
- 📋 Rate limiting logic
- 📋 Expiration calculations

---

### Integration Tests
- 📋 Registration → Email verification flow
- 📋 Post creation → Expiration
- 📋 Flag → Resolution workflow
- 📋 Proficiency suggestion → Approval

---

### E2E Tests (Playwright/Cypress)
- 📋 Full registration flow
- 📋 Login → Post shift → Deactivate
- 📋 Leader flag review
- 📋 Role promotion/demotion

---

## Phase 11: Deployment & DevOps

### Production Readiness
- 📋 Environment variables documented
- 📋 Database backups configured
- 📋 Error logging (Sentry or similar)
- 📋 Performance monitoring
- 📋 Uptime monitoring (99.5% target)

---

### CI/CD Pipeline
- 📋 GitHub Actions: Lint, type-check, test
- 📋 Auto-deploy to Vercel on main branch
- 📋 Preview deployments for PRs
- 📋 Database migration scripts

---

## Phase 12: Alpha Launch Prep

### Seeding & Onboarding
- 📋 Seed Properties (MK, EPCOT, AK, Resorts)
- 📋 Seed initial Locations (5-10 per property)
- 📋 Seed initial Roles (10-15 common roles)
- 📋 Create Admin account
- 📋 Create test Cast/Copro/Leader accounts

---

### Documentation
- 📋 User guide (how to post shifts)
- 📋 Leader guide (moderation workflows)
- 📋 Admin guide (system management)
- 📋 API documentation (if exposing API)

---

### Legal & Compliance
- ✅ Terms & Conditions (boilerplate placeholder)
- ✅ Privacy Policy (boilerplate placeholder)
- ✅ Footer disclaimers on all pages
- 📋 Legal review (optional but recommended)

---

## Known Blockers & Technical Debt

### Current Blockers
- None

---

### Technical Debt
- Password reset token storage (separate table vs JSONB in users - TBD)
- Email change history audit trail (implementation TBD)
- Notification system architecture (future paid tier)

---

## Future Enhancements (Post-Alpha)

- 📋 Automated shift matching (AI-powered)
- 📋 Push notifications (email/SMS)
- 📋 Analytics dashboard for Leaders
- 📋 Calendar view with OCR schedule import
- 📋 Multi-language support (Spanish, Portuguese)
- 📋 Native mobile app wrappers
- 📋 Paid features/ad-free tier

---

## Notes Section

### January 19, 2026
- Progress tracking document created
- All foundation documents in place (PRD, README, design system)
- Ready to begin Phase 1: Database implementation

---

**End of Progress Document**