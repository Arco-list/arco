# Professional to Company Migration - Complete Plan

**Date:** October 24, 2025  
**Status:** Planning Phase - Awaiting Approval

---

## Overview

This document outlines the complete migration plan to ensure all professional-related features use **company.id** as the primary identifier instead of **professional.id**, while keeping the user-facing "professional" terminology.

**Key Principle:** "Professional" is fine for UI/UX, but data should be company-centric.

---

## All Places Where Professionals Are Displayed

### 1. `/professionals` Discovery Page ✅ Mostly Correct

**Files:**
- `app/professionals/page.tsx`
- `components/professionals-grid.tsx`
- `components/professional-card.tsx`
- `lib/professionals/queries.ts`

**Current State:**
- Already displays company data (name, logo, location) ✅
- Uses `professional.id` as card ID and slug ❌
- Links to `/professionals/${professional.id}` ❌

**Changes Needed:**
- Change `id` and `slug` to `company.id`
- Keep `professionalId` field for backward compatibility
- Update card links to use company.id

---

### 2. Landing Page - Featured Professionals Section

**Files:**
- `app/page.tsx` (lines 103-106)
- `components/featured-professionals.tsx`

**Current State:**
```typescript
// Queries mv_professional_summary
.select("id, first_name, last_name, title, primary_specialty, company_name, 
         company_city, user_location, display_rating, total_reviews, avatar_url")
.eq("is_featured", true)
```

**Type Definition:**
```typescript
export type FeaturedProfessional = {
  id: string              // Currently professional.id
  name: string            // Shows company_name or person name
  title: string           // Individual's title
  location: string        
  rating: number
  reviews: number
  image: string | null
  href: string           // Links to /professionals/${id}
}
```

**Issues:**
- Uses `professional.id` as identifier ❌
- Links to `/professionals/${professional.id}` ❌
- Section title: "Featured professionals" ✅ (terminology is fine)

**Changes Needed:**
- Update query to include `company_id`, `company_logo`
- Change `id` to company.id
- Change `href` to `/professionals/${company.id}`
- Prioritize company_logo over avatar_url for image

---

### 3. Project Detail Page - Professionals Section

**Files:**
- `app/projects/[slug]/page.tsx`
- `components/professionals-section.tsx`
- `components/professionals-sidebar.tsx` (if exists)

**Current State in professionals-section.tsx:**
```typescript
// Line 77: Links to professional detail page
onClick={() => professional.professionalId && 
  window.open(`/professionals/${professional.professionalId}`, '_blank')}
```

**Data Structure:**
```typescript
{
  id: string
  companyName: string
  companyLogo: string | null
  serviceCategory: string
  professionalId: string | null
}
```

**Issues:**
- Links using `professionalId` ❌
- Should link using company ID

**Changes Needed:**
- Add `companyId` to the data structure
- Update link to use `/professionals/${companyId}`
- Ensure query fetches company_id from project_professionals table

---

### 4. Professional Detail Page

**Files:**
- `app/professionals/[slug]/page.tsx`
- `app/professionals/[slug]/actions.ts`
- `lib/professionals/queries.ts` (fetchProfessionalDetail, fetchProfessionalMetadata)

**Current State:**
```typescript
// Fetches by professional.id
export async function generateMetadata({ params }: { params: { slug: string } })
const professional = await fetchProfessionalDetail(params.slug)
```

**Issues:**
- Expects `slug` to be professional.id ❌
- Should expect company.id instead
- Currently fetches professional data first, then joins to company

**Changes Needed:**
- Update to accept company.id as slug
- Query companies table first, join to professionals
- Display company as primary entity
- Show professional info as secondary (owner/team member)
- Add redirect for old professional.id URLs → company.id URLs

**Query Changes:**
```typescript
// OLD: Start from professionals table
supabase.from("professionals").select("*, company:companies(*)").eq("id", slug)

// NEW: Start from companies table  
supabase.from("companies").select("*, professionals(*)").eq("id", slug)
```

---

### 5. Saved Professionals System

**Files:**
- `contexts/saved-professionals-context.tsx`
- Database: `saved_professionals` table

**Current State:**
```typescript
type SavedProfessionalEntry = {
  professionalId: string;    // Saved to saved_professionals.professional_id
  companyId: string | null;
  savedAt: string | null;
  card: ProfessionalCard;
};
```

