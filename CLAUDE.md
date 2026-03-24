# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Arco is a Next.js 15 marketplace platform connecting clients with interior design/architecture companies. Uses React 19, TypeScript, Tailwind CSS v4, shadcn/ui, and Supabase for auth and database.

**Build configuration:** TypeScript and ESLint errors are ignored during builds (`ignoreBuildErrors: true`, `ignoreDuringBuilds: true`) for rapid prototyping. Image optimization is disabled (`unoptimized: true`).

## Development Commands

```bash
pnpm dev       # Start development server
pnpm build     # Build for production
pnpm lint      # Run ESLint
pnpm start     # Start production server
```

Always use **pnpm** (not npm or yarn).

## Architecture & Data Flow

### Server/Client Component Split

Pages follow this pattern: the page (Server Component) fetches initial data, passes it to a client component with filter/state logic:

```typescript
// app/projects/page.tsx (Server Component)
const projects = await fetchDiscoverProjects()
return (
  <FilterProvider>
    <DiscoverClient initialProjects={projects} />
  </FilterProvider>
)
```

Server queries live in `lib/projects/queries.ts` and `lib/professionals/queries.ts`. Client-side pagination/filtering hooks live in `hooks/use-projects-query.ts` and `hooks/use-professionals-query.ts`.

### Supabase Client Initialization

Use the appropriate client for context:

```typescript
// Server Components, Route Handlers, Server Actions
import { createServerSupabaseClient } from "@/lib/supabase/server"
const supabase = await createServerSupabaseClient()

// Client Components
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
const supabase = useMemo(() => getBrowserSupabaseClient(), [])
```

### Auth & Middleware

`middleware.ts` refreshes the Supabase session on every request (excluding static assets). It has special handling for `/homeowner` routes.

`app/layout.tsx` (root layout) initializes the session server-side and wraps children in `<RootProviders>`, which sets up auth context (`auth-context.tsx`) and all other global contexts.

### Context Architecture

Global state is managed through multiple React contexts in `contexts/`:
- `auth-context.tsx` — session, user, profile data
- `filter-context.tsx` — project discovery filters (location, types, spaces)
- `professional-filter-context.tsx` — professional/company discovery filters
- `saved-projects-context.tsx`, `saved-professionals-context.tsx` — bookmark state
- `project-gallery-modal-context.tsx`, `professional-gallery-modal-context.tsx` — gallery modal state

### App Router Structure

```
app/
├── (auth)/              # Grouped auth layout
├── (errors)/            # Custom 404, 500 pages
├── admin/               # Admin dashboard (users, projects, taxonomy)
├── auth/                # OAuth callback, invite-callback route handlers
├── dashboard/           # User dashboard, saved items, company settings
│   └── edit/[id]/       # Project editing
├── projects/[slug]/     # Project detail pages
├── professionals/[slug]/# Company detail pages
├── new-project/         # Multi-step project creation wizard
├── login/, signup/      # Auth flows
├── create-company/      # Company onboarding
├── businesses/          # Business-focused pages
└── page.tsx             # Landing page
```

### Key `lib/` Files

- `lib/supabase/types.ts` — Auto-generated Supabase TypeScript types (85KB). **Do not edit manually.**
- `lib/utils.ts` — `cn()` (Tailwind class merging), `getSiteUrl()`, `getSupportEmail()`
- `lib/project-details.ts` — Project form configuration and icon mappings
- `lib/rate-limit.ts` — Rate limiting via Upstash
- `lib/email-service.ts` — Email sending
- `lib/image-security.ts` — Image validation

### Notable Hooks

- `hooks/use-company-entitlements.ts` — Checks company plan tier and feature access
- `hooks/use-project-photo-tour.ts` — Large hook (75KB) managing photo gallery/tour state
- `hooks/use-require-auth.ts` — Auth protection for client components
- `hooks/use-professional-taxonomy.ts`, `hooks/use-project-taxonomy-options.ts` — Filter option data

---

## ⚠️ CRITICAL: Company-Centric Terminology

This platform is **COMPANY-CENTRIC**. The naming in the database can be confusing:

| Term | What It Means | What It Does NOT Mean |
|------|---------------|----------------------|
| `/professionals` page | Browse **COMPANIES** | Individual professional profiles |
| `professionals` table | **Team members** (users) within companies | Standalone professionals |
| `companies` table | **PRIMARY** marketplace entity | Secondary metadata |
| `professional_id` | User reference (team member) | Company reference |

**Flow:** User browses `/professionals` → sees companies → invites a company to project → invite sent to team member email → company is added to project.

---

## Database Architecture (Supabase)

**Project ID:** `ogvobdcrectqsegqrquz`
**Project URL:** `https://ogvobdcrectqsegqrquz.supabase.co`

**MCP Server:** Use `mcp__supabase__*` tools with `project_id: "ogvobdcrectqsegqrquz"` for all database operations.

### Core Tables

| Table | Purpose |
|-------|---------|
| `companies` | PRIMARY marketplace entity (name, services, ratings, photos) |
| `professionals` | Team members (users) within companies — *will be renamed `team_members`* |
| `profiles` | Extended user data; `types` array: `client \| professional \| admin` |
| `projects` | Client project listings with photos and location |
| `categories` | Service category hierarchy |
| `project_taxonomy_options` | Filter options (styles, sizes, features) |
| `project_taxonomy_selections` | Selected filter options per project |
| `project_photos` | Multiple photos per project |
| `project_features` | Rooms/spaces for photo organization |
| `project_professionals` | Email-based invite system linking users & companies to projects |
| `reviews` | Multi-dimensional company ratings |
| `company_ratings` | Aggregated company ratings |
| `saved_projects`, `saved_companies` | User bookmarks |
| `company_photos`, `company_social_links` | Company profile data |

**Unused/removed:** `project_applications`, `notifications`, `saved_professionals`, `messages` — do not reference these.

### Materialized Views & Search Functions

```sql
-- Company/professional listings (optimized)
SELECT * FROM mv_professional_summary;

-- Project gallery (optimized)
SELECT * FROM mv_project_summary;

-- Search with filters
SELECT * FROM public.search_professionals(
  search_query := 'architect',
  location_filter := 'Amsterdam',
  verified_only := true,
  limit_count := 20
);

SELECT * FROM public.search_projects(
  location_filter := 'Utrecht',
  category_filter := 'uuid-here',
  limit_count := 12
);

-- Refresh after bulk changes
SELECT public.refresh_all_materialized_views();
```

### Key Enums

```sql
user_type:            'client' | 'professional' | 'admin'
project_status:       'draft' | 'published' | 'in_progress' | 'completed' | 'archived'
project_budget_level: 'budget' | 'mid_range' | 'premium' | 'luxury'
```

### Migration Status

89 migrations applied (up to `089_fix_critical_security_issues.sql`).

**Upcoming:** Rename `professionals` → `team_members` with a compatibility VIEW during transition. See `REFACTORING_PLAN.md`.

---

## v0.app Integration

This project syncs with v0.app. Changes from v0.app are pushed to this repo and may overwrite local changes. Coordinate significant modifications with the v0.app workflow.
