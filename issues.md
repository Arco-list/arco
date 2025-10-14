🔴 Critical Issues
1. Clickjacking in Filter Dropdowns (professionals-filter-bar.tsx:162-179)
Security Risk: The click-outside handler has a logic error that only closes dropdowns if BOTH refs exist AND the click is outside BOTH. If one ref is null, dropdowns won't close.

Current code:

if (
  serviceDropdownRef.current &&
  !serviceDropdownRef.current.contains(target) &&
  locationDropdownRef.current &&
  !locationDropdownRef.current.contains(target)
) {
  setActiveDropdown(null)
}
Recommended fix:

const isOutsideService = serviceDropdownRef.current && !serviceDropdownRef.current.contains(target)
const isOutsideLocation = locationDropdownRef.current && !locationDropdownRef.current.contains(target)

if (isOutsideService && isOutsideLocation) {
  setActiveDropdown(null)
}
2. Race Condition in useProfessionalsQuery (use-professionals-query.ts:114-186)
Issue: The abort controller cleanup happens after state updates, potentially causing state updates on unmounted components.

Recommended fix: Add a mounted check to prevent state updates after unmount.

3. SQL Pattern Risk in Migration 052 (line 12-13)
While the current usage is safe (hardcoded values), the array_