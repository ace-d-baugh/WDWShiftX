# PRD: WDWShiftX (Version 2.1)

**Project Lead:** Ace Baugh  
**Status:** Final Draft  
**Stack:** React (Next.js), Supabase, Tailwind CSS  
**Target Platform:** Progressive Web App (PWA)

---

## 1. Executive Summary

WDWShiftX is a dedicated, non-affiliated bulletin board for Walt Disney World Cast Members to broadcast shift availability (trades/giveaways) and requests. It aims to solve the "noise" and "security" issues of Facebook groups by using structured data and role-based access control.

**Key Disclaimer:** Not affiliated with, authorized by, or endorsed by The Walt Disney Company.

---

## 2. User Roles & Access Control (RBAC)

| Role | Access Level | Description |
|------|--------------|-------------|
| **Guest** | Public | Can only see the landing page, login, and registration. |
| **Cast** | Email Verified | Basic CM access. Can view/filter boards within proficiencies, CRUD shift owned offers/requests, Suggest new locations & shift titles, and edit & deactivate own profile. |
| **CoPro** | Moderator | CMs with @disney.com emails. Can do all Cast can do plus flag users and posts, and deactivate other CoPros. |
| **Leader** | Manager | Can do all a CoPro can do plus verify/deactivate Copros and other Leaders. Can promote Copros to Leaders. Can approve location/role suggestions. Access to archived posts and filtered flag queue. Remove an email from Black List|
| **Admin** | Superuser | Full system control. Can assign Leader permissions, manage all profiles, and CRUD Properties, Locations, and Roles. |

---

## 3. Verification & Security

### The Registration Handshake

1. **Input:** User provides Email, Password, HubID, PERNER.
2. **Server-Side Validation:**
   - HubID Regex: `/^[a-zA-Z]{5}\d{3}$/` (e.g., HAUGM027)
   - PERNER Regex: `/^\d{8}$/` (e.g., 01713069)
   - Email not on "Balck List"
3. **Action:** If validation passes, account is created with `email_verified = false`.
4. **Email Verification:** Verification link sent to provided email. Account remains inactive until verified.
5. **Disposal:** HubID and PERNER are used only for initial validation and are never stored in the database.
6. **Terms & Conditions:** Checkbox required to enable registration submit button. T&C link opens in new tab.

### Email Changes

- Users can update email addresses.
- New email must be verified before old email is replaced.
- Re-login required after email change.
- **Auto-Promotion:** If new email is @disney.com, user is promoted to CoPro upon next login.
- **Auto-Demotion:** If CoPro or Leader changes from @disney.com to non-Disney email, user is demoted to Cast. Warning displayed before change.

### Inactivity Management

- **3-Month Email:** "Hey ya, Pal. We miss you around here. Hope all is well. Login to stay active or if you would like, your account will be deactivated in 60 days of inactivity."
- **5-Month Purge:** Account deactivated (`is_active = false`). All associated posts become orphaned but remain visible with original created_by name.

---

## 4. The Proficiency Database

Three-tier system to ensure users only see shifts they are qualified for:

