# Professionals Page Data Architecture

**Date:** October 24, 2025  
**Page:** `/professionals`  
**Purpose:** Discovery page for browsing professional companies

---

## Key Understanding: "Professional" is User-Facing Terminology

✅ **Correct:** Using "professional" terminology throughout the UI is fine and expected.  
✅ **What matters:** The underlying **data** should be company-centric.

---

## Current Data Structure

### What Gets Displayed on `/professionals`

Each "professional card" shows **company data**, not individual professional data:

```typescript
type ProfessionalCard = {
  id: string              // professional.id (for backwards compatibility)
  slug: string            // professional.id (used in URL)
  companyId: string       // ✅ company.id 
  name: string            // ✅ company.name (primary) or profile name (fallback)
  profession: string      // professional.title or primary specialty
  location: string        // ✅ company.city, company.country (primary)
  rating: number          // Currently from professional_ratings ❌ Should be company_ratings
  reviewCount: number     // Currently from professional_ratings ❌ Should be company_ratings
  image: string           // ✅ company.logo_url (primary) or profile avatar (fallback)
  specialties: string[]   // professional.services_offered
  isVerified: boolean     // professional.is_verified
  domain: string | null   // ✅ company.domain
}
```

### Data Source

**Primary Query:** `search_professionals()` RPC function  
**Source View:** `mv_professional_summary` materialized view

**View Structure (migration 053):**
- Joins: `professionals` → `companies` → `profiles` → `professional_ratings`
- **Company data is already primary** in the view ✅
- Returns company fields: `company_id`, `company_name`, `company_logo`, `company_city`, `company_country`, etc.
- Filters by: `company_plan_tier = 'plus'`, `company_status = 'listed'`

---

## Filtering System

### Available Filters

**1. Service Filters** (professionals-filter-bar.tsx)
- Categories (parent): Design & Planning, Construction, Systems, Finishing, Outdoor
- Services (children): Architecture, Interior Design, Kitchen, Bathroom, etc.
- Stored in `categories` table (hierarchical)
- Filters query by `specialty_ids` and `specialty_parent_ids` arrays in view

**2. Location Filters**
- Country, State/Region, City dropdowns
- Fetched from `get_professional_location_facets()` RPC
- Returns distinct locations from `mv_professional_summary` where:
  - `is_available = TRUE`
  - `company_plan_tier = 'plus'`
  - `company_status = 'listed'`
- Uses **company location fields** ✅

**3. Keyword Search**
- Searches `search_vector` column in `mv_professional_summary`
- Vector includes: company name, title, bio, location, specialties, services, languages
- Uses PostgreSQL full-text search with `plainto_tsquery`

**4. Additional Filters** (in RPC, not exposed in UI yet)
- `min_rating`: Filter by minimum rating
- `max_hourly_rate`: Filter by hourly rate
- `verified_only`: Show only verified professionals

### Filter Context (professional-filter-context.tsx)

**URL Parameters:**
- `?categories=architecture,interior-design`
- `?services=kitchen,bathroom`
- `?country=Netherlands&state=Noord-Holland&city=Amsterdam`
- `?search=modern+architect`

**State Management:**
- Uses React reducer pattern
- Syncs with URL query params (debounced)
- Token-based mapping (supports slugs, IDs, names)
- Auto-clears dependent filters (e.g., changing country clears state/city)

---

## How the Search Works

### 1. Initial Server-Side Load
```typescript
// app/professionals/page.tsx
const professionals = await fetchDiscoverProfessionals()
```
- Fetches first 20 results without filters
- Passed as initial data to client

### 2. Client-Side Filtering
```typescript
// hooks/use-professionals-query.ts
const { professionals, loadMore } = useProfessionalsQuery(initialProfessionals)
```
- Watches filter context changes
- Calls `search_professionals()` RPC with filter params
- Supports pagination (20 items per page)
- Aborts previous requests if filters change

