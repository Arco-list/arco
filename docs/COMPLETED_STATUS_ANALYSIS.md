# `completed` Status Deep Dive Analysis

**Date:** 2025-01-06
**Context:** Investigation into whether `completed` status has unique functionality

---

## TL;DR - Critical Findings

**YOU WERE RIGHT TO QUESTION THIS!** The `completed` status has **conflicting and confusing behavior**:

1. ✅ **Included in search/discovery** (via `mv_project_summary`)
2. ❌ **EXCLUDED from company portfolios** (filtered out at `lib/professionals/queries.ts:753`)
3. ⚠️ **Treated as "live"** in dashboard preview logic
4. 📊 **In materialized view** alongside `published`

**Conclusion:** The `completed` status appears to be **partially implemented or misconfigured**. It doesn't serve a clear, unique purpose.

---

## Detailed Analysis

### 1. Database Layer: Materialized View

**File:** `supabase/migrations/043_adjust_mv_project_summary_for_listed_projects.sql:66`

```sql
WHERE p.status IN ('published', 'completed')
  AND prof.is_active = TRUE;
```

**Effect:** Both `published` AND `completed` projects are included in:
- `mv_project_summary` - the optimized view for project listings
- `project_search_documents` - the full-text search index
- All search/discovery features

**Interpretation:** `completed` projects ARE discoverable by users.

---

### 2. Company Portfolio Display

**File:** `lib/professionals/queries.ts:668-753`

**Logic flow:**
```typescript
// Step 1: Get project IDs where company has listing status
const allowedStatuses = new Set(["live_on_page", "listed"])
const projectIds = projectProfessionals
  .filter(row => allowedStatuses.has(row.status))
  .map(row => row.project_id)

// Step 2: Fetch those projects from mv_project_summary
const projectSummaries = await supabase
  .from("mv_project_summary")  // Includes BOTH published AND completed
  .select("...")
  .in("id", projectIds)

// Step 3: FILTER OUT completed projects!
const filtered = projectSummaries
  .filter(row => row.status === "published")  // ❌ Excludes completed!
```

**Effect:** Even if a company sets `project_professionals.status = 'live_on_page'` to feature a project, if that project has `projects.status = 'completed'`, **it will NOT show** on their company page.

**Interpretation:** This seems like a **BUG** or incomplete feature. Why include `completed` in `mv_project_summary` but then filter it out from portfolios?

---

### 3. Dashboard Preview Logic

**File:** `app/dashboard/listings/page.tsx:658`

```typescript
const isLive = project.status === "published" || project.status === "completed"
```

**Effect:** Both statuses are considered "live" for preview purposes.

**Interpretation:** Dashboard treats them as equivalent.

---

### 4. Label Inconsistencies

| Location | `published` Label | `completed` Label |
|----------|-------------------|-------------------|
| Admin table | "Live" | "Listed" |
| Dashboard config | "Published" | "Featured" |
| Dashboard filter | "Live on page" | "Listed" |
| Migration 043 comment | N/A | "Listed projects for Plus companies" |

**Observation:** The labels suggest `completed` was intended for "showcased/featured/listed" projects, but the code doesn't implement this distinction.

---

## Hypothesis: What Was `completed` Supposed to Do?

Based on the migration comment and labels, it appears `completed` was intended to:

1. **Original Intent (speculation):**
   - `published` = Live on site, basic visibility
   - `completed` = Featured/listed/showcased (Plus tier feature?)

2. **What Actually Happens:**
   - Both are discoverable in search
   - Only `published` shows on company portfolios
   - No functional difference in visibility

3. **Why the Disconnect:**
   - Migration 043 added `completed` to `mv_project_summary` for "listed projects"
   - But company portfolio query (line 753) was never updated to include it
   - Or it was intentionally filtered out for unknown reasons

---

## Current Actual Behavior

### If project status = `published`:
- ✅ Appears in search/discovery (`mv_project_summary`)
- ✅ Can appear on company portfolio (if `project_professionals.status IN ('listed', 'live_on_page')`)
- ✅ Preview works in dashboard
- ✅ Public project page accessible

