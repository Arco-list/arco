# Typography Update Checklist
## Complete File-by-File Migration Tracker

**Total Files**: 174
**Completed**: 132/174 (75.9%)
**Status**: In Progress
**Last Updated**: 2025-12-04

---

## Phase 1: Styles Documentation (1 file) ✅ COMPLETE

- [x] `app/styles/page.tsx` - Add utility classes to typography examples

---

## Phase 2: High-Priority Pages (6 files) ✅ COMPLETE

### Landing & Core Pages
- [x] `app/page.tsx` - **CRITICAL** Landing page (highest traffic) ✅ Component composition only
- [x] `app/professionals/page.tsx` - Company listings page ✅ Component composition only
- [x] `app/professionals/[slug]/page.tsx` - Company detail page ✅ Component composition only
- [x] `app/projects/page.tsx` - Projects gallery page ✅ Component composition only
- [x] `app/projects/[slug]/page.tsx` - Project detail page ✅ Fixed PreviewBanner
- [x] `app/about/page.tsx` - About page ✅ Component composition only

---

## Phase 3: Authentication Pages (8 files) ✅ COMPLETE

- [x] `app/login/page.tsx` - Login page ✅ Component composition only
- [x] `app/signup/page.tsx` - Signup page ✅ Component composition only
- [x] `app/signup/confirm/page.tsx` - Email confirmation page ✅ COMPLETE
- [x] `app/reset-password/page.tsx` - Reset password page ✅ Component composition (uses reset-password1.tsx)
- [x] `app/update-password/page.tsx` - Update password page ✅ Component composition (uses update-password.tsx)
- [x] `app/auth/confirmed/page.tsx` - Auth confirmed page ✅ COMPLETE
- [x] `app/auth/admin-onboarding/page.tsx` - Admin onboarding page ✅ Component composition (uses admin-onboarding-form.tsx)
- [x] `app/create-company/page.tsx` - Create company page ✅ COMPLETE

---

## Phase 4: Dashboard Pages (6 files) ✅ COMPLETE

- [x] `app/dashboard/page.tsx` - Main dashboard page ✅ Redirect logic only, no typography
- [x] `app/dashboard/company/page.tsx` - Company dashboard page ✅ Component composition only
- [x] `app/dashboard/listings/page.tsx` - Listings dashboard page ✅ COMPLETE
- [x] `app/dashboard/settings/page.tsx` - Settings page ✅ COMPLETE
- [x] `app/dashboard/pricing/page.tsx` - Pricing dashboard page ✅ COMPLETE
- [x] `app/dashboard/edit/[id]/page.tsx` - Edit project page ✅ COMPLETE

---

## Phase 5: New Project Flow (5 files) ✅ COMPLETE

- [x] `app/new-project/page.tsx` - New project landing ✅ Redirect only, no typography
- [x] `app/new-project/get-started/page.tsx` - New project get started ✅ COMPLETE
- [x] `app/new-project/details/page.tsx` - New project details ✅ COMPLETE
- [x] `app/new-project/photos/page.tsx` - New project photos ✅ COMPLETE
- [x] `app/new-project/professionals/page.tsx` - New project professionals ✅ COMPLETE

---

## Phase 6: Admin Pages (6 files) ✅ COMPLETE

- [x] `app/admin/page.tsx` - Admin dashboard ✅ Redirect only
- [x] `app/admin/professionals/page.tsx` - Admin professionals page ✅ Component composition only
- [x] `app/admin/projects/page.tsx` - Admin projects page ✅ Component composition only
- [x] `app/admin/users/page.tsx` - Admin users page ✅ Component composition only
- [x] `app/admin/reviews/page.tsx` - Admin reviews page ✅ COMPLETE
- [x] `app/admin/settings/page.tsx` - Admin settings page ✅ Uses Card components, no direct typography

---

## Phase 7: Other Pages (7 files) ✅ COMPLETE