### 3. RPC Function: `search_professionals()`
```sql
-- Parameters
search_query TEXT
country_filter TEXT
state_filter TEXT  
city_filter TEXT
category_filters UUID[]     -- Parent category IDs
service_filters UUID[]      -- Child service IDs
min_rating DECIMAL
max_hourly_rate DECIMAL
verified_only BOOLEAN
limit_count INTEGER
offset_count INTEGER

-- Returns company-centric data
id, company_id, company_name, company_logo, company_city, 
company_country, primary_specialty, display_rating, total_reviews, etc.
```

**Filtering Logic:**
```sql
WHERE
  is_available = TRUE
  AND company_plan_tier = 'plus'           -- ✅ Only Plus plan
  AND company_status = 'listed'            -- ✅ Only listed companies
  AND (company_plan_expires_at IS NULL 
       OR company_plan_expires_at > NOW()) -- ✅ Active subscriptions
  AND (search_query IS NULL 
       OR search_vector @@ plainto_tsquery('simple', search_query))
  AND (country_filter IS NULL 
       OR searchable_country = lower(trim(country_filter)))
  AND specialty_parent_ids && category_filters  -- Array overlap
  AND specialty_ids && service_filters          -- Array overlap
```

**Sorting:**
```sql
ORDER BY
  is_verified DESC,        -- Verified first
  display_rating DESC,     -- Higher ratings first
  total_reviews DESC,      -- More reviews first
  created_at DESC          -- Newer first
```

---

## Visual Display Logic

### Card Mapping (lib/professionals/queries.ts:355)

```typescript
const name = row.company_name || fullName || "Professional"
// ✅ Company name is primary

const profession = row.title || row.primary_specialty || "Professional"
// Shows individual's title (e.g., "Senior Architect")

const location = [row.company_city, row.company_country].join(", ")
// ✅ Company location is primary

const image = row.company_logo || profile.avatar_url || PLACEHOLDER_IMAGE
// ✅ Company logo is primary
```

### Card Component (components/professional-card.tsx)

Displays:
- **Image:** Company logo (or profile avatar fallback)
- **Name:** Company name (primary)
- **Profession:** Individual's title or primary specialty
- **Location:** Company city, country
- **Rating:** Overall rating with review count
- **Heart icon:** Save functionality (currently saves professional_id ❌)

**Link:**
```tsx
<Link href={`/professionals/${professional.slug}`}>
```
Currently links to professional ID ❌ Should link to company page

---

## Issues Identified

### 1. Reviews & Ratings ❌ CRITICAL

**Problem:**
- Card shows `rating` and `reviewCount` from `professional_ratings` table
- But reviews are left on company pages
- Mismatch between where review is displayed (company) and where it's stored (professional)

**Current:**
```sql
-- reviews table
professional_id UUID REFERENCES professionals(id)

-- professional_ratings table
professional_id UUID REFERENCES professionals(id)
```

**Should be:**
```sql
-- reviews table
company_id UUID REFERENCES companies(id)

-- company_ratings table  
company_id UUID REFERENCES companies(id)
```

### 2. Detail Page Links ❌ HIGH

**Problem:**
- Cards link to `/professionals/${professional.id}`
- Should link to `/companies/${company.slug}` or `/c/${company.slug}`
- Or keep URL but make page show company data

**Current:**
```typescript
slug: row.id  // professional.id
```

**Should be:**
```typescript
slug: company.slug || company.id  // company identifier
```

### 3. Saved Professionals ❌ MEDIUM

**Problem:**
- Save button saves to `saved_professionals` table with `professional_id`
- Should save to `saved_companies` table with `company_id`

**Current:**
```typescript
onSave={() => saveProfessional(professional)}
// Saves professional.id to saved_professionals table
```

**Should be:**
```typescript
onSave={() => saveCompany(professional.companyId)}
// Saves company.id to saved_companies table
```

