# Outline Variant Migration Plan

**Created**: 2025-11-05
**Status**: Analysis Complete - Awaiting Decision
**Priority**: MEDIUM

## Overview

The `variant="outline"` is a legacy shadcn/ui variant that is **NOT part of the Arco Design System**. It's currently used **100 times across 37 files**.

## Current Outline Button Styling

From `components/ui/button.tsx`:
```tsx
outline: "border border-border bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
```

This creates a bordered button with background on hover - similar to our Quaternary button but using different tokens.

## Usage Analysis

### Use Case Categories

| Use Case | Count (approx) | Examples | Design System Mapping |
|----------|---------------|----------|---------------------|
| **Carousel Navigation** | ~20 | professional-categories, project-categories, popular-projects | `variant="ghost"` with custom className OR keep outline |
| **Admin Actions** | ~30 | Filter buttons, Export buttons, Refresh buttons | `variant="quaternary" size="quaternary"` |
| **Error Page Actions** | ~10 | "Go back", "Go home" buttons | `variant="tertiary" size="tertiary"` |
| **Modal Cancel Buttons** | ~10 | professional-reviews, report-modal | `variant="tertiary" size="tertiary"` |
| **Data Table Actions** | ~20 | Edit, Delete, View actions | `variant="quaternary" size="quaternary"` |
| **Miscellaneous** | ~10 | Various secondary actions | Case-by-case assessment |

## Recommended Migration Strategy

### Option 1: Map to Existing Design System Variants ⭐ **RECOMMENDED**

**Pros:**
- ✅ Enforces design system consistency
- ✅ Reduces variant complexity
- ✅ Makes button usage more semantic

**Cons:**
- ⚠️ Requires careful visual review of each component
- ⚠️ May need some custom className overrides

**Mapping Guide:**

| Current Usage | Migrate To | Reason |
|--------------|-----------|--------|
| Filter/Export buttons | `variant="quaternary" size="quaternary"` | Matches outline style, small padding |
| Modal Cancel buttons | `variant="tertiary" size="tertiary"` | Standard cancel action |
| Navigation arrows | Keep `variant="outline"` temporarily | Custom styling needed |
| Error page CTAs | `variant="tertiary" size="tertiary"` | Secondary actions |
| Table row actions | `variant="quaternary" size="quaternary"` | Small, minimal buttons |

### Option 2: Keep Outline as Legacy/Utility Variant

**Pros:**
- ✅ No breaking changes
- ✅ Faster implementation
- ✅ Backwards compatible

**Cons:**
- ❌ Design system not fully enforced
- ❌ Developers may default to outline instead of design system variants
- ❌ Inconsistent button usage

**Implementation:**
- Document outline as "legacy compatibility variant"
- Discourage use in new components
- Gradually migrate over time

### Option 3: Create New Design System Variant

**Pros:**
- ✅ Acknowledges real use case
- ✅ Provides semantic meaning

**Cons:**
- ❌ Goes against established design system
- ❌ Adds complexity
- ❌ Should only be done if designer approves

**Question for Design Team:**
Is there a missing button variant in the design system that outline is fulfilling?

## Migration Phases

### Phase 1: Low-Risk Quick Wins (Immediate)
- [ ] Modal cancel buttons → `variant="tertiary" size="tertiary"`
- [ ] Error page buttons → `variant="tertiary" size="tertiary"`
- [ ] Table filter buttons → `variant="quaternary" size="quaternary"`

**Files**: ~20 files, ~40 changes

### Phase 2: Admin/Dashboard (Week 1)
- [ ] Admin table actions → `variant="quaternary" size="quaternary"`
- [ ] Dashboard filters → `variant="quaternary" size="quaternary"`
- [ ] Export/action buttons → `variant="quaternary" size="quaternary"`

**Files**: ~10 files, ~30 changes

### Phase 3: Navigation & Carousels (Week 2)
- [ ] Assess if navigation arrows should use tertiary or custom styling
- [ ] Create reusable carousel button component if needed
- [ ] Migrate all carousel usage

**Files**: ~7 files, ~20 changes

### Phase 4: Remaining (Week 3)
- [ ] Miscellaneous outline usage
- [ ] Case-by-case assessment
- [ ] Final cleanup

**Files**: ~10 files, ~10 changes

## Testing Checklist

After each migration phase:

- [ ] Visual regression test - buttons look correct
- [ ] Hover states work properly
- [ ] Disabled states appear correctly
- [ ] Focus rings visible on keyboard navigation
- [ ] Responsive behavior intact
- [ ] No layout shifts

## Decision Required

**Question for Product/Design:**

Should we:
1. **Migrate all outline usage to design system variants** (Quaternary/Tertiary)
2. **Keep outline as documented legacy variant**
3. **Add a new design system variant** to cover outline use cases

**Recommendation**: Option 1 - Migrate to design system variants

This ensures:
- ✅ Design system integrity
- ✅ Consistent button semantics
- ✅ Easier onboarding for new developers
- ✅ Clear design system documentation

## Immediate Actions (Already Completed ✅)

1. ✅ Fixed all secondary buttons to use `size="sm"`
2. ✅ Fixed all tertiary buttons to use `size="tertiary"`
3. ✅ Updated Button component to match design system specs
4. ✅ Updated /styles page to show correct usage
5. ✅ Created comprehensive audit documentation

## Next Steps

1. **Get stakeholder decision** on migration approach
2. **Create sample migration** for one component as proof of concept
3. **Visual review** with design team
4. **Proceed with phased migration** if approved

## Files Affected (37 total)

```
/app/admin/projects/page.tsx
/app/admin/settings/page.tsx
/app/create-company/page.tsx
/app/dashboard/listings/page.tsx
/app/dashboard/pricing/page.tsx
/components/about3.tsx
/components/admin-professional-invites-table.tsx
/components/admin-professionals-companies-table.tsx
/components/admin-projects-table.tsx
/components/admin-reviews-table.tsx
/components/company-settings/company-settings-shell.tsx
/components/dashboard-listings-filter.tsx
/components/editable-seo-cell.tsx
/components/error-boundary.tsx
/components/errors/forbidden-error.tsx
/components/errors/general-error.tsx
/components/errors/not-found-error.tsx
/components/errors/service-unavailable-error.tsx
/components/errors/unauthorized-error.tsx
/components/featured-companies.tsx
/components/featured-professionals.tsx
/components/filter-bar.tsx
/components/filters-modal.tsx
/components/popular-projects.tsx
/components/popular-services.tsx
/components/professional-categories.tsx
/components/professional-projects.tsx
/components/professional-reviews.tsx
/components/professionals-filters-modal.tsx
/components/professionals-grid.tsx
/components/project-categories.tsx
/components/project-features.tsx
/components/project-types.tsx
/components/projects-data-table.tsx
/components/report-modal.tsx
/components/share-modal.tsx
/components/users-data-table.tsx
```

---

**For Discussion**: Should we proceed with Option 1 (full migration) or Option 2 (document as legacy)?