- [x] `app/pricing/page.tsx` - Pricing page ✅ Component composition only
- [x] `app/privacy/page.tsx` - Privacy page ✅ COMPLETE
- [x] `app/terms/page.tsx` - Terms page ✅ COMPLETE
- [x] `app/help-center/page.tsx` - Help center page ✅ Component composition only
- [x] `app/homeowner/page.tsx` - Homeowner page ✅ COMPLETE
- [x] `app/list-with-us/page.tsx` - List with us page ✅ COMPLETE
- [x] `app/not-found.tsx` - Not found page ✅ Component composition only

---

## Phase 8: Error Pages (6 files) ✅ COMPLETE

- [x] `app/(errors)/401/page.tsx` - 401 error page ✅ Component composition only
- [x] `app/(errors)/403/page.tsx` - 403 error page ✅ Component composition only
- [x] `app/(errors)/404/page.tsx` - 404 error page ✅ Component composition only
- [x] `app/(errors)/503/page.tsx` - 503 error page ✅ Component composition only
- [x] `app/(errors)/error/page.tsx` - General error page ✅ Component composition only
- [x] `app/global-error.tsx` - Global error handler ✅ Component composition only

---

## Phase 9: Layouts (3 files) ✅ COMPLETE

- [x] `app/layout.tsx` - Root layout ✅ Structural only
- [x] `app/admin/layout.tsx` - Admin layout ✅ Structural only
- [x] `app/(errors)/layout.tsx` - Errors layout ✅ Structural only

---

## Phase 10: Core Components - Landing Page (9 files) ✅ COMPLETE

- [x] `components/header.tsx` - Header component ✅ COMPLETE
- [x] `components/footer.tsx` - Footer component ✅ COMPLETE
- [x] `components/hero-section.tsx` - Hero section ✅ COMPLETE
- [x] `components/project-categories.tsx` - Project categories section ✅ COMPLETE
- [x] `components/popular-projects.tsx` - Popular projects component ✅ COMPLETE
- [x] `components/features-section.tsx` - Features section ✅ COMPLETE
- [x] `components/professional-categories.tsx` - Professional categories section ✅ COMPLETE
- [x] `components/featured-companies.tsx` - Featured companies section ✅ COMPLETE
- [x] `components/project-types.tsx` - Project types section ✅ COMPLETE

---

## Phase 11: Featured Components (2 files) ✅ COMPLETE

- [x] `components/featured-professionals.tsx` - Featured professionals ✅ COMPLETE
- [x] `components/featured-companies.tsx` - Featured companies ✅ Already updated

---

## Phase 12: Card Components (2 files) ✅ COMPLETE

- [x] `components/professional-card.tsx` - Professional card ✅ COMPLETE
- [x] `components/project-card.tsx` - Project card ✅ COMPLETE

---

## Phase 13: Grid Components (2 files) ✅ COMPLETE

- [x] `components/professionals-grid.tsx` - Professionals grid ✅ COMPLETE
- [x] `components/projects-grid.tsx` - Projects grid ✅ COMPLETE

---

## Phase 14: Filter Components (5 files) ✅ COMPLETE

- [x] `components/filter-bar.tsx` - Filter bar ✅ Already updated
- [x] `components/professionals-filter-bar.tsx` - Professionals filter bar ✅ Already updated
- [x] `components/filters-modal.tsx` - Filters modal ✅ Already updated
- [x] `components/professionals-filters-modal.tsx` - Professionals filters modal ✅ Already updated
- [x] `components/professionals-sidebar.tsx` - Professionals sidebar ✅ Already updated

---

## Phase 15: Professional Detail Components (8 files) ✅ COMPLETE

- [x] `components/professional-details.tsx` - Professional details ✅ COMPLETE
- [x] `components/professional-info.tsx` - Professional info ✅ COMPLETE
- [x] `components/professional-gallery.tsx` - Professional gallery ✅ No typography
- [x] `components/professional-projects.tsx` - Professional projects ✅ COMPLETE
- [x] `components/professional-reviews.tsx` - Professional reviews ✅ COMPLETE
- [x] `components/professional-contact-sidebar.tsx` - Professional contact sidebar ✅ COMPLETE
- [x] `components/professional-action-buttons.tsx` - Professional action buttons ✅ Already updated
- [x] `components/professional-categories.tsx` - Professional categories ✅ Already updated

