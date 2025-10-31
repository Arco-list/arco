# Code Review: Professionals Table Dependencies

**Date:** 2025-10-31
**Purpose:** Identify all code touching `professionals` and `project_professionals` tables to prevent breaking changes during refactoring

---

## Summary Statistics

**Files directly querying `professionals` table:** 8
**Files directly querying `project_professionals` table:** 13
**Files importing professional types:** 25+
**Critical files (invite workflow):** 6

---

## Part 1: Direct Database Queries

### 1.1 professionals Table - SELECT Queries

| File | Line | Purpose | Risk Level | Notes |
|------|------|---------|------------|-------|
| `lib/professionals/queries.ts` | 587 | Fetch professional details | 🔴 HIGH | Core query, uses LEFT JOIN with companies |
| `app/new-project/actions.ts` | 25, 86, 218, 292 | Get professionals for invite flow | 🔴 CRITICAL | Multiple queries for admin/professional users |
| `app/dashboard/company/page.tsx` | 87 | Load user's professional profile | 🟡 MEDIUM | User dashboard |
| `app/dashboard/listings/page.tsx` | 182 | Check if user is professional | 🟡 MEDIUM | Listings page |
| `app/create-company/actions.ts` | 153 | Check existing professional record | 🔴 CRITICAL | Company creation flow |
| `app/admin/users/actions.ts` | 561, 581 | User deletion checks | 🟢 LOW | Admin only |
| `app/admin/professionals/actions.ts` | 171 | Admin professional queries | 🟢 LOW | Admin management |
| `app/new-project/details/page.tsx` | 440 | Look up professional by user | 🟡 MEDIUM | New project flow |

---

### 1.2 professionals Table - INSERT/UPDATE Queries

| File | Line | Purpose | Risk Level | Notes |
|------|------|---------|------------|-------|
| `app/create-company/actions.ts` | 173, 192 | Create/update professional record | 🔴 CRITICAL | Core signup flow |
| `app/admin/professionals/actions.ts` | 171 | Admin updates | 🟢 LOW | Admin management |

**Critical Insight:** Professional records are created in `create-company/actions.ts` after company creation. This MUST continue to work or signup breaks.

---

### 1.3 project_professionals Table - All Queries

| File | Line | Purpose | Risk Level | Impact if Broken |
|------|------|---------|------------|-------------------|
| **CRITICAL - Invite Workflow** |
| `lib/new-project/invite-professionals.ts` | 98 | Create invite record | 🔴 CRITICAL | Entire invite system breaks |
| `app/new-project/actions.ts` | 303 | Update invites during claim | 🔴 CRITICAL | New users can't accept invites |
| `app/new-project/professionals/page.tsx` | 443, 712, 833 | Load/delete/create invites | 🔴 CRITICAL | Can't manage invites in UI |
| `app/dashboard/edit/[id]/page.tsx` | 1589, 2045, 2102 | Project editing invites | 🔴 CRITICAL | Can't edit project professionals |
| `lib/email-service.ts` | - | Generates invite URLs | 🔴 CRITICAL | Email invites won't work |
| **Important - Display** |
| `app/projects/[slug]/page.tsx` | 340, 571 | Display professionals on project | 🟡 MEDIUM | Project pages broken |
| `app/dashboard/listings/page.tsx` | 198, 684 | User's project listings | 🟡 MEDIUM | Dashboard broken |
| `lib/professionals/queries.ts` | 658 | Professional's project list | 🟡 MEDIUM | Profile pages incomplete |
| **Admin** |
| `app/admin/professionals/page.tsx` | 82 | View invites | 🟢 LOW | Admin panel |
| `app/admin/professionals/actions.ts` | 68 | Manage invites | 🟢 LOW | Admin actions |
| `app/admin/users/actions.ts` | 590 | Cascade delete check | 🟢 LOW | User deletion |
| `app/admin/projects/actions.ts` | 324 | Project management | 🟢 LOW | Admin project updates |
| `components/admin-projects-table.tsx` | 610 | Display invites | 🟢 LOW | Admin table |

---

## Part 2: Critical Workflow Analysis

### 2.1 Invite Workflow (DO NOT BREAK!)