### 4. Professional ID as Primary Key ⚠️ MINOR

**Problem:**
- Card uses `professional.id` as the primary identifier
- Makes sense only if we guarantee 1:1 professional:company relationship
- Future-proofing: If companies can have multiple professionals, this breaks

**Current:**
```typescript
id: row.id,              // professional.id
companyId: company.id,
```

**Consideration:**
- For now, keep `id` as professional.id for backwards compatibility
- But ensure all lookups and links use `companyId` where appropriate
- Future: Could switch to company.id as primary

---

## What's Already Correct ✅

1. **Display data prioritizes companies:**
   - Name from company.name
   - Location from company.city/country
   - Logo from company.logo_url
   - Filters by company plan tier and status

2. **Search filters company data:**
   - Location filters use company location
   - Plan-based filtering (Plus only)
   - Status filtering (listed only)

3. **Terminology is fine:**
   - "Professionals" page name is user-friendly ✅
   - "Browse Professionals" is what users expect ✅
   - Backend can be company-centric while UI uses "professional"

4. **Admin page is correct:**
   - Already shows companies table
   - Uses company-centric metrics
   - This should be the model for other areas

---

## Recommended Changes

### Phase 1: Fix Reviews System (Critical)
1. Add `company_id` to `reviews` table
2. Create `company_ratings` table (clone of professional_ratings)
3. Backfill existing reviews with company_id from professionals.company_id
4. Update review triggers to update company_ratings
5. Update `mv_professional_summary` to use company_ratings
6. Update all review display queries

### Phase 2: Fix Links & URLs (High Priority)
1. Update card link to use company identifier
2. Create company detail page or update professional detail page to be company-focused
3. Add redirects from old professional URLs

### Phase 3: Fix Saved Items (Medium Priority)
1. Create `saved_companies` table
2. Migrate data from saved_professionals
3. Update save/unsave actions and context

### Phase 4: Consider Slug Migration (Future)
1. Add `slug` field to companies table
2. Generate slugs from company names
3. Update ProfessionalCard type to use company.slug
4. Update all URLs to use company slugs

---

## Testing Checklist

- [ ] Search returns correct results for keywords
- [ ] Location filters work correctly (country/state/city)
- [ ] Service and category filters work correctly
- [ ] Pagination loads more results
- [ ] Card displays correct company data
- [ ] Clicking card navigates to correct page
- [ ] Save button works correctly
- [ ] Rating displays correct value
- [ ] Only Plus plan companies are shown
- [ ] Only listed companies are shown
- [ ] Verified badge displays correctly

---

## Related Files

**Pages:**
- `app/professionals/page.tsx` - Main discovery page
- `app/professionals/[slug]/page.tsx` - Detail page (needs company focus)

**Components:**
- `components/professional-card.tsx` - Card component
- `components/professionals-grid.tsx` - Grid with sorting
- `components/professionals-filter-bar.tsx` - Filter UI

**Queries:**
- `lib/professionals/queries.ts` - Data fetching logic
- `hooks/use-professionals-query.ts` - Client-side filtering

**Context:**
- `contexts/professional-filter-context.tsx` - Filter state management
- `contexts/saved-professionals-context.tsx` - Save functionality (needs update)

**Database:**
- `supabase/migrations/053_optimize_professional_search.sql` - View and RPC
- `supabase/migrations/003_create_companies_and_professionals.sql` - Tables

---

## Summary

The `/professionals` page is **mostly correct architecturally**:
- Data comes primarily from companies ✅
- Filters work on company data ✅
- Display prioritizes company information ✅
- Terminology ("professionals") is fine for UX ✅

**The main issues are:**
1. **Reviews are stored against professionals instead of companies** ❌
2. **Links point to professional pages instead of company pages** ❌
3. **Save functionality uses professional IDs instead of company IDs** ❌

These need to be fixed to fully align with the company-centric architecture.