---

## Phase 16: Project Detail Components (9 files) ✅ COMPLETE

- [x] `components/project-details.tsx` - Project details ✅ Already updated
- [x] `components/project-info.tsx` - Project info ✅ Already updated
- [x] `components/project-gallery.tsx` - Project gallery ✅ Already updated
- [x] `components/project-features.tsx` - Project features ✅ Already updated
- [x] `components/project-highlights.tsx` - Project highlights ✅ Already updated
- [x] `components/project-action-buttons.tsx` - Project action buttons ✅ Already updated
- [x] `components/project-categories.tsx` - Project categories ✅ Already updated
- [x] `components/project-types.tsx` - Project types ✅ Already updated
- [x] `components/similar-projects.tsx` - Similar projects ✅ Already updated

---

## Phase 17: Project Professional Components (1 file) ✅ COMPLETE

- [x] `components/project-professional-service-card.tsx` - Project professional service card ✅ Already updated

---

## Phase 18: Auth Components (4 files) ✅ COMPLETE

- [x] `components/auth/login-form.tsx` - Login form
- [x] `components/auth/signup-form.tsx` - Signup form
- [x] `components/auth/otp-form.tsx` - OTP form
- [x] `components/auth/auth-dialog.tsx` - Auth dialog

---

## Phase 19: Dashboard Components (3 files) ✅ COMPLETE

- [x] `components/dashboard-header.tsx` - Dashboard header
- [x] `components/dashboard-listings-filter.tsx` - Dashboard listings filter
- [x] `components/account-settings-form.tsx` - Account settings form

---

## Phase 20: Data Tables (2 files) ✅ COMPLETE

- [x] `components/projects-data-table.tsx` - Projects data table
- [x] `components/users-data-table.tsx` - Users data table

---

## Phase 21: Company Settings (1 file) ✅ COMPLETE

- [x] `components/company-settings/company-settings-shell.tsx` - Company settings shell

---

## Phase 22: Admin Components (6 files) - PARTIAL (3/6 complete)

- [x] `components/admin-sidebar.tsx` - Admin sidebar ✅
- [x] `components/admin-professionals-companies-table.tsx` - Admin professionals companies table ✅
- [x] `components/admin-professional-invites-table.tsx` - Admin professional invites table ✅
- [ ] `components/admin-projects-table.tsx` - Admin projects table (NOT STARTED - deprioritized)
- [ ] `components/admin-reviews-table.tsx` - Admin reviews table (NOT STARTED - deprioritized)
- [x] `components/admin-onboarding-form.tsx` - Admin onboarding form ✅ COMPLETE

---

## Phase 23: New Project Components (1 file) ✅ COMPLETE

- [x] `components/new-project/segmented-progress-bar.tsx` - Segmented progress bar (no typography)

---

## Phase 24: Project Details Form Components (7 files) ✅ COMPLETE

- [x] `components/project-details/project-basics-fields.tsx` - Project basics fields
- [x] `components/project-details/project-description-editor.tsx` - Project description editor
- [x] `components/project-details/project-features-fields.tsx` - Project features fields
- [x] `components/project-details/project-metrics-fields.tsx` - Project metrics fields
- [x] `components/project-details/project-narrative-fields.tsx` - Project narrative fields
- [x] `components/project-details/feature-checkbox-grid.tsx` - Feature checkbox grid
- [x] `components/project-details/custom-dropdown.tsx` - Custom dropdown

---

## Phase 25: Photo/Gallery Components (5 files) ✅ COMPLETE

