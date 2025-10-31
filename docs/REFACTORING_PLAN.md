# Database Refactoring Plan - Company-Centric Architecture

**Date:** 2025-10-31
**Status:** ✅ PHASE 1 COMPLETE | ❌ PHASE 2 CANCELLED
**Final Completion:** 2025-10-31

## 🎯 Final Status

**Phase 1:** ✅ **COMPLETE** - Unused tables successfully removed
**Phase 2:** ❌ **CANCELLED** - Risk outweighs benefit after CASCADE incident

## ⚠️ CASCADE Incident

Phase 1 migration used `DROP TABLE ... CASCADE` which caused unintended deletions:
- Dropped `mv_project_summary` and `mv_professional_summary` materialized views
- Dropped `project_search_documents` and `professional_search_documents` views
- Required 3 hotfix migrations (091, 092, 093) to restore functionality

**See:** `CASCADE_INCIDENT_REPORT.md` for full details

**Decision:** Phase 2 (renaming `professionals` → `team_members`) cancelled due to risk concerns.

## ✅ What Was Accomplished

1. **Tables Removed:** project_applications, notifications, saved_professionals
2. **Code Updated:** 2 files cleaned up (admin/users/actions.ts, components/faq12.tsx)
3. **Types Regenerated:** TypeScript types updated to match new schema
4. **Documentation Updated:** CLAUDE.md now explains terminology for AI agents
5. **Views Restored:** All materialized views and search documents working

---

## Executive Summary

This document outlines a phased approach to refactoring Arco's database architecture from a professional-centric model to a company-centric model, while maintaining the complex invite workflow that depends on individual user emails.

**Key Goals:**
1. Remove 3 unused tables (Phase 1) ✅ APPROVED
2. Rename `professionals` → `team_members` to reflect true purpose (Phase 2) ✅ APPROVED BUT CANCELLED
3. Use two-phase migration for safety ✅ APPROVED
4. Keep `professional_id` column name (understood as user reference) ✅ APPROVED
5. Preserve the invite workflow integrity ✅ CRITICAL

---

## Current State Analysis

### Tables Overview

| Table | Rows | Status | Purpose |
|-------|------|--------|---------|
| `project_applications` | 0 | ❌ UNUSED | Professional applications (never implemented) |
| `notifications` | 0 | ❌ UNUSED | System notifications (never implemented) |
| `saved_professionals` | 1 | ⚠️ DEPRECATED | Being replaced by `saved_companies` |
| `professionals` | 14 | ⚠️ MISNAMED | Individual team members (not standalone professionals) |
| `companies` | 14 | ✅ PRIMARY | Main marketplace entity |
| `project_professionals` | 19 | ✅ CRITICAL | Invite workflow (DO NOT BREAK) |

---

## Phase 1: Clean Up Unused Tables

**Goal:** Remove tables that are only in TypeScript types, never queried

### 1.1 Remove `saved_professionals`

**Current Dependencies:**
- `app/admin/users/actions.ts:527` - Counts rows before user deletion
- Already migrated to `saved_companies` in `contexts/saved-professionals-context.tsx`

**Migration Steps:**
```sql
-- Migration: 0XX_drop_saved_professionals.sql

-- Remove foreign key dependencies first
ALTER TABLE IF EXISTS saved_professionals DROP CONSTRAINT IF EXISTS saved_professionals_professional_id_fkey;
ALTER TABLE IF EXISTS saved_professionals DROP CONSTRAINT IF EXISTS saved_professionals_user_id_fkey;

-- Drop the table
DROP TABLE IF EXISTS public.saved_professionals CASCADE;

-- Update RLS policies if any references exist
-- (None found in migrations)
```

**Code Changes:**
- [x] Remove line 527 from `app/admin/users/actions.ts`
- [x] Regenerate TypeScript types: `mcp__supabase__generate_typescript_types`
- [x] Test admin user deletion flow

---

### 1.2 Remove `project_applications`

**Current Dependencies:**
- NONE - Only exists in TypeScript types

**Migration Steps:**
```sql
-- Migration: 0XX_drop_project_applications.sql

-- This table has foreign keys but no data and is never queried
DROP TABLE IF EXISTS public.project_applications CASCADE;
```

**Code Changes:**
- [x] Regenerate TypeScript types
- [x] No code changes needed (never referenced)

---

### 1.3 Remove `notifications`

**Current Dependencies:**
- `app/admin/projects/actions.ts:378` - Comment/warning message only
- `components/faq12.tsx:74` - Marketing copy only

**Migration Steps:**
```sql
-- Migration: 0XX_drop_notifications.sql

DROP TABLE IF EXISTS public.notifications CASCADE;
```

**Code Changes:**
- [x] Update FAQ text in `components/faq12.tsx:74` to remove notification mention
- [x] Regenerate TypeScript types
- [x] No functional code changes needed

---

### 1.4 Phase 1 Testing Checklist

- [x] Run migrations on development branch
- [x] Verify admin user deletion works without `saved_professionals`
- [x] Check TypeScript compilation after type regeneration
- [x] Test saved companies workflow (should be unchanged)
- [x] Admin can still view/manage users
- [x] No broken imports or type errors

**Rollback Plan:**
- Keep migration files but don't apply to production
- Can recreate tables from migration history if needed

---

## Phase 2: Rename Professionals → Team Members (CANCELLED)

**Goal:** Reflect true purpose of table while preserving invite workflow

**Status:** ❌ CANCELLED after CASCADE incident demonstrated unacceptable risk level

