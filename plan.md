# High-Level Implementation Plan

## 1. Establish Data & State Foundations
- [ ] Inventory existing components in `app/`, `components/`, and map them to PRD features/screens.
- [ ] Model core domain types (projects, professionals, companies, taxonomies) in `@/lib` to align UI props with Supabase schema.
- [x] Set up a shared Supabase browser client and server helpers (e.g., `@/lib/supabase/client.ts`, `@/lib/supabase/queries.ts`) with typed responses from `search_projects()` and `search_professionals()`.
- [ ] Introduce lightweight global state (React context or Zustand store) for auth session, saved items, and search filters, decoupling UI from fetch implementations.
- [ ] Define loading/error skeleton patterns and toast utilities so feature work can plug into consistent UX feedback early.

## 2. Global Layout, Navigation & Auth Guardrails
- [ ] Make the header responsive to auth state: unauthenticated shows `Projects`, `Professionals`, `Log In`, `Sign Up`, `List with Us`, `Help Center`; authenticated professionals swap `List with Us` for `Switch to company`.
- [ ] Wire top-level navigation to App Router routes (`/projects`, `/professionals`, `/list-with-us`, `/help`), ensuring query params persist across navigations per PRD.
- [x] Implement auth flows (modal + pages) backed by Supabase Auth with return-to context so gated actions reopen after login.
- [ ] Add mobile hamburger menu with required links and focus management; integrate theme-switch and locale placeholders per design.

## 3. Landing Page Interactivity
- [ ] Refine hero carousel so slides auto-advance every 5 seconds, include manual nav buttons, and link titles to project detail routes.
- [ ] Connect hero search bar to Discover (Projects tab) by pushing router search params for query, category, location, etc., with validation per acceptance criteria.
- [ ] Make category blocks deep-link to `/projects?category=...`; ensure taxonomy options come from Supabase or cached JSON.
- [ ] Populate Popular Projects and Featured Professionals sections via Supabase materialized views; enable All Projects/All Professionals buttons to route with active filters.
- [ ] Ensure Professional services and category grids navigate with pre-filtered query params respecting PRD taxonomy mapping.

## 4. Discover Experiences (Projects & Professionals)
- [ ] Build `app/projects/page.tsx` and `app/professionals/page.tsx` with tabbed layout, filter drawers, and infinite/ paginated lists using `search_projects()` / `search_professionals()`.
- [ ] Implement shared filter components (location, category, budget, services) with controlled state synced to URL for sharable searches.
- [ ] Surface list cards with quick actions (save, share) and ensure unauthenticated interactions trigger auth modal.
- [ ] Add loading states, empty states, and error recovery aligned with product copy.

## 5. Detail Pages & Engagement
- [ ] Flesh out project detail page: gallery viewer with share/save controls, metadata (style, type, location), feature sections, related projects carousel.
- [ ] Build professional detail page with company hero, ratings, services, photo gallery, contact CTA, and related projects per PRD.
- [ ] Connect share menu (copy link, email, WhatsApp, Messenger, Facebook, Twitter, embed) using Web Share API fallbacks.
- [ ] Ensure save/favorite actions persist to Supabase tables and update UI state optimistically.

## 6. Account Surfaces & Saved Items
- [ ] Create dashboard shell under `app/dashboard` with tabs for saved projects, saved professionals, and account settings.
- [ ] Integrate Supabase profile fetching/editing, allow avatar upload, and manage notification preferences per schema.
- [ ] Provide saved lists tied to `saved_projects` and `saved_professionals`; enable removal, bulk actions, and empty-state education.
- [ ] Add messaging inbox placeholders aligning with PRD communication features.

## 7. Contributor Flows (“List with Us” and Homeowner Wizard)
- [ ] Implement `/list-with-us` lead capture form with validation, file upload, and Supabase submission endpoint.
- [ ] Build homeowner multi-step wizard (F-26) using React Hook Form + Zod: enforce required taxonomy selections, year/budget validation, photo minimums, autosave (draft) to Supabase.
- [ ] Persist wizard progress (draft projects) between sessions and enable resume via dashboard.
- [ ] Integrate company domain detection to pre-fill organization metadata per acceptance criteria.

## 8. Professional Tools
- [ ] Provide company profile editor (F-28) with tabbed sections for overview, services, team, and coverage areas; autosave and toasts on success.
- [ ] Implement photo management grid with drag-and-drop reorder, upload progress, and Supabase storage integration (F-29).
- [ ] Add status toggles for Active/Deactivated with confirmation modals and server-side checks (F-30).
- [ ] Surface lead management view listing project applications with filter/sort, tying into Supabase functions.

## 9. Admin Workflows
- [ ] Create protected admin layout under `app/admin` with Supabase RLS guard.
- [ ] Implement user management (F-19) for verifying professionals and approving projects, reusing table component patterns.
- [ ] Build taxonomy management UI (F-23) for CRUD on categories/services, respecting sort orders and cascading updates.
- [ ] Add submissions/reviews moderation queues (F-24, F-32) with bulk actions, detail drawers, and status updates.

## 10. Observability, QA & Release Readiness
- [ ] Add feature flag/config system for staged rollouts and v0 sync resiliency.
- [ ] Instrument analytics hooks for key funnels (search, detail engagement, submission) and error reporting.
- [ ] Define manual QA scripts aligned with PRD acceptance criteria; automate critical flows with Playwright as time allows.
- [x] Draft auth smoke-test checklist (create account, log in/out, restricted route redirect) and ensure `pnpm lint` is part of the pre-release routine; Playwright sign-in coverage to follow when infra is ready.
- [ ] Establish linting/pre-commit hygiene (`pnpm lint`, optional Vitest/RTL scaffolding) and document deployment checklist including Supabase migration verification.
