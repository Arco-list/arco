# Product Requirements Document: Unified Project Listing Status System

**Version:** 1.0
**Date:** 2025-01-06
**Status:** Draft
**Author:** System Analysis

---

## Executive Summary

This PRD outlines the standardization and simplification of the project listing status system in the Arco platform. The changes eliminate redundant status values, unify terminology across the application, and provide both project owners and invited professionals (contributors) with granular control over project visibility.

### Key Changes
1. **Eliminate redundant `completed` status** from global project status enum
2. **Standardize all status labels** across admin, dashboard, and filters
3. **Replace opt-out functionality** with unified listing status modal
4. **Enable contributor status management** using same UI as project owners
5. **Add visual status indicators** on project cards for contributors
6. **Display invited service category** on project listings

### Business Value
- **Clearer user experience** with consistent terminology
- **Granular control** for companies to manage portfolio visibility
- **Reduced confusion** by eliminating overlapping status concepts
- **Better portfolio management** for professionals and companies

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Problem Statement](#problem-statement)
3. [Goals & Success Metrics](#goals--success-metrics)
4. [User Stories](#user-stories)
5. [Proposed Solution](#proposed-solution)
6. [Technical Specifications](#technical-specifications)
7. [Database Schema Changes](#database-schema-changes)
8. [UI/UX Changes](#uiux-changes)
9. [Migration Plan](#migration-plan)
10. [Testing Plan](#testing-plan)
11. [Implementation Task List](#implementation-task-list)
12. [Risk Assessment](#risk-assessment)
13. [Appendices](#appendices)

---

## Current State Analysis

### Architecture Overview

The Arco platform uses a **company-centric architecture**:

```
User (profiles table)
  ↓
Team Member (professionals table)
  ↓
Company (companies table) ← PRIMARY marketplace entity
  ↓
Project Professional (project_professionals table) ← Join table
  ↓
Project (projects table)
```

### Current Status Systems

#### 1. Global Project Status (`projects.status`)
- **Type:** `project_status` enum
- **Values:** `draft | in_progress | published | completed | archived | rejected`
- **Controls:** Overall project lifecycle and visibility
- **Updated by:** Project owners and admins

#### 2. Per-Company Listing Status (`project_professionals.status`)
- **Type:** `professional_project_status` enum
- **Values:** `invited | listed | live_on_page | unlisted | rejected | removed`
- **Controls:** How each company appears on the project
- **Updated by:** Currently only through opt-out (sets to `rejected`)

### Label Inconsistencies

| Database Value | Admin Panel | Dashboard Config | Dashboard Filter |
|----------------|-------------|------------------|------------------|
| `published` | "Live" | "Published" | "Live on page" |
| `completed` | "Listed" | "Featured" | "Listed" |
| `archived` | "Unlisted" | "Unpublished" | "Unlisted" |

### Current Contributor Experience

**Limitations:**
- ✅ Can see all company projects in dashboard
- ✅ Can distinguish owner vs contributor role
- ❌ Only option is binary "Opt out" (irreversible in UI)
- ❌ Cannot control portfolio visibility
- ❌ Cannot reverse opt-out decision
- ❌ No indication of which service they were invited for

---

## Problem Statement

### Core Issues

1. **Status Redundancy**
   - Both `published` and `completed` make projects visible
   - Unclear distinction between "Live", "Published", "Listed", "Featured"
   - Per-company `live_on_page` status already controls portfolio featuring
   - Global `completed` status serves no unique purpose

2. **Inconsistent Terminology**
   - Same status value shows different labels across admin/dashboard/filters
   - Confusing for users and developers
   - Hard to maintain

3. **Limited Contributor Control**
   - Binary opt-out is insufficient for portfolio management
   - Contributors want to:
     - Be credited on project page
     - Feature select projects in portfolio
     - Hide projects without fully opting out
   - No UI to manage per-company visibility

4. **Missing Context**
   - Contributors don't see which service category they were invited for
   - No visual indication of their company's current listing status

---

## Goals & Success Metrics

### Goals

**Primary:**
1. Simplify status system by eliminating redundant `completed` status
2. Unify all status labels across the platform
3. Provide contributors with same listing status controls as owners
4. Display service category and status on project cards

**Secondary:**
1. Maintain backwards compatibility during migration
2. Preserve existing RLS policies and security
3. Improve overall code maintainability

### Success Metrics

**User Experience:**
- ✅ Contributors can manage project visibility in 3 tiers (Unpublished, Published, Featured)
- ✅ Zero terminology confusion (single label per status value)
- ✅ Service category visible on all contributor projects

**Technical:**
- ✅ All `completed` status values migrated to `published`
- ✅ Enum updated in database and TypeScript types
- ✅ All UI components use consistent labels
- ✅ No breaking changes to existing features

**Business:**
- ✅ Increased portfolio management engagement
- ✅ Reduced support tickets about status confusion
- ✅ Better showcasing of professional work

---

## User Stories

### As a Project Owner

```
GIVEN I am a project owner
WHEN I click "Update status" on my project
THEN I see a modal with options: Unpublished, Published
AND I can toggle between these statuses
AND my selection updates the global project visibility
```

### As a Contributor (Invited Professional)

```
GIVEN I am a contributor on a project
WHEN I click "Update listing status" on the project card
THEN I see a modal with options: Unpublished, Published, Featured
AND I see my company's current status
AND I can change how my company appears on this project
AND the change only affects MY company's visibility
AND other companies on the project are not affected
```

### As a Plus-Tier Company

```
GIVEN my company has a Plus subscription
WHEN I set a project to "Featured" status
THEN the project appears in my company portfolio
AND I am listed as a contributor on the project page
```

### As a Basic-Tier Company

```
GIVEN my company has a Basic subscription
WHEN I try to set a project to "Featured" status
THEN I see an upgrade prompt
AND I can still use "Unpublished" or "Published" statuses
```

### As an Admin

```
GIVEN I am an admin reviewing projects
WHEN I view the admin projects table
THEN all status labels are consistent with user-facing labels
AND I can filter and update statuses clearly
```

---

## Proposed Solution

### Simplified Status System

#### Global Project Status (Owner Control)

| Status Value | User Label | Description | Visible to Public |
|--------------|------------|-------------|-------------------|
| `draft` | **Draft** | Project being created | ❌ No |
| `in_progress` | **In Review** | Awaiting admin approval | ❌ No |
| `published` | **Published** | Live and visible | ✅ Yes |
| `archived` | **Unpublished** | Delisted/hidden | ❌ No |
| `rejected` | **Rejected** | Rejected by admin | ❌ No |

**Removed:** `completed` (redundant)

#### Per-Company Listing Status (Contributor Control)

| Status Value | User Label | Description | In Portfolio | On Project Page |
|--------------|------------|-------------|--------------|-----------------|
| `invited` | **Invited** | Not yet claimed | ❌ No | ❌ No |
| `unlisted` | **Unpublished** | Not shown | ❌ No | ❌ No |
| `listed` | **Published** | Listed as contributor | ❌ No | ✅ Yes |
| `live_on_page` | **Featured** | In portfolio | ✅ Yes | ✅ Yes |
| `rejected` | **Declined** | Opted out | ❌ No | ❌ No |
| `removed` | **Removed** | Admin removed | ❌ No | ❌ No |

### Status Alignment

The same three user-facing options apply to both owners and contributors:

| User Sees | Owner Updates | Contributor Updates |
|-----------|---------------|---------------------|
| **Unpublished** | `projects.status = 'archived'` | `project_professionals.status = 'unlisted'` |
| **Published** | `projects.status = 'published'` | `project_professionals.status = 'listed'` |
| **Featured** | N/A (removed) | `project_professionals.status = 'live_on_page'` |

**Note:** Owners no longer have a "Featured" option. Project featuring is now exclusively controlled at the per-company level.

---

## Technical Specifications

### System Components Affected

#### Backend
- Database enum: `project_status`
- Database enum: `professional_project_status`
- Table: `projects`
- Table: `project_professionals`
- Materialized views (if they reference status)

#### Frontend
- `/lib/project-status-config.ts` - Status configurations
- `/lib/contributor-status-config.ts` - NEW file
- `/components/listing-status-modal.tsx` - Modal component
- `/app/dashboard/listings/page.tsx` - Main dashboard
- `/components/dashboard-listings-filter.tsx` - Filter panel
- `/components/admin-projects-table.tsx` - Admin table
- `/components/admin-professional-invites-table.tsx` - Admin invites

### API Changes

**No new endpoints required.** Existing Supabase queries will be updated to:
- Filter on new status values
- Update `project_professionals.status` from contributor UI
- Maintain existing RLS policies

---

## Database Schema Changes

### Migration 1: Update `project_status` Enum

**File:** `supabase/migrations/096_remove_completed_status.sql`

```sql
-- Step 1: Convert all 'completed' to 'published'
UPDATE projects
SET status = 'published'
WHERE status = 'completed';

-- Step 2: Recreate enum without 'completed'
ALTER TYPE project_status RENAME TO project_status_old;

CREATE TYPE project_status AS ENUM (
  'draft',
  'in_progress',
  'published',
  'archived',
  'rejected'
);

-- Step 3: Migrate column to new enum
ALTER TABLE projects
  ALTER COLUMN status TYPE project_status
  USING status::text::project_status;

-- Step 4: Drop old enum
DROP TYPE project_status_old;

-- Step 5: Update any views/functions that reference the enum
-- (Add specific updates based on materialized views)

COMMENT ON TYPE project_status IS 'Global project lifecycle status';
```

### Migration 2: Update TypeScript Types

**File:** `lib/supabase/types.ts`

After migration, regenerate types:
```bash
npx supabase gen types typescript --project-id ogvobdcrectqsegqrquz > lib/supabase/types.ts
```

Expected change:
```typescript
project_status:
  | "draft"
  | "in_progress"
  | "published"
  | "archived"
  | "rejected"
  // "completed" removed
```

### Data Integrity Checks

**Pre-migration validation:**
```sql
-- Check how many projects use 'completed' status
SELECT COUNT(*) FROM projects WHERE status = 'completed';

-- Verify no dependencies on 'completed' in views
SELECT * FROM information_schema.views
WHERE view_definition LIKE '%completed%';
```

**Post-migration validation:**
```sql
-- Verify no 'completed' statuses remain
SELECT COUNT(*) FROM projects WHERE status = 'completed';
-- Expected: ERROR (invalid enum value) or 0

-- Check status distribution
SELECT status, COUNT(*)
FROM projects
GROUP BY status
ORDER BY COUNT(*) DESC;
```

---

## UI/UX Changes

### 1. Dashboard Listings Page (`/app/dashboard/listings/`)

#### Current State
**Owner dropdown:**
- Update status
- Edit cover image
- Edit listing
- Preview listing
- Delete listing

**Contributor dropdown:**
- Opt out (opens modal with warning)

#### New State
**Owner dropdown:**
- Update status → Opens modal with: Unpublished, Published
- Edit cover image
- Edit listing
- Preview listing
- Delete listing

**Contributor dropdown:**
- Update listing status → Opens modal with: Unpublished, Published, Featured
- (Opt out removed)

#### Project Card Enhancements

**For all projects:**
- Existing status chip (top-left)
- Existing role badge (top-right): "Project owner"

**For contributor projects (NEW):**
- Service category label (below subtitle):
  ```
  Service: Interior Design
  ```
- Company status indicator (below subtitle):
  ```
  My company: Featured
  ```

**Example layout:**
```
┌─────────────────────────────────┐
│ [Published]         [More ▾]    │
│                                  │
│     Project Image                │
│                                  │
│ [Project owner]                  │
└─────────────────────────────────┘
Modern Kitchen Renovation
Contemporary • Residential in Amsterdam

OR (for contributors):

┌─────────────────────────────────┐
│ [In Review]         [More ▾]    │
│                                  │
│     Project Image                │
│                                  │
└─────────────────────────────────┘
Modern Kitchen Renovation
Contemporary • Residential in Amsterdam
Service: Interior Design
My company: Featured
```

### 2. Listing Status Modal (Unified)

**Component:** `/components/listing-status-modal.tsx`

**Modal Title:**
- Owner: "Listing status"
- Contributor: "Your company's listing status"

**Modal Description:**
- Owner: (existing)
- Contributor: "Control how your company appears on this project"

**Status Options:**

**For Owners:**
```
○ Unpublished
  Project is not visible to users.
  [••••••••] gray dot

○ Published
  Project is live and visible to users.
  [••••••••] green dot
```

**For Contributors:**
```
○ Unpublished
  Your company will not be listed on this project.
  [••••••••] gray dot

○ Published
  Your company is listed as a contributor on the project page.
  [••••••••] green dot

○ Featured [Plus]
  Project is published and showcased on your company portfolio.
  [••••••••] teal dot
  [Upgrade button] (if not Plus)
```

**Plus Plan Restriction:**
- Non-Plus companies see "Featured" option grayed out
- Tooltip: "Upgrade to Plus to feature projects in your company portfolio"
- Clickable "Upgrade" link

### 3. Dashboard Filter Panel

**File:** `/components/dashboard-listings-filter.tsx`

**Status Filter Options (updated):**
```
☐ Draft
☐ In Review
☐ Published
☐ Unpublished
☐ Rejected (NEW - previously missing)
```

### 4. Admin Projects Table

**File:** `/components/admin-projects-table.tsx`

**Status Labels (updated):**
- draft → "Draft"
- in_progress → "In Review"
- published → "Published"
- archived → "Unpublished"
- rejected → "Rejected"

**Status Dropdown Options:**
- Remove "Listed" (was `completed`)
- Keep all others with new labels

---

## Migration Plan

### Phase 1: Pre-Migration Preparation

**Tasks:**
1. **Audit current status usage**
   ```sql
   SELECT status, COUNT(*) FROM projects GROUP BY status;
   ```
2. **Backup production database** (if applicable)
3. **Review all code references to `completed` status**
   ```bash
   grep -r "completed" --include="*.ts" --include="*.tsx"
   ```
4. **Test migration on staging environment**

### Phase 2: Code Updates (Pre-Deployment)

**Order of updates:**
1. Update all status labels to new standardized values
2. Add contributor status configuration file
3. Update modal to support both owner/contributor modes
4. Update dashboard listings page (remove opt-out, add status modal)
5. Add project card labels (service + status)
6. Update filters to include "Rejected"

**Deploy to staging** → Full QA testing

### Phase 3: Database Migration

**Execution order:**
1. Run migration 096 on production during low-traffic window
2. Verify all `completed` → `published` conversions
3. Regenerate TypeScript types
4. Monitor for errors

**Rollback plan:**
- Keep backup of `project_status_old` enum for 24 hours
- Can revert by recreating old enum and rolling back code

### Phase 4: Post-Migration Cleanup

**Tasks:**
1. Remove all references to `completed` status in code
2. Update admin documentation
3. Notify users of new contributor controls
4. Monitor error logs for issues

**Timeline:** 1 week post-deployment

---

## Testing Plan

### Unit Tests

**New tests required:**

1. **Status label mappings** (`lib/project-status-config.test.ts`)
   ```typescript
   test('all status values have consistent labels', () => {
     expect(PROJECT_STATUS_LABELS.published).toBe('Published')
     expect(PROJECT_STATUS_LABELS.completed).toBeUndefined() // removed
   })
   ```

2. **Contributor status config** (`lib/contributor-status-config.test.ts`)
   ```typescript
   test('contributor options exclude invalid statuses', () => {
     const values = CONTRIBUTOR_LISTING_STATUS_OPTIONS.map(o => o.value)
     expect(values).not.toContain('invited')
     expect(values).not.toContain('rejected')
   })
   ```

### Integration Tests

1. **Owner status update flow**
   - Owner can update from Unpublished → Published
   - Modal shows correct options
   - Database updates correctly
   - UI reflects change immediately

2. **Contributor status update flow**
   - Contributor sees all 3 options
   - Non-Plus sees Featured grayed out
   - Status updates `project_professionals` table, not `projects`
   - Other companies on same project unaffected

3. **Filter functionality**
   - All status filters work correctly
   - "Rejected" filter now appears and functions
   - Filter chips display correct labels

4. **Admin panel**
   - Status labels match user-facing labels
   - Status updates work correctly
   - No `completed` option in dropdown

### Manual QA Checklist

**Dashboard Listings:**
- [ ] Owner projects show "Update status" option
- [ ] Contributor projects show "Update listing status" option
- [ ] Opt-out modal no longer appears
- [ ] Service category displays on contributor projects
- [ ] Company status displays on contributor projects
- [ ] Status chips use new labels

**Listing Status Modal:**
- [ ] Owner sees: Unpublished, Published
- [ ] Contributor sees: Unpublished, Published, Featured
- [ ] Plus badge shows for non-Plus companies
- [ ] Saving updates correct table (projects vs project_professionals)
- [ ] Toast notifications work

**Filters:**
- [ ] All status filters present
- [ ] "Rejected" option now available
- [ ] Filter chips show correct labels
- [ ] Clearing filters works

**Admin Panel:**
- [ ] Status labels consistent
- [ ] No "Listed" or "Completed" options
- [ ] Status updates work
- [ ] Filter by status works

### Database Validation

**Post-migration checks:**
```sql
-- No completed statuses remain
SELECT COUNT(*) FROM projects WHERE status = 'completed';
-- Expected: Error or 0

-- Distribution looks correct
SELECT status, COUNT(*) FROM projects GROUP BY status;

-- All contributor statuses valid
SELECT DISTINCT status FROM project_professionals;
-- Expected: invited, listed, live_on_page, unlisted, rejected, removed
```

---

## Implementation Task List

### Phase 1: Database Migration (1-2 days)

**Priority:** P0 (Blocking)

- [ ] **Task 1.1:** Write migration SQL file `096_remove_completed_status.sql`
  - Convert all `completed` → `published`
  - Recreate enum without `completed`
  - Update table column
  - Drop old enum
  - **Assignee:** Backend
  - **Estimate:** 2 hours

- [ ] **Task 1.2:** Test migration on staging database
  - Run migration
  - Validate data integrity
  - Check performance impact
  - **Assignee:** Backend
  - **Estimate:** 1 hour

- [ ] **Task 1.3:** Regenerate TypeScript types
  - Run Supabase type generation
  - Commit updated types file
  - **Assignee:** Backend
  - **Estimate:** 15 minutes

### Phase 2: Status Configuration Updates (1 day)

**Priority:** P0 (Blocking)

- [ ] **Task 2.1:** Update `/lib/project-status-config.ts`
  - Standardize all labels (Draft, In Review, Published, Unpublished, Rejected)
  - Remove `completed` references
  - Update `LISTING_STATUS_OPTIONS` array
  - **Files:** `lib/project-status-config.ts`
  - **Assignee:** Frontend
  - **Estimate:** 1 hour

- [ ] **Task 2.2:** Create `/lib/contributor-status-config.ts`
  - Define `CONTRIBUTOR_STATUS_LABELS`
  - Define `CONTRIBUTOR_LISTING_STATUS_OPTIONS`
  - Export status helper functions
  - **Files:** `lib/contributor-status-config.ts` (NEW)
  - **Assignee:** Frontend
  - **Estimate:** 1 hour

- [ ] **Task 2.3:** Update admin panel status labels
  - Update `STATUS_LABELS` in admin table
  - Update `STATUS_CHOICES` descriptions
  - **Files:** `components/admin-projects-table.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 30 minutes

- [ ] **Task 2.4:** Update dashboard filter labels
  - Update `STATUS_OPTIONS` array
  - Add "Rejected" option
  - **Files:** `components/dashboard-listings-filter.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 15 minutes

### Phase 3: Listing Status Modal Updates (2 days)

**Priority:** P0 (Blocking)

- [ ] **Task 3.1:** Make modal role-aware
  - Add `role?: "owner" | "contributor"` prop
  - Conditionally render title/description
  - Update prop types
  - **Files:** `components/listing-status-modal.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 1 hour

- [ ] **Task 3.2:** Add Plus plan restriction for contributors
  - Show "Featured" option with Plus badge
  - Disable if company not Plus
  - Add upgrade link
  - **Files:** `components/listing-status-modal.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 1 hour

- [ ] **Task 3.3:** Update modal status options logic
  - Owner gets owner options (exclude Featured)
  - Contributor gets contributor options (include Featured)
  - Ensure correct status values passed
  - **Files:** `components/listing-status-modal.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 1 hour

### Phase 4: Dashboard Listings Page Updates (3 days)

**Priority:** P0 (Blocking)

- [ ] **Task 4.1:** Add contributor status state management
  - Add `selectedContributorStatus` state
  - Add `contributorStatusModalOpen` state
  - Import contributor config
  - **Files:** `app/dashboard/listings/page.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 30 minutes

- [ ] **Task 4.2:** Create contributor status update handler
  - `handleUpdateContributorStatus(project)`
  - Map current status to modal status
  - Open modal with correct state
  - **Files:** `app/dashboard/listings/page.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 1 hour

- [ ] **Task 4.3:** Create contributor status save handler
  - `handleSaveContributorStatus()`
  - Update `project_professionals.status`
  - Update local state
  - Show toast notification
  - **Files:** `app/dashboard/listings/page.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 1.5 hours

- [ ] **Task 4.4:** Replace opt-out dropdown with status modal
  - Update contributor dropdown menu (lines 1139-1150)
  - Replace "Opt out" with "Update listing status"
  - Wire to new handler
  - **Files:** `app/dashboard/listings/page.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 30 minutes

- [ ] **Task 4.5:** Remove opt-out modal completely
  - Delete modal JSX (lines 1292-1319)
  - Remove `optOutModalOpen` state
  - Remove `projectToOptOut` state
  - Remove `isOptingOut` state
  - Remove `handleOptOut` handler
  - Remove `handleConfirmOptOut` handler
  - Remove `handleCancelOptOut` handler
  - **Files:** `app/dashboard/listings/page.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 30 minutes

- [ ] **Task 4.6:** Add service category label to project cards
  - Display invited service category below subtitle
  - Only show for contributor projects
  - Style consistently with existing labels
  - **Files:** `app/dashboard/listings/page.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 1 hour

- [ ] **Task 4.7:** Add company status indicator to project cards
  - Display contributor's company status below subtitle
  - Use status labels from config
  - Only show for contributor projects
  - **Files:** `app/dashboard/listings/page.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 1 hour

- [ ] **Task 4.8:** Render contributor status modal
  - Add `ListingStatusModal` for contributors
  - Pass correct props (role, options, handlers)
  - Wire to contributor state
  - **Files:** `app/dashboard/listings/page.tsx`
  - **Assignee:** Frontend
  - **Estimate:** 1 hour

### Phase 5: Testing & QA (2 days)

**Priority:** P0 (Blocking)

- [ ] **Task 5.1:** Unit tests for status configs
  - Test label consistency
  - Test status mappings
  - Test helper functions
  - **Files:** `lib/project-status-config.test.ts`, `lib/contributor-status-config.test.ts`
  - **Assignee:** Frontend
  - **Estimate:** 2 hours

- [ ] **Task 5.2:** Integration tests for status updates
  - Owner status update flow
  - Contributor status update flow
  - Modal rendering logic
  - **Files:** `app/dashboard/listings/page.test.tsx`
  - **Assignee:** Frontend/QA
  - **Estimate:** 3 hours

- [ ] **Task 5.3:** Manual QA on staging
  - Follow manual QA checklist (see Testing Plan)
  - Test all user flows
  - Verify labels consistent
  - **Assignee:** QA
  - **Estimate:** 4 hours

- [ ] **Task 5.4:** Database validation
  - Run post-migration SQL checks
  - Verify data integrity
  - Check performance
  - **Assignee:** Backend/QA
  - **Estimate:** 1 hour

### Phase 6: Documentation & Deployment (1 day)

**Priority:** P1 (High)

- [ ] **Task 6.1:** Update CLAUDE.md with new architecture
  - Document status system changes
  - Update terminology guide
  - **Files:** `CLAUDE.md`
  - **Assignee:** Tech Lead
  - **Estimate:** 30 minutes

- [ ] **Task 6.2:** Create user-facing changelog
  - Document new contributor controls
  - Explain status options
  - **Files:** `CHANGELOG.md` or similar
  - **Assignee:** Product
  - **Estimate:** 30 minutes

- [ ] **Task 6.3:** Deploy to production
  - Run migration during low-traffic window
  - Deploy frontend changes
  - Monitor error logs
  - **Assignee:** DevOps
  - **Estimate:** 1 hour

- [ ] **Task 6.4:** Post-deployment verification
  - Smoke test critical flows
  - Monitor Sentry/logs for errors
  - Check database status distribution
  - **Assignee:** On-call engineer
  - **Estimate:** 1 hour

### Dependency Graph

```
Task 1.1 → Task 1.2 → Task 1.3
                        ↓
Task 2.1, 2.2, 2.3, 2.4 (parallel)
                        ↓
Task 3.1 → Task 3.2 → Task 3.3
                        ↓
Task 4.1 → Task 4.2, 4.3 (parallel) → Task 4.4 → Task 4.5
                                                    ↓
                                Task 4.6, 4.7, 4.8 (parallel)
                                                    ↓
                        Task 5.1, 5.2 (parallel) → Task 5.3, 5.4
                                                    ↓
                                Task 6.1, 6.2 (parallel) → Task 6.3 → Task 6.4
```

### Total Effort Estimate

| Phase | Duration | Engineers Required |
|-------|----------|-------------------|
| Phase 1: Database | 1-2 days | 1 Backend |
| Phase 2: Configs | 1 day | 1 Frontend |
| Phase 3: Modal | 2 days | 1 Frontend |
| Phase 4: Dashboard | 3 days | 1 Frontend |
| Phase 5: Testing | 2 days | 1 Frontend + 1 QA |
| Phase 6: Deployment | 1 day | 1 DevOps + 1 On-call |
| **Total** | **7-8 business days** | **2-3 engineers** |

---

## Risk Assessment

### High Risk

**Risk:** Database enum migration fails or causes downtime
- **Mitigation:** Test extensively on staging, run during low-traffic window
- **Rollback:** Keep old enum for 24 hours, can revert if needed
- **Impact:** High (affects all projects)

**Risk:** Users confused by status changes
- **Mitigation:** Clear communication, changelog, in-app tooltips
- **Rollback:** N/A (user education issue)
- **Impact:** Medium

### Medium Risk

**Risk:** RLS policies broken by enum change
- **Mitigation:** Test RLS thoroughly on staging, validate all queries
- **Rollback:** Revert migration
- **Impact:** High (security issue)

**Risk:** Materialized views reference old enum value
- **Mitigation:** Search codebase for `completed` references, update views
- **Rollback:** Recreate views with old logic
- **Impact:** Medium (performance degradation)

### Low Risk

**Risk:** Frontend state management bugs with new modal
- **Mitigation:** Thorough unit/integration tests, manual QA
- **Rollback:** Hotfix or rollback frontend deployment
- **Impact:** Low (affects UX only)

**Risk:** TypeScript type generation fails
- **Mitigation:** Verify Supabase CLI version, test locally first
- **Rollback:** Manually restore old types file
- **Impact:** Low (blocks deployment temporarily)

---

## Appendices

### Appendix A: SQL Migration Reference

**File:** `supabase/migrations/096_remove_completed_status.sql`

See [Database Schema Changes](#database-schema-changes) section for full SQL.

### Appendix B: Status Mapping Table

| Old System | New System | User Label |
|------------|------------|------------|
| `project_status = 'completed'` | `project_status = 'published'` | "Published" |
| N/A (no owner featured) | `professional_project_status = 'live_on_page'` | "Featured" (contributor only) |

### Appendix C: Component File Changes Summary

| File | Lines Changed | Type |
|------|---------------|------|
| `lib/project-status-config.ts` | ~50 | Edit |
| `lib/contributor-status-config.ts` | ~80 | Create |
| `components/listing-status-modal.tsx` | ~30 | Edit |
| `app/dashboard/listings/page.tsx` | ~200 | Edit |
| `components/dashboard-listings-filter.tsx` | ~10 | Edit |
| `components/admin-projects-table.tsx` | ~40 | Edit |
| `supabase/migrations/096_remove_completed_status.sql` | ~50 | Create |

**Total:** ~460 lines changed across 7 files

### Appendix D: Plus Plan Feature Matrix

| Feature | Basic Plan | Plus Plan |
|---------|-----------|-----------|
| List projects | ✅ Yes | ✅ Yes |
| Published status (project page) | ✅ Yes | ✅ Yes |
| Featured status (portfolio) | ❌ No | ✅ Yes |
| Appear in search results | Current behavior | Boosted visibility |
| Active project limit | 3 | Unlimited |

**Note:** Plus filtering for search results remains unchanged in this release.

### Appendix E: Glossary

- **Project Owner:** User who created the project (client)
- **Contributor:** Company invited to work on a project
- **Team Member:** Individual user within a company (`professionals` table)
- **Company:** Primary marketplace entity that gets hired
- **Global Status:** `projects.status` - overall project lifecycle
- **Listing Status:** `project_professionals.status` - per-company visibility
- **Portfolio:** Company page showing featured projects
- **Plus Plan:** Premium subscription tier with additional features

---

## Approval & Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Tech Lead | | | |
| Backend Lead | | | |
| Frontend Lead | | | |
| QA Lead | | | |

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-06 | System Analysis | Initial draft |

---

**Next Steps:**

1. Review and approve PRD
2. Schedule kickoff meeting
3. Assign tasks to engineers
4. Begin Phase 1 (Database Migration)