### 2.1 Current `professionals` Table Analysis

**Purpose:** Links users to companies as team members

**Current Schema:**
```sql
CREATE TABLE professionals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),      -- Individual user
  company_id UUID REFERENCES companies(id),            -- Their company
  title TEXT NOT NULL,                                 -- Role/title
  bio TEXT,                                           -- Personal bio
  years_experience INTEGER,
  hourly_rate_min NUMERIC,
  hourly_rate_max NUMERIC,
  portfolio_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  services_offered TEXT[],                            -- REDUNDANT with companies
  languages_spoken TEXT[] DEFAULT '{Dutch,English}',  -- REDUNDANT with companies
  is_featured BOOLEAN DEFAULT false,                  -- REDUNDANT with companies
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Problems:**
1. Name implies standalone professional, but it's really a team member
2. Duplicates company-level data (services, languages, featured status)
3. Confused with `companies` which is the real marketplace entity

---

### 2.2 Why We Call It "professionals" But It's Actually "team_members"

**Key Architectural Insight:**

The app is **company-centric**, not professional-centric:
- The `/professionals` page shows COMPANIES, not individual profiles
- Users hire COMPANIES, not individuals
- The `professionals` table tracks individual team members WITHIN companies
- Invites go to individual emails, but companies get hired

**This confusion:**
- ❌ Makes AI agents misunderstand the architecture
- ❌ Leads to incorrect code suggestions
- ❌ Makes database relationships unclear

**Mitigation (since Phase 2 cancelled):**
- ✅ CLAUDE.md updated with terminology guide for AI agents
- ✅ Documentation clarifies `professionals` = team members within companies
- ✅ CODE_REVIEW_PROFESSIONALS.md explains full architecture

---

### 2.3 Critical: `project_professionals` Invite Workflow

**DO NOT BREAK THIS TABLE** - It powers the entire invite system

**Current Schema:**
```sql
CREATE TABLE project_professionals (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),

  -- Company being invited
  company_id UUID REFERENCES companies(id),             -- Set when professional exists

  -- Individual user within company
  professional_id UUID REFERENCES professionals(id),    -- Set when user has account

  -- Invite details
  invited_email TEXT NOT NULL,                          -- The actual user's email
  invited_service_category_id UUID REFERENCES categories(id),

  -- Status workflow
  status professional_project_status DEFAULT 'invited',
  is_project_owner BOOLEAN DEFAULT false,

  invited_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);
```

**How Invite Workflow Works:**

1. **Project owner invites via email:**
   - Can select existing professional from dropdown (if admin/professional)
   - OR enter any email address manually

2. **Invite record created:**
   ```typescript
   {
     invited_email: "john@example.com",      // Always present
     professional_id: null,                  // null if user doesn't exist
     company_id: null,                       // null if user doesn't exist
     status: 'invited'                       // pending invite
   }
   ```

3. **User receives email:**
   - Existing professional → redirected to dashboard
   - Existing user (not professional) → redirected to create-company
   - New user → redirected to signup → create-company

4. **User creates company/professional profile:**
   - Professional record created with company_id
   - `claimPendingInvitesAction()` runs
   - Matches `invited_email` to new professional
   - Updates invite:
   ```typescript
   {
     invited_email: "john@example.com",
     professional_id: "abc-123",             // NOW SET
     company_id: "xyz-789",                  // NOW SET
     status: 'listed',                       // claimed!
     responded_at: now()
   }
   ```

**Key Insight:** The invite workflow needs:
- Individual user emails (not company emails)
- Link to specific user account (professional_id)
- Link to their company (company_id)
- Both can be NULL during invite, populated on claim

**See:** `CODE_REVIEW_PROFESSIONALS.md` for complete workflow diagram with 30+ file dependencies

---

## 📚 Key Documents

- **This file:** Overall refactoring plan and architectural context
- **CASCADE_INCIDENT_REPORT.md:** Detailed analysis of what went wrong in Phase 1
- **CODE_REVIEW_PROFESSIONALS.md:** Full code analysis (30+ files, invite workflow diagram)
- **MV_REFACTORING_PLAN.md:** Safety guardrails for future schema changes
- **CLAUDE.md:** Updated with terminology guidance for AI agents

---

## 🎓 Lessons Learned

1. **Never use CASCADE blindly** - Always check dependencies first
2. **Test on branches** - Use Supabase branches for risky migrations
3. **Small steps** - Better to do 10 small migrations than 1 big one
4. **Document risks** - Be explicit about what could break
5. **Know when to stop** - Sometimes "good enough" is better than "perfect"
6. **Materialized views are features** - Don't treat performance optimizations as problems

---

## ✅ Success Criteria - FINAL RESULTS

### Phase 1 Success ✅ ACHIEVED
- [x] All 3 unused tables dropped
- [x] No TypeScript errors (types regenerated)
- [x] All existing features work unchanged (after hotfixes)
- [x] Admin user deletion works
- [x] Materialized views restored
- [x] Search functionality working

### Phase 2 Success ❌ CANCELLED
- Phase 2 was cancelled due to excessive risk demonstrated by CASCADE incident
- Current `professionals` table name is acceptable with documentation in CLAUDE.md
- AI agents now have clear guidance that `professionals` = team members

---

**Document Version:** 3.0 FINAL
**Status:** Phase 1 Complete ✅ | Phase 2 Cancelled ❌
**Last Updated:** 2025-10-31
**Owner:** Development Team