**Database Table:**
```sql
CREATE TABLE saved_professionals (
  user_id UUID REFERENCES profiles(id),
  professional_id UUID REFERENCES professionals(id),
  notes TEXT,
  created_at TIMESTAMPTZ
);
```

**Issues:**
- Saves to `professional_id` column ❌
- Should save to company_id in saved_companies table

**Changes Needed:**
1. Create new table `saved_companies`
2. Migrate existing data
3. Update context to use saved_companies
4. Update save/remove functions
5. Keep using `savedProfessionalIds` naming in context (user-facing term is fine)

**New Table:**
```sql
CREATE TABLE saved_companies (
  user_id UUID REFERENCES profiles(id),
  company_id UUID REFERENCES companies(id),
  notes TEXT,
  created_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, company_id)
);
```

---

### 6. Admin Professionals Page ✅ Already Correct

**Files:**
- `app/admin/professionals/page.tsx`
- `components/admin-professionals-companies-table.tsx`

**Current State:**
- Already shows companies table ✅
- Uses company-centric metrics ✅
- This is the model other pages should follow ✅

**No changes needed** - already correct!

---

## Database Changes Required

### 1. Reviews System (CRITICAL - Separate from this migration)

**Not part of this migration** but critical issue:
- Reviews currently link to `professionals.id`
- Should link to `companies.id`
- Requires separate migration plan

### 2. Saved Companies Table

```sql
-- Create new table
CREATE TABLE public.saved_companies (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, company_id),
  CONSTRAINT saved_companies_notes_length CHECK (notes IS NULL OR length(notes) <= 500)
);

-- Create indexes
CREATE INDEX idx_saved_companies_user_id ON public.saved_companies(user_id);
CREATE INDEX idx_saved_companies_created_at ON public.saved_companies(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.saved_companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY saved_companies_user_select ON public.saved_companies
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY saved_companies_user_insert ON public.saved_companies
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_companies_user_delete ON public.saved_companies
  FOR DELETE USING (user_id = auth.uid());

-- Migrate existing data
INSERT INTO public.saved_companies (user_id, company_id, notes, created_at)
SELECT 
  sp.user_id,
  p.company_id,
  sp.notes,
  sp.created_at
FROM public.saved_professionals sp
JOIN public.professionals p ON p.id = sp.professional_id
WHERE p.company_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.saved_companies IS 'Companies saved by users for later reference';
```

### 3. Project Professionals Table ✅ Already Has company_id

Good news - the table already has both fields:
```sql
professional_id UUID REFERENCES professionals(id)
company_id UUID REFERENCES companies(id)
```

No database changes needed, just ensure queries populate company_id.

---

## Code Changes Summary

### Phase 1: Update Type Definitions

**File:** `lib/professionals/types.ts`

```typescript
export type ProfessionalCard = {
  id: string              // Change to company.id
  slug: string            // Change to company.id
  companyId: string       // Same as id (for clarity)
  professionalId: string  // Add for backward compatibility
  name: string
  profession: string
  location: string
  rating: number
  reviewCount: number
  image: string
  specialties: string[]
  isVerified: boolean
  domain?: string | null
}
```

### Phase 2: Update Query Functions

**File:** `lib/professionals/queries.ts`

Update these mapping functions:
- `toProfessionalCard()` - line 250-315
- `mapRpcRowToProfessionalCard()` - line 355-394

```typescript
// Change from:
return {
  id: row.id,              // professional.id
  slug: row.id,
  companyId: row.company_id,
  ...
}

// Change to:
return {
  id: row.company_id,      // company.id
  slug: row.company_id,
  companyId: row.company_id,
  professionalId: row.id,  // Keep for backward compat
  ...
}
```

### Phase 3: Update Client-Side Query Hook

**File:** `hooks/use-professionals-query.ts`

Update `mapRowToCard()` function (line 58-92) same as above.

### Phase 4: Update Landing Page Featured Professionals

**File:** `app/page.tsx`

Update query to include company fields:
```typescript
supabase
  .from("mv_professional_summary")
  .select(`
    id, 
    company_id,
    company_name,
    company_logo,
    first_name, 
    last_name, 
    title, 
    primary_specialty, 
    company_city, 
    user_location, 
    display_rating, 
    total_reviews, 
    avatar_url
  `)
  .eq("is_featured", true)
  .limit(6)
```