- [x] `components/photo-tour-manager.tsx` - Photo tour manager ✅ COMPLETE
- [x] `components/feature-photo-selector-modal.tsx` - Feature photo selector modal ✅ COMPLETE
- [x] `components/feature-selection-grid.tsx` - Feature selection grid ✅ COMPLETE
- [x] `components/grouped-pictures-modal.tsx` - Grouped pictures modal ✅ COMPLETE
- [x] `components/professional-gallery-modal.tsx` - Professional gallery modal ✅ COMPLETE

---

## Phase 26: Modal Components (3 files) ✅ COMPLETE

- [x] `components/listing-status-modal.tsx` - Listing status modal ✅ COMPLETE
- [x] `components/share-modal.tsx` - Share modal ✅ COMPLETE
- [x] `components/report-modal.tsx` - Report modal ✅ COMPLETE

---

## Phase 27: Error Components (5 files)

- [ ] `components/errors/unauthorized-error.tsx` - Unauthorized error
- [ ] `components/errors/forbidden-error.tsx` - Forbidden error
- [ ] `components/errors/not-found-error.tsx` - Not found error
- [ ] `components/errors/service-unavailable-error.tsx` - Service unavailable error
- [ ] `components/errors/general-error.tsx` - General error

---

## Phase 28: Content Components (4 files)

- [x] `components/about-content.tsx` - About content ✅ COMPLETE
- [ ] `components/pricing-section.tsx` - Pricing section
- [ ] `components/faq1.tsx` - FAQ component 1
- [ ] `components/faq12.tsx` - FAQ component 12

---

## Phase 29: Navigation Components (7 files)

- [ ] `components/app-sidebar.tsx` - App sidebar
- [ ] `components/nav-main.tsx` - Main navigation
- [ ] `components/nav-projects.tsx` - Projects navigation
- [ ] `components/nav-user.tsx` - User navigation
- [ ] `components/team-switcher.tsx` - Team switcher
- [ ] `components/projects-navigation.tsx` - Projects navigation component
- [ ] `components/mobile-professionals-button.tsx` - Mobile professionals button

---

## Phase 30: Utility Components (10 files)

- [ ] `components/gallery-grid.tsx` - Gallery grid
- [ ] `components/map-section.tsx` - Map section
- [ ] `components/header-search.tsx` - Header search
- [ ] `components/editable-seo-cell.tsx` - Editable SEO cell
- [ ] `components/breadcrumb-with-tooltip.tsx` - Breadcrumb with tooltip
- [ ] `components/about3.tsx` - About component 3
- [ ] `components/login1.tsx` - Login component 1
- [x] `components/reset-password1.tsx` - Reset password component 1 ✅ COMPLETE
- [ ] `components/signup1.tsx` - Signup component 1
- [x] `components/update-password.tsx` - Update password component ✅ COMPLETE

---

## Phase 31: UI Components - shadcn/ui (19 files)

- [ ] `components/ui/card.tsx` - Card UI component
- [ ] `components/ui/dialog.tsx` - Dialog UI component
- [ ] `components/ui/alert-dialog.tsx` - Alert dialog UI component
- [ ] `components/ui/label.tsx` - Label UI component
- [ ] `components/ui/button.tsx` - Button UI component
- [ ] `components/ui/badge.tsx` - Badge UI component
- [ ] `components/ui/table.tsx` - Table UI component
- [ ] `components/ui/tabs.tsx` - Tabs UI component
- [ ] `components/ui/breadcrumb.tsx` - Breadcrumb UI component
- [ ] `components/ui/sidebar.tsx` - Sidebar UI component
- [ ] `components/ui/sheet.tsx` - Sheet UI component
- [ ] `components/ui/dropdown-menu.tsx` - Dropdown menu UI component
- [ ] `components/ui/select.tsx` - Select UI component
- [ ] `components/ui/tooltip.tsx` - Tooltip UI component
- [ ] `components/ui/accordion.tsx` - Accordion UI component
- [ ] `components/ui/input.tsx` - Input UI component
- [ ] `components/ui/textarea.tsx` - Textarea UI component
- [ ] `components/ui/checkbox.tsx` - Checkbox UI component
- [ ] `components/ui/radio-group.tsx` - Radio group UI component
- [ ] `components/ui/switch.tsx` - Switch UI component
- [ ] `components/ui/skeleton.tsx` - Skeleton UI component
- [ ] `components/ui/separator.tsx` - Separator UI component
- [ ] `components/ui/avatar.tsx` - Avatar UI component