- **Property:** High-level entity (e.g., Magic Kingdom, EPCOT, Animal Kingdom, Resorts). Admin-managed only.
- **Location:** Specific area within a property (e.g., Casey's Corner, Jungle Cruise, Front Desk).
- **Role:** Job function (e.g., Quick Service F&B, Attractions, Custodial, Concierge).

### User Proficiency Suggestions

- Cast can suggest new Locations and Roles.
- Suggestions are immediately added to suggester's profile and available for use by others.
- Suggestions remain in pending approval queue until reviewed by Leaders.
- Leaders access pending items via dedicated queue page with login notification badge.
- **Rejected suggestions:** Deleted system-wide.
- Queue sorted by submission timestamp.

---

## 5. Feature Requirements

### A. The Shift Board (Offers)

**Dynamic Filtering:**
- Automatically filters shifts based on user's saved proficiencies.

**Sorting:**
1. `start_time` (Ascending)
2. `created_at` (Descending)

**Expiration Engine:**
- Automated process (cron job) marks shifts as inactive (`is_active = false`) exactly 30 minutes before `start_time`.

**Display Badges:**
- **Trade:** Clear visual indicator (pill/tag)
- **Giveaway:** Clear visual indicator (pill/tag)
- **Overtime Approved:** Badge with legal disclaimer in T&C: "Verify OT approval before claiming"
- Posts can have multiple badges (e.g., Trade + Giveaway + OT)

**Post Editing:**
- Users can edit their own posts as long as `is_active = true`.
- No notifications sent for edits.
- Edit history visible to CoPros+ for abuse tracking.

**Post Deactivation:**
- Users can deactivate their own posts.
- Deactivated posts visible to Leaders+ in archive/history section.

---

### B. The Request Board

Same page as Shift Board with tab toggle.

**Fields:**
- Property, Location, Role
- `requested_date` (single date per request)
- `preferred_times` (multi-select: Morning, Afternoon, Evening, Late)
- Comments (optional)

**Sorting:**
1. `requested_date` (Ascending)
2. Time slot specificity:
   - Morning only
   - Morning + Afternoon
   - Morning + Afternoon + Evening
   - Morning + Afternoon + Evening + Late
   - Afternoon only
   - Afternoon + Evening
   - Afternoon + Evening + Late
   - Evening only
   - Evening + Late
   - Late only
   - (All combinations in logical order)
3. `created_at` (Descending)

**Expiration:**
- Auto-expires at 23:59 ET on `requested_date`.

**Interaction:**
- No hard filtering by time preference; users contact poster for clarification.
- Manual matching only (automated matching reserved for future updates).

---

### C. Posting Form

**Required Fields (Offers):**
- Shift Title
- Property
- Location
- Role
- Start DateTime
- End DateTime
- At least one: Trade checkbox OR Giveaway checkbox

**Optional Fields (Offers):**
- Comments
- Overtime Approved (boolean)

**Required Fields (Requests):**
- Property
- Location
- Role
- Requested Date
- Preferred Times (at least one selected)

**Optional Fields (Requests):**
- Comments

**Conflict Prevention:**
- Warning if user tries to post a shift that overlaps with existing active post.

**Rate Limiting:**
- 28 posts per 24 hours: 14 offers + 14 requests
- Enforced at app and database level

---

### D. Account Management

**Profile Fields:**
- Display Name (format: "FirstName LastInitial." e.g., "Matthew B.")
- Email (editable with verification)
- Phone Number (optional, editable)
- Notification Preferences:
  - `notify_via_email` (boolean)
  - `notify_via_sms` (boolean)
- Proficiency Setup: Multi-select interface for Properties/Locations/Roles

**Password Recovery:**
- Email-based "Forgot Password" flow.
- Reset tokens (implementation: separate table or JSONB in users table - TBD).

**Display Name:**
- Editable post-registration.

---

### E. Moderation & Flagging

**Flag Targets:**
- Posts (offers and requests)
- User profiles

**Flag Triggers:**
- Fake posts
- Inappropriate comments/wording
- Posting for someone else without permission
- Other misconduct

**Flag Workflow:**
1. Cast/CoPro/Leader clicks flag button on post or profile.
2. Flag enters pending queue with status `pending`.
3. Flagged content remains visible.
4. Leaders see flags filtered by their proficiencies only.
5. Leaders can:
   - **Resolve:** Mark flag as resolved with action taken.
   - **Dismiss:** Mark flag as dismissed.
6. Flagged users are not notified until action is taken.

**Documentation:**
- Flags serve as audit trail for potential fireable offenses.
- Leaders can view target's Property/Location/Role via `target_id`.

**Deactivation:**
- CoPros can deactivate other CoPros.
- Leaders can deactivate CoPros and other Leaders.
- Leaders can demote themselves and others.
- Deactivated users: all associated posts become orphaned but remain visible with original created_by name.

---

### F. Archive & History

**Access:**
- Leaders and Admins only.

**Contents:**
- Posts no older than 90 days (both offers and requests).
- Deactivated posts (user-deleted).

**Search & Filter:**
- Same filters as live boards (Property, Location, Role, Date range) adding keyword search.

**Display:**
- Separate section/page from live boards.
- Orphaned posts show original username (e.g., "Matthew B.").

---

### G. Security
**Failed Registration Flow:**
 - HubID & PERNER must pass Regex upon atempting to submit registration
 - Registration page reloads with everything filled out but empty inputs for HubID and PERNER warning: "HubID or PERNER or both are not correct, please enter them again or see you Leader for correct formatting."
 - Five failed attempts will place the email address in the banned emails list

**Email Black List**
 - Blocked emails from creating or recreating profiles.

---
## 6. Technical Considerations

### Infrastructure

**"Saturday Night Spike":**
- Anticipated high traffic Saturday nights (23:30–02:00 ET).
- Serverless functions (Vercel/Supabase) for elastic scaling.

**Database Indexing:**
- `shifts`: (`is_active`, `start_time`, `created_at`)
- `requests`: (`is_active`, `requested_date`, `preferred_times`)
- `flags`: (`status`, `created_at`)
- `users`: (`email`), (`role`, `is_active`)
- `user_proficiencies`: (`user_id`, `location_id`, `role_id`)
- `black_list_emails`: (`email`)

### Rate Limiting (API)

- `POST /shifts`: 28 per 24hrs per user
- `POST /proficiency-suggestion`: 10 per 24hrs per user
- `POST /flag`: 20 per 24hrs per user
- General API: 1000 requests per 15min per IP
- Login attempts: 5 per 15min per email

### Security

- Soft deletes (`is_active = false`) for auditability.
- All passwords hashed (bcrypt/Argon2).
- Email verification required for all users.
- HTTPS only.

---

## 7. Accessibility & Mobile Requirements

### Accessibility (WCAG 2.1 AA Compliance)

- **Color Contrast:** Minimum 7:1 ratio.
- **Keyboard Navigation:** All modals, forms, and interactive elements.
- **Screen Reader Testing:** Nice-to-have if resources allow.
- **Touch Targets:** Minimum 44x44px for mobile.

### Mobile-First Design

- **Responsive:** Optimized for phones, tablets, desktops.
- **No Offline Mode:** Requires live connection for up-to-date data.
- **PWA:** Installable on iOS, Android, desktop (PC/Mac/Linux).

---

## 8. Notification System (Future Enhancement)

**Delivery Methods:**
- Email
- SMS
- Both
- None (user preference)

**Triggers:**
- New shift/request matching user proficiencies (instant alerts).
- Proficiency-agnostic (user chooses notification preferences globally).

**Implementation:**
- Paid service tier (TBD).
- Requires phone number capture during registration.

---

## 9. Database Schema

### Users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash TEXT NOT NULL,
  phone_number TEXT,
  notify_via_email BOOLEAN DEFAULT FALSE,
  notify_via_sms BOOLEAN DEFAULT FALSE,
  role TEXT CHECK (role IN ('cast', 'copro', 'leader', 'admin')) DEFAULT 'cast',
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Properties

```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Locations

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  suggested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, name)
);
```

### Roles

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  suggested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### User_Proficiencies

```sql
CREATE TABLE user_proficiencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, location_id, role_id)
);
```

### Shifts (Offers)

```sql
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  shift_title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_trade BOOLEAN DEFAULT FALSE,
  is_giveaway BOOLEAN DEFAULT FALSE,
  is_overtime_approved BOOLEAN DEFAULT FALSE,
  comments TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS (start_time - INTERVAL '30 minutes') STORED
);
```

### Requests

```sql
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  preferred_times TEXT[] NOT NULL CHECK (preferred_times <@ ARRAY['morning', 'afternoon', 'evening', 'late']),
  requested_date DATE NOT NULL,
  comments TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS ((requested_date + INTERVAL '1 day' - INTERVAL '1 second')::TIMESTAMPTZ) STORED
);
```

### Flags

```sql
CREATE TABLE flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT CHECK (target_type IN ('post', 'user')) NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'resolved', 'dismissed')) DEFAULT 'pending',
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Black_Listed

```sql
CREATE TABLE black_listed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  failed_attempts INTEGER DEFAULT 0 CHECK (failed_attempts >= 0),
  blocked BOOLEAN DEFAULT FALSE,
  ip_address INET, -- Using INET type for optimized IP storage and validation
  origin_country TEXT,
  origin_city TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
---

## 10. Legal & Risk Management

### Disclaimers

**Footer (All Pages):**
- "Not affiliated with, authorized by, or endorsed by The Walt Disney Company."
- Copyright notice: "© 2026 WDWShiftX"
- Links: Terms & Conditions, Privacy Policy (boilerplate placeholder)

**Terms & Conditions:**
- Overtime badge disclaimer: "Verify OT approval in HUB before claiming"
- Accuracy: "WDWShiftX is a bulletin board only; users are responsible for final execution through Disney's official systems."
- Ghosting: Users who claim shifts but fail to process them may be flagged and subject to moderation.
- Misuse of this application may be used for real disciplinary action by leaders of the Walt Disney Company.

### Data Privacy

- **HubID & PERNER:** Never stored. Used only for registration validation.
- **Email Change History:** Audit trail (implementation TBD).
- **Privacy Policy:** Boilerplate placeholder until full scope review.

---

## 11. Future Enhancements

- **Automated Matching:** AI-powered matching between offers and requests.
- **Push Notifications:** Instant alerts for matching shifts.
- **Analytics Dashboard:** Leaders see shift trends by Property/Location/Role.
- **Mobile App Wrapper:** Native iOS/Android apps (if PWA insufficient).
- **Multi-Language Support:** Spanish, Portuguese for international CMs.
- **Calendar View:** Importing schedules via OCR of images and ability to add shifts to posts.
- **Paid Features:** Adding a way for users to get enhanced features or ad-free experience for low price.
- **Ads:** Adding ads to offset the price of running the application.

---

## 12. Success Metrics

- **User Adoption:** 500+ verified Cast Members in first 3 months.
- **Engagement:** Average 10+ active posts per day.
- **Moderation Efficiency:** Flags resolved within 24 hours.
- **Uptime:** 99.5% during peak hours (Saturday nights).

---

## 13. Rollout Plan

1. **Alpha:** Single role/location for internal testing.
2. **Beta:** Expand to 3 properties, invite-only.
3. **Public Launch:** Full rollout with marketing to CM communities.

---

**End of PRD v2.1**