Update mapping logic:
```typescript
const featuredProfessionals: FeaturedProfessional[] = featuredProfessionalsRaw.map((row) => ({
  id: row.company_id,      // Use company.id
  name: row.company_name || [row.first_name, row.last_name].filter(Boolean).join(" "),
  title: row.title || row.primary_specialty || "",
  location: row.company_city || row.user_location || "",
  rating: row.display_rating || 0,
  reviews: row.total_reviews || 0,
  image: row.company_logo || row.avatar_url,
  href: `/professionals/${row.company_id}`,  // Use company.id in URL
}))
```

### Phase 5: Update Professionals Section (Project Pages)

**File:** `components/professionals-section.tsx`

Update link (line 77):
```typescript
// Change from:
onClick={() => professional.professionalId && 
  window.open(`/professionals/${professional.professionalId}`, '_blank')}

// Change to:
onClick={() => professional.companyId && 
  window.open(`/professionals/${professional.companyId}`, '_blank')}
```

Ensure data structure includes companyId from project_professionals table.

### Phase 6: Update Professional Detail Page

**File:** `app/professionals/[slug]/page.tsx`

Major refactor needed:
1. Accept company.id as slug parameter
2. Fetch company first, join to professionals
3. Display company as primary entity
4. Show professional data as secondary

**File:** `lib/professionals/queries.ts`

Update these functions:
- `fetchProfessionalMetadata()` - Accept company.id
- `fetchProfessionalDetail()` - Fetch from companies table first

### Phase 7: Update Saved Professionals Context

**File:** `contexts/saved-professionals-context.tsx`

1. Update to use `saved_companies` table
2. Keep "savedProfessionals" naming (user-facing)
3. Update save/remove functions to use company_id
4. Update query to fetch from saved_companies

```typescript
// Change SQL query from:
SELECT * FROM saved_professionals 
JOIN professionals ON ...

// To:
SELECT * FROM saved_companies
JOIN companies ON companies.id = saved_companies.company_id
JOIN professionals ON professionals.company_id = companies.id
```

### Phase 8: Add Redirects

**File:** `app/professionals/[slug]/page.tsx`

Add logic to detect old professional.id URLs and redirect:

```typescript
export default async function ProfessionalDetailPage({ params }: PageProps) {
  const { slug } = params
  
  // Try to find company by ID
  const company = await fetchCompanyById(slug)
  
  if (!company) {
    // Check if slug is an old professional.id
    const professional = await fetchProfessionalById(slug)
    if (professional?.company_id) {
      redirect(`/professionals/${professional.company_id}`)
    }
    notFound()
  }
  
  // Continue with company data...
}
```

---

## Testing Checklist

### Discovery Page (`/professionals`)
- [ ] Cards display correct company data
- [ ] Card IDs are company.id
- [ ] Links go to `/professionals/${company.id}`
- [ ] Save button saves company.id to saved_companies
- [ ] Filters work correctly
- [ ] Search returns correct results
- [ ] Pagination works

### Landing Page
- [ ] Featured professionals section displays companies
- [ ] Cards link to `/professionals/${company.id}`
- [ ] Images show company logos
- [ ] Names show company names

### Professional Detail Page
- [ ] Accepts company.id as slug
- [ ] Displays company as primary entity
- [ ] Shows company info (name, logo, description, location)
- [ ] Shows professional info as secondary (owner/team)
- [ ] Reviews are displayed (when fixed separately)
- [ ] Gallery shows company photos
- [ ] Projects show company's work
- [ ] Contact info is company contact info

### Project Detail Page
- [ ] Professionals section shows companies
- [ ] Links go to `/professionals/${company.id}`
- [ ] Company logos displayed
- [ ] Company names displayed

### Saved Functionality
- [ ] Save button saves to saved_companies table
- [ ] Saved companies appear in saved list
- [ ] Remove button removes from saved_companies
- [ ] Company IDs are used throughout

### Redirects
- [ ] Old `/professionals/${professional.id}` URLs redirect to company pages
- [ ] Redirect preserves query parameters if any
- [ ] 404 for invalid IDs

---

## Migration Order

