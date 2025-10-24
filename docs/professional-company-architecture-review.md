# Professional vs Company Architecture Review

## Executive Summary

This document outlines the current state and required changes to properly implement the company-centric architecture for the Arco platform. Currently, many parts of the application incorrectly reference `professionals` when they should reference `companies` as the primary public-facing entity.

**Date:** October 24, 2025
**Status:** Review Complete - Implementation Required

---

## Database Architecture

### Current Schema (Correct)

#### Companies Table
- **Purpose:** Public-facing company profiles
- **Owner:** `owner_id` → profiles.id
- **Fields:** name, description, logo_url, website, city, country, status, plan_tier, etc.
- **Status:** ✅ Correctly structured

#### Professionals Table
- **Purpose:** Individual professional profiles (internal, can have multiple per company in future)
- **Links to Company:** `company_id` → companies.id (optional)
- **Links to User:** `user_id` → profiles.id (unique, one-to-one)
- **Fields:** title, bio, hourly_rate, years_experience, etc.
- **Status:** ✅ Correctly structured
- **Finding:** ALL 13 professionals have a company_id ✅

#### Project Professionals Table
- **Purpose:** Track professional invitations to projects
- **Has Both:** `professional_id` AND `company_id` columns ✅
- **Status:** ✅ Already updated to support company references

---

## Problems Identified

### 1. Reviews System (CRITICAL)

**Problem:** Reviews are linked to `professionals.id` instead of `companies.id`

**Current State:**
```sql
-- reviews table
professional_id UUID NOT NULL REFERENCES professionals(id)

-- professional_ratings table  
professional_id UUID PRIMARY KEY REFERENCES professionals(id)
```

**Impact:**
- Reviews are attached to individual professional profiles
- When viewing a company page, reviews reference the wrong entity
- Rating aggregations are calculated for professionals instead of companies

**Expected Behavior:**
- Users leave reviews on company pages
- Reviews should be linked to companies
- Multiple professionals from the same company should share the same reviews/ratings

**Required Changes:**
1. Add `company_id` column to `reviews` table
2. Create `company_ratings` table (mirror of professional_ratings)
3. Update review triggers to update company_ratings instead of professional_ratings
4. Migrate existing reviews to link to companies
5. Update all review queries to use company_id

---

### 2. Professional URLs & Detail Pages (HIGH)

**Problem:** URLs go to `/professionals/[professional-id]` instead of `/companies/[company-slug]`

**Current State:**
- Professional card links: `/professionals/${professional.slug}` (professional-card.tsx:35)
- Professional detail page: `app/professionals/[slug]/page.tsx`
- Fetches from professionals table: `fetchProfessionalDetail(professionalId)`

**Impact:**
- Users navigate to professional pages, not company pages
- SEO optimization for wrong entity
- Confusing user experience (seeing "professional" everywhere instead of "company")

**Expected Behavior:**
- Primary discovery should show companies
- URLs should be `/companies/[company-slug]` or `/c/[company-slug]`
- Detail pages should display company information as primary
- Professional information can be secondary (owner, team members)

**Required Changes:**
1. Create new route: `app/companies/[slug]/page.tsx`
2. Update all links to point to company pages
3. Redirect `/professionals/[id]` to `/companies/[slug]`
4. Update metadata/SEO for company pages

---

### 3. Saved Professionals (MEDIUM)

**Problem:** Users save `professional_id` instead of `company_id`

**Current State:**
```sql
CREATE TABLE saved_professionals (
  user_id UUID,
  professional_id UUID REFERENCES professionals(id),
  ...
)
```

**Impact:**
- Users save individual professionals, not companies
- If a company has multiple professionals in future, bookmarks won't work correctly
- Heart icon on professional cards saves wrong entity

**Expected Behavior:**
- Users should save companies
- Table should be named `saved_companies`
- References should be to companies.id

**Required Changes:**
1. Create `saved_companies` table
2. Migrate data from `saved_professionals` to `saved_companies`
3. Update save/unsave actions to use companies
4. Update context/hooks (saved-professionals-context.tsx)

---

### 4. Materialized View & Search (MEDIUM)

**Problem:** `mv_professional_summary` is built around professionals, not companies

**Current State:**
- View name: `mv_professional_summary`
- Primary key: professional.id
- Joins companies as secondary entity
- Search function: `search_professionals()`

**Impact:**
- Semantically incorrect naming
- Confusing for future development
- Search results structured around professionals

**Expected Behavior:**
- View should be company-centric
- Could be renamed to `mv_company_listing` or `mv_company_summary`
- Companies should be primary, with professional data as supplementary

**Required Changes:**
1. Consider renaming view to `mv_company_listing`
2. Update search function to `search_companies()`
3. Restructure to have companies as primary entity
4. Keep professional data as supporting information

---

### 5. Admin Management (CORRECT ✅)

**Status:** Already correctly implemented

**Current Implementation:**
- Admin page: `app/admin/professionals/page.tsx`
- Shows companies table ✅
- Uses `admin_company_professional_metrics` view ✅
- Displays company-centric data ✅

**Note:** This is the correct pattern that other parts of the app should follow.

---

## Page-by-Page Analysis

### Landing Page (app/page.tsx)
**Status:** ⚠️ Partially Incorrect
- Uses `mv_professional_summary` (line 99)
- Shows "Featured Professionals" section
- Should show "Featured Companies" instead
- **Fix:** Update component name and data source

