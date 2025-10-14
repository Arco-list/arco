Critical Issues
None at this time. Previous concerns about direct access to `mv_professional_summary` and icon slug mismatches were resolved via RPCs and registry updates.

Enhancement Backlog
1. Shared Constants
   - Locations: `hooks/use-professionals-query.ts`, `lib/professionals/queries.ts`, `hooks/use-professional-taxonomy.ts`, `contexts/professional-filter-context.tsx`
   - Several values (page size, cache TTL, debounce delay) are duplicated. Centralising them under `lib/constants.ts` would simplify future tuning.

2. Debounce Dependency Weight
   - Location: `contexts/professional-filter-context.tsx`
   - We currently import `lodash-es` solely for `debounce`. Replacing it with a lightweight utility (e.g. a custom helper or `just-debounce-it`) would trim bundle size.

3. Error Surface
   - Location: `hooks/use-professionals-query.ts`
   - Errors bubble up as raw strings. Introducing a structured error object (message + code) would help differentiate user-facing issues from unexpected failures.