1. **Database Migration**
   - Create `saved_companies` table
   - Migrate data from saved_professionals
   - Deploy migration

2. **Type & Query Updates** (can be done in one PR)
   - Update ProfessionalCard type
   - Update all mapping functions in queries.ts
   - Update use-professionals-query.ts hook

3. **Landing Page Updates**
   - Update featured professionals query and mapping

4. **Project Page Updates**
   - Update professionals section links

5. **Detail Page Refactor**
   - Refactor to fetch companies first
   - Add redirect logic
   - Update display to be company-centric

6. **Saved Context Update**
   - Update to use saved_companies table
   - Update all save/remove functions

7. **Testing**
   - Test all flows
   - Test redirects
   - Test save functionality

---

## Backward Compatibility Considerations

### Keep Professional ID Available
Always include `professionalId` in the card type for:
- Debugging and logging
- Analytics tracking
- Future features that may need professional-level data

### URL Structure
- New URLs: `/professionals/${company.id}`
- Old URLs: Redirect from `/professionals/${professional.id}` → `/professionals/${company.id}`
- Keep URL path as `/professionals` (user-friendly)

### Database
- Don't delete `saved_professionals` table immediately
- Keep both tables for a grace period
- Can deprecate saved_professionals after confirming migration success

---

## Risks & Mitigation

### Risk 1: Breaking Existing Saved Professionals
**Mitigation:**
- Migrate all data before updating code
- Keep both tables active during transition
- Add monitoring to track both tables

### Risk 2: SEO Impact from URL Changes
**Mitigation:**
- Implement 301 redirects from old URLs
- Submit sitemap update with new URLs
- Keep redirects permanently (don't remove)

### Risk 3: Professional.id Referenced in Other Places
**Mitigation:**
- Search codebase for all professional.id references
- Review analytics/tracking code
- Check any external integrations

### Risk 4: Users Have Bookmarked Old URLs
**Mitigation:**
- Redirects handle this ✅
- Keep redirects permanently

---

## Open Questions

1. **Should we add a `slug` field to companies table?**
   - Currently using company.id in URLs
   - Slugs would be more SEO-friendly
   - Example: `/professionals/acme-architects` vs `/professionals/uuid`
   - Recommendation: Add in future iteration, not required for this migration

2. **What about professionals without companies?**
   - Current: All 13 professionals have companies ✅
   - Future: Enforce company_id as NOT NULL?
   - Recommendation: Keep optional for now, filter out null companies in queries

3. **Should we rename saved_professionals_context to saved_companies_context?**
   - Pro: More accurate
   - Con: User-facing "saved professionals" makes sense
   - Recommendation: Keep context name, change table/queries

4. **Timeline for reviews system fix?**
   - Separate from this migration
   - Should be next priority
   - Recommendation: Document as Phase 2

---

## Success Criteria

- [ ] All professional cards use company.id as primary identifier
- [ ] All links point to company.id URLs
- [ ] Old professional.id URLs redirect correctly
- [ ] Saved functionality uses saved_companies table
- [ ] All tests pass
- [ ] No broken links
- [ ] SEO maintained via redirects
- [ ] User experience unchanged or improved
- [ ] Company data is primary throughout app

---

## Files to Modify

### TypeScript/React Files
- `lib/professionals/types.ts`
- `lib/professionals/queries.ts`
- `hooks/use-professionals-query.ts`
- `app/page.tsx` (landing)
- `app/professionals/[slug]/page.tsx`
- `components/featured-professionals.tsx`
- `components/professionals-section.tsx`
- `contexts/saved-professionals-context.tsx`

### Database
- New migration: `XXX_create_saved_companies_table.sql`

### Total Files: ~8 files + 1 migration

---

## Estimated Effort

- Database migration: 1 hour
- Code changes: 4-6 hours
- Testing: 2-3 hours
- **Total: 7-10 hours**

---

## Next Steps

1. **Review this plan** - Get approval on approach
2. **Create migration** - Start with database changes
3. **Update types & queries** - Core data layer
4. **Update components** - UI layer
5. **Test thoroughly** - All flows
6. **Deploy** - With monitoring
7. **Document** - Update any relevant docs

---

## Related Issues

- **Reviews System Fix** - Separate migration needed
- **Company Slugs** - Future enhancement
- **Multiple Professionals per Company** - Future feature