---

## Phase 32: Other Components (6 files)

- [ ] `components/error-boundary.tsx` - Error boundary
- [ ] `components/filter-error-boundary.tsx` - Filter error boundary
- [ ] `components/root-providers.tsx` - Root providers
- [ ] `components/scroll-to-top.tsx` - Scroll to top
- [ ] `components/theme-provider.tsx` - Theme provider
- [ ] `components/project-structured-data.tsx` - Project structured data

---

## Phase 33: Loading States (3 files)

- [ ] `app/dashboard/settings/loading.tsx` - Settings loading state
- [ ] `app/homeowner/loading.tsx` - Homeowner loading state
- [ ] `app/list-with-us/loading.tsx` - List with us loading state

---

## Phase 34: FINAL - Update Global Styles (1 file)

- [ ] `app/globals.css` - **Apply new typography utility classes (LAST STEP)**

---

## Progress Summary

**Total Files**: 174
- Pages: 51
- Components: 123

**Completed**: 124/174 (71.3%)
**In Progress**: 0
**Remaining**: 50

**Phase 1**: ✅ COMPLETE (1/1 - Styles documentation)
**Phase 2**: ✅ COMPLETE (6/6 - ALL high-priority pages)
**Phase 3**: ✅ COMPLETE (8/8 - ALL authentication pages)
**Phase 4**: ✅ COMPLETE (6/6 - ALL dashboard pages)
**Phase 5**: ✅ COMPLETE (5/5 - ALL new project flow pages)
**Phase 6**: ✅ COMPLETE (6/6 - ALL admin pages)
**Phase 7**: ✅ COMPLETE (7/7 - ALL other pages)
**Phase 8**: ✅ COMPLETE (6/6 - ALL error pages)
**Phase 9**: ✅ COMPLETE (3/3 - ALL layouts)
**Phase 10**: ✅ COMPLETE (9/9 - ALL home page components)
**Phase 11**: ✅ COMPLETE (2/2 - ALL featured components)
**Phase 12**: ✅ COMPLETE (2/2 - ALL card components)
**Phase 13**: ✅ COMPLETE (2/2 - ALL grid components)
**Phase 14**: ✅ COMPLETE (5/5 - ALL filter components)
**Phase 15**: ✅ COMPLETE (8/8 - ALL professional detail components)
**Phase 16**: ✅ COMPLETE (9/9 - ALL project detail components)
**Phase 17**: ✅ COMPLETE (1/1 - Project professional components)
**Phase 18**: ✅ COMPLETE (4/4 - ALL auth components)
**Phase 19**: ✅ COMPLETE (3/3 - ALL dashboard components)
**Phase 20**: ✅ COMPLETE (2/2 - ALL data table components)
**Phase 21**: ✅ COMPLETE (1/1 - Company settings component)
**Phase 22**: 🔄 PARTIAL (4/6 - Admin components, 2 deprioritized)
**Phase 23**: ✅ COMPLETE (1/1 - New project components)
**Phase 24**: ✅ COMPLETE (7/7 - ALL project details form components)
**Other phases**: 2/56 (Various components)

---

## Notes

- Each file must be read COMPLETELY
- ALL text elements (h1-h6, p, span, label, etc.) must be updated
- globals.css is updated LAST after all components
- This ensures nothing breaks during migration

---

## Verification Commands

After all updates complete, verify no bare tags remain:

```bash
# Find any h1-h6 without className
grep -r "<h[1-6]>" app/ components/ --include="*.tsx" | grep -v "className="

# Find any p tags without className
grep -r "<p>" app/ components/ --include="*.tsx" | grep -v "className="

# Should return ZERO results
```