### Professionals Discovery Page (app/professionals/page.tsx)
**Status:** ❌ Incorrect
- URL: `/professionals`
- Should be `/companies` or keep URL but update semantics
- Uses `fetchDiscoverProfessionals()` from lib/professionals/queries.ts
- Grid shows professional cards that link to professional detail pages
- **Fix:** Route can stay as `/professionals` (user-facing term) but should display companies

### Professional Detail Page (app/professionals/[slug]/page.tsx)
**Status:** ❌ Incorrect
- Shows individual professional data
- Uses `fetchProfessionalDetail()`
- Reviews query: `.eq("professional_id", professionalId)` (line 621)
- Should be company detail page
- **Fix:** Create company detail page, redirect to it

### Project Detail Page (app/projects/[slug]/page.tsx)
**Status:** ⚠️ Mixed
- Fetches both professional_id and company_id (line 344) ✅
- Joins to both professionals and companies tables ✅
- Need to verify which links are displayed
- **Check:** Ensure links go to company pages, not professional pages

---

## Invite Workflow Analysis

### Current Implementation (Correct ✅)

**File:** `lib/new-project/invite-professionals.ts`

**Status:** Already supports both professional_id AND company_id
```typescript
export interface InviteData {
  project_id: string
  invited_service_category_id: string
  invited_email: string
  professional_id?: string | null  // For linking to professional user
  company_id?: string | null       // For linking to company object
  ...
}
```

**createInvite function** (line 87-115):
- Correctly inserts both professional_id and company_id ✅
- Status logic: 'listed' if professional exists, 'invited' otherwise ✅

**Display logic** (line 120-138):
- Shows company name as primary when professional exists ✅
- Shows email when invite pending ✅

**Finding:** The invite system is already correctly structured for company-centric architecture.

---

## Components Requiring Updates

### Navigation & Links
1. `components/professional-card.tsx` - Link to company page instead
2. `components/featured-professionals.tsx` - Could rename to featured-companies
3. `components/professionals-grid.tsx` - Update links
4. `components/professionals-section.tsx` - Update for project detail pages

### Queries & Data Fetching
1. `lib/professionals/queries.ts` - Most queries are correct (fetch professional but return company data)
2. Review queries need updating (lines 619-624)
3. Type definitions may need renaming for clarity

### Contexts & Hooks
1. `contexts/saved-professionals-context.tsx` - Should be saved-companies
2. `hooks/use-professionals-query.ts` - Check if needs updating

---

## Migration Strategy

### Phase 1: Reviews System (Critical)
1. Create migration to add company_id to reviews table
2. Create company_ratings table
3. Backfill company_id for existing reviews
4. Update review triggers
5. Update all review queries in the codebase
6. Test review submission and display

### Phase 2: URLs & Routing
1. Create /companies/[slug] route structure
2. Implement company detail pages
3. Add redirects from /professionals/[id] to /companies/[slug]
4. Update all internal links
5. Update sitemaps and SEO

### Phase 3: Saved Entities
1. Create saved_companies table
2. Migrate data from saved_professionals
3. Update save/unsave actions
4. Update context and components

### Phase 4: View Refactoring (Optional)
1. Consider renaming mv_professional_summary
2. Update search functions
3. Update documentation

---

## Questions for Resolution

1. **URL Structure:** Should we keep `/professionals` as user-facing URL but display companies? Or change to `/companies`?
   - Recommendation: Keep `/professionals` URL (familiar to users) but make it clear these are companies

2. **Professional Profile Visibility:** Should individual professional profiles be viewable at all?
   - Recommendation: No public pages for individual professionals, only company pages with team member info

3. **Saved Professionals:** Should this become "saved companies" or "saved professionals" (as a user-facing term)?
   - Recommendation: User-facing: "Saved professionals", Backend: saved_companies table

4. **Multiple Professionals per Company:** When should this be implemented?
   - Note: Database already supports it, UI doesn't need to change yet

---

## Success Criteria

- [ ] All reviews are linked to companies
- [ ] All detail pages show company as primary entity
- [ ] All URLs point to company pages
- [ ] Saved items reference companies
- [ ] Admin interface remains company-focused
- [ ] Invite workflow continues to work correctly
- [ ] Search and discovery show companies
- [ ] No broken links or 404s
- [ ] All tests pass
- [ ] SEO optimized for companies

---

## Related Files

### Database
- `supabase/migrations/003_create_companies_and_professionals.sql`
- `supabase/migrations/006_create_user_interactions.sql` (reviews)
- `supabase/migrations/013_create_project_professionals_table.sql`
- `supabase/migrations/053_optimize_professional_search.sql` (mv_professional_summary)

### Pages
- `app/professionals/page.tsx`
- `app/professionals/[slug]/page.tsx`
- `app/page.tsx` (landing)
- `app/projects/[slug]/page.tsx`
- `app/admin/professionals/page.tsx` ✅

### Queries
- `lib/professionals/queries.ts`
- `lib/new-project/invite-professionals.ts` ✅

### Components
- `components/professional-card.tsx`
- `components/featured-professionals.tsx`
- `components/professional-info.tsx`
- `components/professional-reviews.tsx`
- `components/professionals-grid.tsx`

---

## Conclusion

The database architecture is mostly correct and already supports company-centric design. The main issues are:

1. **Reviews** are the most critical - they reference professionals instead of companies
2. **URLs and routing** need to be company-focused
3. **Saved items** should reference companies
4. **Naming and semantics** throughout the app should emphasize companies

The admin interface is already correctly implemented and should serve as the model for other parts of the application.
