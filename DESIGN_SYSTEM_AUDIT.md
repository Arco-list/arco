# Design System Button Audit & Migration Guide

**Created**: 2025-11-05
**Status**: In Progress
**Priority**: HIGH

## Overview

This document tracks the migration of all Button components to use the official Arco Design System specifications defined in `app/globals.css`.

## Design System Button Specifications

| Variant | Component Usage | Font Size | Padding | Use Case |
|---------|----------------|-----------|---------|----------|
| **Primary** | `<Button variant="primary">` or `<Button>` | 16px | 12px/24px | Main CTAs, hero actions |
| **Secondary** | `<Button variant="secondary" size="sm">` | 14px | 12px/16px | Important actions, form submits |
| **Tertiary** | `<Button variant="tertiary" size="tertiary">` | 14px | 12px/16px | Subtle actions, Share/Save buttons |
| **Quaternary** | `<Button variant="quaternary" size="quaternary">` | 14px | 6px/12px | Tags, filters, chips |
| **Text (Ghost)** | `<Button variant="ghost" size="xs">` | 14px | 6px/12px | Navigation, minimal actions |
| **Text Listed (Link)** | `<Button variant="link" size="xs">` | 14px | 6px/12px | Footer/menu links |

## Common Issues Found

### ❌ Issue #1: Secondary buttons missing size prop
**Problem**: `<Button variant="secondary">` uses default size (12px/24px) instead of design system size (12px/16px)
**Fix**: Always use `<Button variant="secondary" size="sm">`

**Files affected**:
- `components/auth/login-form.tsx:122` - Sign in button
- `components/auth/signup-form.tsx` - Likely affected
- `components/auth/otp-form.tsx` - Likely affected
- Other form components

### ⚠️ Issue #2: Ghost variant used without proper sizing
**Problem**: `variant="ghost"` without `size="xs"` doesn't match text button specs
**Fix**: Use `<Button variant="ghost" size="xs">` for text buttons

**Files affected**:
- `components/hero-section.tsx:86-103` - Navigation arrows (uses custom className override, acceptable)

### ✅ Good Examples
- `components/professional-action-buttons.tsx:33` - Correctly uses `variant="tertiary" size="tertiary"`
- `app/styles/page.tsx` - All button examples now use correct variant+size combinations

## Migration Checklist

### Phase 1: Critical UI Components (Forms & Auth)
- [ ] `components/auth/login-form.tsx` - Add `size="sm"` to secondary button
- [ ] `components/auth/signup-form.tsx` - Audit all buttons
- [ ] `components/auth/otp-form.tsx` - Audit all buttons
- [ ] `components/auth/auth-dialog.tsx` - Audit all buttons
- [ ] `app/create-company/page.tsx` - Audit form buttons

### Phase 2: Action Buttons & CTAs
- [ ] `components/project-action-buttons.tsx` - Verify tertiary button usage
- [ ] `components/professional-action-buttons.tsx` - ✅ Already correct
- [ ] `components/professional-contact-sidebar.tsx` - Audit CTA buttons
- [ ] `components/hero-section.tsx` - ✅ Custom styling acceptable for carousel

### Phase 3: Dashboard & Admin
- [ ] `app/dashboard/**/*.tsx` - Audit all dashboard buttons (6 files)
- [ ] `app/admin/**/*.tsx` - Audit all admin buttons (3 files)
- [ ] `components/admin-*.tsx` - Audit admin table actions (5 files)
- [ ] `components/dashboard-*.tsx` - Audit dashboard components

### Phase 4: Modals & Dialogs
- [ ] `components/filters-modal.tsx` - Audit filter buttons
- [ ] `components/professionals-filters-modal.tsx` - Audit filter buttons
- [ ] `components/share-modal.tsx` - Audit action buttons
- [ ] `components/report-modal.tsx` - Audit action buttons
- [ ] `components/listing-status-modal.tsx` - Audit status buttons
- [ ] `components/grouped-pictures-modal.tsx` - Audit navigation
- [ ] `components/feature-photo-selector-modal.tsx` - Audit selection buttons

### Phase 5: Grids & Listings
- [ ] `components/projects-grid.tsx` - Verify card buttons
- [ ] `components/professionals-grid.tsx` - Verify card buttons
- [ ] `components/featured-companies.tsx` - Verify CTA buttons
- [ ] `components/featured-professionals.tsx` - Verify CTA buttons
- [ ] `components/popular-projects.tsx` - Verify navigation
- [ ] `components/gallery-grid.tsx` - Verify interactions

### Phase 6: Filters & Sidebars
- [ ] `components/filter-bar.tsx` - Audit quaternary button usage
- [ ] `components/professionals-filter-bar.tsx` - Audit filter chips
- [ ] `components/professionals-sidebar.tsx` - Audit sidebar actions
- [ ] `components/mobile-professionals-button.tsx` - Audit mobile button

### Phase 7: Miscellaneous
- [ ] `components/pricing-section.tsx` - Audit pricing CTAs
- [ ] `components/faq12.tsx` - Audit any interactive elements
- [ ] `components/about3.tsx` - Audit CTAs
- [ ] `app/list-with-us/page.tsx` - Audit landing page CTAs

## Testing Checklist

After migration, test these scenarios:

### Visual Regression
- [ ] All button sizes match design system specs
- [ ] Hover states work correctly
- [ ] Disabled states appear correctly
- [ ] Focus rings appear on keyboard navigation

### Functional Testing
- [ ] Forms submit correctly
- [ ] Modal actions work (Save/Cancel)
- [ ] Filter chips toggle correctly
- [ ] Navigation buttons work
- [ ] CTA buttons navigate correctly

### Responsive Testing
- [ ] Buttons render correctly on mobile
- [ ] Text wrapping behaves properly
- [ ] Touch targets are adequate (min 44px)

## Notes

- **Custom className overrides**: Some components (like hero carousel) use custom styling with `className` prop. This is acceptable when design system variants don't fit the use case.
- **Legacy variants**: `destructive` and `outline` variants are kept for backward compatibility but should be migrated to design system variants when possible.
- **Default variant**: `<Button>` without props uses `variant="default"` which maps to Primary button specs.

## References

- Design System Specs: `app/globals.css` lines 318-437
- Button Component: `components/ui/button.tsx`
- Style Guide: `app/styles/page.tsx` (dev only - http://localhost:3000/styles)
- Button README: `app/styles/README.md`