**Flow Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│ 1. PROJECT OWNER INVITES PROFESSIONAL                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CREATE project_professionals RECORD                     │
│    - invited_email: "john@example.com" ✓                   │
│    - professional_id: null (user doesn't exist yet)        │
│    - company_id: null (user doesn't exist yet)             │
│    - status: 'invited'                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. SEND EMAIL via lib/email-service.ts                     │
│    - checkUserAndGenerateInviteUrl(email, projectId)       │
│    - sendProfessionalInviteEmail(email, inviteData)        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. USER CLICKS EMAIL LINK                                  │
│    Case A: New user → signup → create-company              │
│    Case B: Existing user → create-company                  │
│    Case C: Existing professional → dashboard               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. CREATE COMPANY + PROFESSIONAL RECORD                    │
│    File: app/create-company/actions.ts                     │
│    - Insert into companies table                           │
│    - Insert into professionals table ← RENAME TO team_members │
│    - Update profiles.user_types to include 'professional'  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. CLAIM PENDING INVITES                                   │
│    Function: claimPendingInvitesAction()                   │
│    File: app/new-project/actions.ts:275                    │
│                                                             │
│    Query: UPDATE project_professionals SET                 │
│             professional_id = <new_prof_id>,               │
│             company_id = <new_company_id>,                 │
│             status = 'listed',                             │
│             responded_at = now()                           │
│           WHERE invited_email = <user_email>               │
│             AND professional_id IS NULL                    │
└─────────────────────────────────────────────────────────────┘
```

**Key Dependencies:**

1. **Foreign Key:** `project_professionals.professional_id → professionals.id`
   - Must be renamed when professionals table is renamed
   - Used in JOIN queries to get professional details

2. **Email Matching:** Invite matching relies on `invited_email` field
   - Must stay TEXT, not change to reference
   - Critical for claim workflow

3. **Status Workflow:**
   - 'invited' = professional_id is NULL
   - 'listed' = professional_id is NOT NULL
   - Must preserve this logic

---

### 2.2 Company Creation Flow

**File:** `app/create-company/actions.ts`
**Lines:** 64-220

**Current Logic:**
```typescript
// 1. Check if user already has professional record
const { data: professional } = await supabase
  .from("professionals")  // ← WILL RENAME TO company_team_members
  .select("id")
  .eq("user_id", user.id)
  .maybeSingle()

// 2. Create or find company
const { data: company } = await supabase
  .from("companies")
  .insert({ ... })

// 3. Create or update professional record
if (professional) {
  // Update existing
  await supabase
    .from("professionals")  // ← RENAME
    .update({
      company_id: companyId,
      title: companyName,      // ← RENAME to 'role'
      services_offered: [...]  // ← REMOVE (duplicate of companies.services_offered)
    })
} else {
  // Create new
  await supabase
    .from("professionals")  // ← RENAME
    .insert({
      title: companyName,      // ← RENAME to 'role'
      user_id: user.id,
      company_id: companyId,
      services_offered: [...]  // ← REMOVE
    })
}

// 4. Update profile to professional type
await supabase
  .from("profiles")
  .update({ user_types: desiredTypes })
```

**Required Changes:**
- ✅ Change table name: `professionals` → `company_team_members`
- ✅ Change column: `title` → `role`
- ✅ Remove: `services_offered` (use companies.services_offered instead)
- ⚠️ Ensure foreign key still works after rename

---

### 2.3 Professional Listing/Discovery

**File:** `lib/professionals/queries.ts`
**Function:** `fetchDiscoverProfessionals()`
**Line:** 432

**Complex Query:**
```typescript
const { data, error } = await supabase
  .from("companies")  // Starts with companies!
  .select(`
    id,
    name,
    slug,
    city,
    logo_url,
    status,
    domain,
    is_verified,
    services_offered,
    primary_service:categories!companies_primary_service_id_fkey(name),
    professionals!inner(  // ← LEFT JOIN to professionals
      id,
      user_id,
      title,      // ← RENAME to 'role'
      is_available
    ),
    company_ratings!company_ratings_company_id_fkey(
      overall_rating,
      total_reviews
    ),
    company_photos(url, is_cover, order_index)
  `)
  .eq("status", "listed")
  .eq("professionals.is_available", true)
```

**Impact:**
- Uses LEFT JOIN to professionals table
- After rename, will be: `.professionals!inner(...)` → `.company_team_members!inner(...)`
- Must update foreign key name in Supabase

**Required Changes:**
- ✅ Update join reference: `professionals!inner` → `company_team_members!inner`
- ✅ Update column: `title` → `role`
- ⚠️ Test that join still works after rename

---

### 2.4 Professional Detail Pages

**File:** `lib/professionals/queries.ts`
**Function:** `fetchProfessionalDetail()`
**Line:** 551

**Query:**
```typescript
const { data } = await supabase
  .from("companies")
  .select(`
    *,
    primary_service:categories!companies_primary_service_id_fkey(name),
    professionals!inner(  // ← JOIN
      id,
      user_id,
      title,       // ← RENAME
      bio,
      years_experience,
      hourly_rate_min,
      hourly_rate_max,
      portfolio_url,
      is_verified,
      is_available,
      services_offered,  // ← REMOVE (use companies.services_offered)
      languages_spoken,  // ← REMOVE (use companies.languages)
      is_featured        // ← REMOVE (use companies.is_featured)
    ),
    company_ratings!company_ratings_company_id_fkey(*),
    company_social_links(*),
    company_photos(*)
  `)
```

**Required Changes:**
- ✅ Update join: `professionals!inner` → `company_team_members!inner`
- ✅ Rename: `title` → `role`
- ✅ Remove: `services_offered`, `languages_spoken`, `is_featured`
- ✅ Update type definitions in `lib/professionals/types.ts`

---

## Part 3: Type Definitions

### 3.1 Files Using Professional Types

**Import Analysis:**
```typescript
// Core types file
import type { ProfessionalCard } from "@/lib/professionals/types"
import type { ProfessionalDetail } from "@/lib/professionals/types"
import type { ProfessionalOption } from "@/lib/new-project/invite-professionals"
```

**Files importing professional types:** (25+ files)
- Components: 15 files
- Hooks: 3 files
- Contexts: 2 files
- Pages: 10+ files

**Strategy:**
- Keep type names as-is (they're semantically correct for UI)
- Update type definitions to match new table schema
- Regenerate from Supabase after migration

---

### 3.2 Critical Type: ProfessionalOption

**File:** `lib/new-project/invite-professionals.ts:11`

```typescript
export interface ProfessionalOption {
  id: string              // professional/team_member id
  user_id: string         // user account id
  name: string            // User's full name
  title: string           // Professional title/role ← RENAME to 'role'
  email: string           // User's email (from auth.users)
  company_id: string      // Their company
  company: {
    id: string
    name: string
    city: string | null
    country: string | null
    logo_url: string | null
    status: string
  }
}
```

**Used In:**
- Invite dropdowns
- Email invite lookups
- Professional selection UI

**Required Change:**
- ✅ Update: `title: string` → `role: string`
- ⚠️ Check all consumers of this type

---

## Part 4: Conflict Analysis

### 4.1 Naming Conflicts

**Current Foreign Key Names (Auto-generated by Supabase):**
```sql
-- Will need to be updated:
project_professionals.professional_id → professionals.id
  Constraint: project_professionals_professional_id_fkey

-- After rename:
project_professionals.professional_id → company_team_members.id
  Constraint: project_professionals_professional_id_fkey (same name!)
```

**Issue:** Foreign key column is called `professional_id` but references `company_team_members`

**Options:**
1. **Keep column name** (easier migration)
   - Pro: Less code changes
   - Con: Semantically confusing (`professional_id` → `company_team_members`)

2. **Rename column** (cleaner but harder)
   - Rename: `professional_id` → `team_member_id`
   - Pro: Semantically correct
   - Con: Every query breaks, high risk

**Recommendation:** **Keep `professional_id` column name**
- Lower risk
- Still works (just references different table)
- Can rename later if needed
- Update comments to clarify

---

### 4.2 Duplicate Data Problem

**Current Issue:** Data duplicated between tables

| Data | professionals table | companies table | Solution |
|------|-------------------|----------------|----------|
| services_offered | TEXT[] ✓ | TEXT[] ✓ | Remove from professionals |
| languages | languages_spoken TEXT[] | languages TEXT[] | Remove from professionals |
| is_featured | BOOLEAN ✓ | BOOLEAN ✓ | Remove from professionals |
| is_verified | BOOLEAN ✓ | BOOLEAN ✓ | Keep in both (different meanings) |

**Migration Strategy:**
1. Before dropping columns, verify companies table has data
2. If professionals.services_offered has data companies doesn't, migrate it
3. Drop duplicate columns from professionals table

---

### 4.3 Join Queries Risk

**Risky Patterns:**
```typescript
// Pattern 1: Inner join from companies to professionals
.from("companies")
.select("*, professionals!inner(...)")

// Pattern 2: Select from professionals with companies join
.from("professionals")
.select("*, companies(...)")

// Pattern 3: Project_professionals with professionals join
.from("project_professionals")
.select(`
  *,
  professionals(name, title),  // ← Will break
  companies(name, logo_url)
`)
```

**Test Cases Needed:**
- [ ] Company listing with team member join
- [ ] Team member profile with company join
- [ ] Project page with team member details
- [ ] Admin panel queries

---

## Part 5: Migration Checklist

### 5.1 Pre-Migration Verification

- [ ] Run full test suite
- [ ] Export production data backup
- [ ] List all foreign key constraints
- [ ] Document current query performance
- [ ] Test all invite workflow scenarios

---

### 5.2 During Migration

**Order of Operations:**
1. ✅ Rename table: `professionals` → `company_team_members`
2. ✅ Rename column: `title` → `role`
3. ✅ Drop redundant columns: `services_offered`, `languages_spoken`, `is_featured`
4. ✅ Add new column: `is_primary_contact`
5. ✅ Make `company_id` NOT NULL
6. ✅ Add unique constraint: `UNIQUE(user_id)`
7. ✅ Update RLS policies
8. ✅ Regenerate TypeScript types
9. ✅ Deploy code changes
10. ✅ Test critical paths

---

### 5.3 Code Update Priority

**Phase 1 - Critical (Must work immediately):**
1. `app/create-company/actions.ts` - Company creation
2. `app/new-project/actions.ts` - Invite actions
3. `lib/new-project/invite-professionals.ts` - Invite helpers
4. `lib/email-service.ts` - Email generation

**Phase 2 - Important (Should work same day):**
5. `lib/professionals/queries.ts` - All queries
6. `app/new-project/professionals/page.tsx` - Invite UI
7. `app/dashboard/edit/[id]/page.tsx` - Project editing
8. `app/projects/[slug]/page.tsx` - Project display

**Phase 3 - Nice to have (Can fix if issues found):**
9. Admin panels
10. Dashboard listings
11. Profile pages

---

### 5.4 Testing Scenarios

**Critical Workflows to Test:**

1. **New User Signup & Invite:**
   - [ ] User receives email invite
   - [ ] Clicks link → signup page
   - [ ] Creates account
   - [ ] Redirected to create company
   - [ ] Creates company + team member record
   - [ ] Invite claimed (project_professionals updated)
   - [ ] Can view project in dashboard

2. **Existing User Invite:**
   - [ ] Non-professional user receives invite
   - [ ] Clicks link → create company page
   - [ ] Creates company + team member record
   - [ ] Invite claimed
   - [ ] User type updated to 'professional'

3. **Professional Self-Invite:**
   - [ ] Professional creates project
   - [ ] Invites themselves from dropdown
   - [ ] Appears as 'listed' immediately
   - [ ] Shows in dashboard listings

4. **Admin Invite:**
   - [ ] Admin invites existing professional
   - [ ] Admin invites new email
   - [ ] Both appear in admin panel
   - [ ] Email sent correctly

5. **Company Management:**
   - [ ] Create new company
   - [ ] Edit company details
   - [ ] Upload company photos
   - [ ] Update social links

6. **Professional Listing:**
   - [ ] Browse professionals page
   - [ ] Filter by category
   - [ ] View professional detail
   - [ ] Save professional
   - [ ] Contact professional

---

## Part 6: Risk Mitigation

### 6.1 High Risk Areas

**1. project_professionals Foreign Key**
- **Risk:** Foreign key constraint name changes
- **Mitigation:** Postgres handles rename automatically
- **Test:** Insert/update project_professionals after migration

**2. Email Invite Claiming**
- **Risk:** `claimPendingInvitesAction` breaks
- **Mitigation:** Thoroughly test with real emails
- **Test:** Create invite, signup, verify claim works

**3. JOIN Queries**
- **Risk:** Supabase client doesn't recognize new table name
- **Mitigation:** Use explicit foreign key syntax
- **Test:** All queries that join professionals

---

### 6.2 Rollback Plan

**If migration fails:**

```sql
-- Emergency rollback
BEGIN;

-- Rename back
ALTER TABLE company_team_members RENAME TO professionals;
ALTER TABLE professionals RENAME COLUMN role TO title;

-- Add back dropped columns with defaults
ALTER TABLE professionals ADD COLUMN services_offered TEXT[];
ALTER TABLE professionals ADD COLUMN languages_spoken TEXT[];
ALTER TABLE professionals ADD COLUMN is_featured BOOLEAN DEFAULT false;

-- Remove new column
ALTER TABLE professionals DROP COLUMN IF EXISTS is_primary_contact;

-- Revert constraints
ALTER TABLE professionals ALTER COLUMN company_id DROP NOT NULL;
DROP INDEX IF EXISTS idx_team_members_user_id;

COMMIT;
```

**Then:**
- Revert code deployment
- Regenerate old TypeScript types
- Notify team

---

## Part 7: Recommendations

### 7.1 Migration Approach

**Recommended:** Two-phase migration

**Phase 1: Safety (1 day)**
1. Deploy code with BOTH table names supported
2. Add database view: `CREATE VIEW professionals AS SELECT * FROM company_team_members`
3. All queries still work
4. Test in production with view

**Phase 2: Cleanup (1 day)**
5. Remove view
6. Update all code to use new name
7. Final testing
8. Documentation

**Alternative:** Direct migration (higher risk, faster)

---

### 7.2 Questions for Decision

1. **Column naming:** Keep `professional_id` or rename to `team_member_id`?
   - **Recommendation:** Keep `professional_id` (less risky)

2. **Migration timing:** Two-phase or direct?
   - **Recommendation:** Two-phase (safer)

3. **professional_specialties table:** Keep or remove?
   - **Recommendation:** Remove (only 4 rows, companies have services_offered)

4. **Testing:** How much time for testing?
   - **Recommendation:** 1 full day minimum

---

## Part 8: File-by-File Change Matrix

### Critical Files (Must Update)

| File | Lines | Changes Needed | Complexity |
|------|-------|----------------|------------|
| `app/create-company/actions.ts` | 153-209 | Rename table, rename title→role, remove services_offered | HIGH |
| `app/new-project/actions.ts` | 25-319 | Update 5 queries, rename columns | HIGH |
| `lib/professionals/queries.ts` | 432-836 | Update all queries, remove duplicate fields | HIGH |
| `lib/new-project/invite-professionals.ts` | 28-139 | Update types, update comments | MEDIUM |
| `lib/email-service.ts` | 166-221 | Update professional lookup query | MEDIUM |
| `app/new-project/professionals/page.tsx` | 443-833 | Update UI logic, types | MEDIUM |
| `app/dashboard/edit/[id]/page.tsx` | 1589-2102 | Update invite queries | MEDIUM |
| `app/projects/[slug]/page.tsx` | 340-571 | Update display logic | LOW |
| `app/dashboard/listings/page.tsx` | 182-684 | Update queries | LOW |
| `app/dashboard/company/page.tsx` | 87 | Update query | LOW |

### Admin Files (Lower Priority)

| File | Changes Needed | Priority |
|------|----------------|----------|
| `app/admin/professionals/page.tsx` | Rename references | LOW |
| `app/admin/professionals/actions.ts` | Update queries | LOW |
| `app/admin/users/actions.ts` | Update cascade logic | LOW |
| `app/admin/projects/actions.ts` | Update invite queries | LOW |

---

**Total Estimated Changes:** ~30 files, ~100 individual updates

---

**Document Version:** 1.0
**Last Updated:** 2025-10-31
**Next Review:** After Phase 1 completion