### If project status = `completed`:
- ✅ Appears in search/discovery (`mv_project_summary`)
- ❌ **CANNOT appear on company portfolio** (filtered out at line 753)
- ✅ Preview works in dashboard
- ✅ Public project page accessible (presumably)

**Key Difference:** `completed` projects are discoverable but HIDDEN from the companies that worked on them!

---

## Evidence This Is Problematic

1. **Migration Comment Contradiction:**
   - Migration 043 says: "Ensure project listings include completed (Listed) projects for Plus companies in Discover"
   - But "Listed" implies they should show on company pages
   - Yet the code explicitly filters them OUT of company pages

2. **No Obvious Use Case:**
   - Why would you want a project discoverable but NOT shown on the company's portfolio?
   - This creates a worse user experience for companies

3. **Label Confusion:**
   - If "Listed" means "showcased on company page", then the filter at line 753 contradicts this
   - If "Featured" is the intended meaning, then per-company `live_on_page` status already handles this

---

## Recommendation

### Option A: Fix the "Bug" (If `completed` was meant to showcase)

**Change:** Remove the filter at `lib/professionals/queries.ts:753`

```typescript
// OLD:
.filter((row) => row.status === "published")

// NEW:
.filter((row) => row.status === "published" || row.status === "completed")
```

**Effect:** `completed` projects now show on company portfolios (as the label "Listed" suggests)

**Problem:** Still doesn't clarify what makes `completed` different from `published`

### Option B: Remove `completed` Status (RECOMMENDED)

**Why this makes sense:**
1. No clear functional difference from `published`
2. Per-company `project_professionals.status` already handles portfolio featuring
3. Reduces complexity and confusion
4. Aligns with user feedback about confusing terminology

**What we'd lose:**
- Unclear - possibly nothing, or possibly a half-implemented feature

**Migration plan:**
```sql
UPDATE projects SET status = 'published' WHERE status = 'completed';
-- Then remove from enum
```

### Option C: Implement `completed` Properly (Complex, Not Recommended)

**Define clear semantics:**
- `published` = Standard visibility
- `completed` = Enhanced visibility (e.g., featured in hero sections, priority in search)

**Changes needed:**
- Remove filter at line 753
- Add special UI treatment for `completed` projects
- Document the distinction clearly
- Update all labels consistently

**Problem:** Overlap with existing `is_featured` boolean and `project_professionals.live_on_page` status

---

## Cross-Reference: Per-Company Status System

The platform ALREADY has a per-company featuring system:

| `project_professionals.status` | Effect |
|-------------------------------|--------|
| `listed` | Company shown on project page |
| `live_on_page` | Project featured in company portfolio |

This makes global `completed` status **redundant** for portfolio management.

---

## Final Verdict

**`completed` status is NOT functional as intended.**

It's in a broken state where:
- It's included in search (suggesting it should be visible)
- It's excluded from portfolios (suggesting it shouldn't be showcased)
- Labels say "Listed/Featured" (suggesting portfolio showcase)
- Code prevents portfolio showcase (contradicting labels)

**Recommendation:** **Remove `completed` status** as outlined in Option B of the PRD.

This eliminates:
- Confusing duplicate functionality
- Contradictory filtering logic
- Inconsistent labeling
- Developer confusion

The per-company `project_professionals.status` system provides all the granular control needed for portfolio management.

---

## Action Items

1. ✅ Confirm `completed` status should be removed
2. ⬜ Update PRD to reflect this analysis
3. ⬜ Create migration to convert `completed` → `published`
4. ⬜ Remove `completed` from all code references
5. ⬜ Remove `completed` from TypeScript enum
6. ⬜ Verify no business logic depends on `completed` being distinct

---

## Appendix: Code References

**Materialized View:**
- `supabase/migrations/043_adjust_mv_project_summary_for_listed_projects.sql:66`

**Company Portfolio Filter:**
- `lib/professionals/queries.ts:753`

**Dashboard Preview:**
- `app/dashboard/listings/page.tsx:658`

**Admin Labels:**
- `components/admin-projects-table.tsx:67-74`

**Dashboard Labels:**
- `lib/project-status-config.ts:15-32`
- `components/dashboard-listings-filter.tsx:25-31`
