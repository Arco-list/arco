# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 project built with v0.app, featuring a responsive landing page for what appears to be a platform connecting professionals and project creators. The project uses React 19, TypeScript, and Tailwind CSS with shadcn/ui components.

**Key characteristics:**
- Generated from v0.app with automatic sync to this repository
- Configured for rapid prototyping with build errors/lint ignored during builds
- Uses modern React patterns with Server Components (RSC)
- Extensive use of Radix UI primitives through shadcn/ui

## Development Commands

\`\`\`bash
# Start development server
pnpm dev
# or
npm run dev

# Build for production
pnpm build

# Run linting (currently ignores errors during builds)
pnpm lint

# Start production server
pnpm start
\`\`\`

**Note:** TypeScript and ESLint errors are currently ignored during builds (`ignoreBuildErrors: true`, `ignoreDuringBuilds: true`) to facilitate rapid prototyping.

## Architecture & Structure

### App Router Structure (Next.js 15)
- **`app/`** - App Router with nested layouts and pages
  - Route segments: `about`, `admin`, `dashboard`, `login`, `pricing`, `projects`, etc.
  - Global layout in `app/layout.tsx` with Poppins font and scroll-to-top functionality
  - Main landing page in `app/page.tsx`

### Component Architecture
- **`components/ui/`** - shadcn/ui base components (buttons, cards, dialogs, etc.)
- **`components/`** - Custom application components (feature sections, dashboards, admin panels)
- **`lib/`** - Utilities and shared logic
  - `utils.ts` - Tailwind class merging and common utilities
  - `csv-data.ts` - Data handling utilities
- **`hooks/`** - Custom React hooks
- **`contexts/`** - React context providers

### Design System
- **Styling:** Tailwind CSS v4 with custom configuration
- **Components:** shadcn/ui (New York style) with Radix UI primitives
- **Icons:** Lucide React with Tabler icons as secondary
- **Typography:** Poppins font family (300-700 weights)
- **Theme:** CSS variables-based theming system

### Package Manager
Uses **pnpm** as evident from `pnpm-lock.yaml`. Always use `pnpm` commands for consistency.

## Key Dependencies

### UI & Styling
- **Next.js 15** with App Router and React 19
- **Tailwind CSS v4** with PostCSS
- **shadcn/ui** components (extensive Radix UI collection)
- **Lucide React** & **Tabler Icons** for iconography

### Forms & Data
- **React Hook Form** with **Zod** validation
- **@hookform/resolvers** for validation integration
- **@tanstack/react-table** for data tables

### Additional Features
- **next-themes** for theme switching
- **date-fns** & **react-day-picker** for date handling
- **recharts** for data visualization
- **sonner** for toast notifications
- **cmdk** for command palette functionality

## Development Patterns

### Component Creation
- Follow shadcn/ui conventions for base components
- Use the existing alias system: `@/components`, `@/lib`, `@/hooks`
- Leverage Radix UI primitives for accessibility and behavior
- Apply consistent styling with `cn()` utility from `lib/utils.ts`

### Styling Approach
- Utility-first with Tailwind CSS
- CSS variables for theming (`--background`, `--foreground`, etc.)
- Component variants using `class-variance-authority`
- Responsive design patterns throughout

### TypeScript Configuration
- Strict mode enabled with ES6 target
- Path aliases configured (`@/*` maps to root)
- Next.js plugin integration for enhanced TypeScript support

## v0.app Integration

This project is automatically synced with v0.app:
- Changes made in v0.app are pushed to this repository
- Continue development at: https://v0.app/chat/projects/VFadKYHUN1D
- Deployed on Vercel: https://vercel.com/tinkso/v0-arco

**Important:** Be mindful that changes may be overwritten by v0.app deployments. Coordinate significant modifications with the v0.app workflow.

## Database Architecture

### ⚠️ CRITICAL: Terminology for AI Agents

**IMPORTANT:** This platform is **COMPANY-CENTRIC**, not professional-centric. Understanding this is essential:

| Term | What It Means | What It Does NOT Mean |
|------|---------------|----------------------|
| **`/professionals` page** | Browse COMPANIES (not individuals) | Individual professional profiles |
| **Professional listing** | Company listing in marketplace | Individual user listing |
| **`professionals` table** | Team members (users) within companies | Standalone professionals |
| **`companies` table** | PRIMARY marketplace entity | Secondary metadata |
| **`professional_id`** | User reference (team member) | Company reference |

**Key Architecture Rules:**
1. **Companies** are the marketplace entity (what clients browse and hire)
2. **Team members** (professionals table) are individual users who belong to companies
3. The `/professionals` route displays **companies**, not individual people
4. All public-facing features show **company** data (name, logo, services, projects)
5. Individual user emails are used for invites, but companies are what get hired

**Example Flow:**
- User browses `/professionals` → sees **companies**
- User clicks company → sees **company** profile with team members
- User invites company to project → invite sent to **user email** (team member)
- Team member accepts → **company** is added to project (not individual)

### Supabase Database Structure
This project uses Supabase as the backend database with a comprehensive schema for the Arco professional services marketplace platform.

#### Core Tables

**Primary Entities:**
- **`companies`** - PRIMARY marketplace entity (name, services, ratings, photos)
- **`professionals`** - Team members (individual users) within companies ⚠️ *Will be renamed to `team_members`*
- **`profiles`** - Extended user data with types array (client/professional/admin)
- **`projects`** - Client project listings with photos and location

**Categories & Taxonomy:**
- **`categories`** - Service categories hierarchy
- **`project_taxonomy_options`** - Project filters (styles, sizes, features)
- **`project_taxonomy_selections`** - Selected options per project
- **`project_categories`** - Many-to-many project-category relationships
- **`professional_specialties`** - Team member specialties (minimal use)

**Project Management:**
- **`project_photos`** - Multiple photos per project with features
- **`project_features`** - Rooms/spaces for photo organization
- **`project_professionals`** - Invite system (email-based, links users & companies)
- **`project_professional_services`** - Services needed per project

**Reviews & Engagement:**
- **`reviews`** - Multi-dimensional rating system for companies
- **`company_ratings`** - Aggregated company ratings
- **`saved_projects`** - User bookmarks for projects
- **`saved_companies`** - User bookmarks for companies

**Company Data:**
- **`company_photos`** - Company gallery photos
- **`company_social_links`** - Social media profiles

**Removed/Unused:**
- ~~`project_applications`~~ - Never implemented ❌
- ~~`notifications`~~ - Never implemented ❌
- ~~`saved_professionals`~~ - Replaced by `saved_companies` ❌
- ~~`messages`~~ - Placeholder (0 rows)

#### Performance Optimizations
- **Materialized Views**:
  - `mv_professional_summary` - Optimized professional data for listings
  - `mv_project_summary` - Optimized project data for galleries
- **Search Functions**:
  - `search_professionals()` - Filter by location, specialty, rating, etc.
  - `search_projects()` - Filter by category, budget, features, etc.
- **Indexes**: Composite indexes, GIN indexes for arrays, full-text search
- **Auto-refresh**: Triggers update materialized views when data changes

#### Security Features
- **Row Level Security (RLS)**: Comprehensive policies on all tables
- **Profile Protection**: Users can only modify their own profiles
- **Project Privacy**: Draft projects private, published projects public
- **Message Security**: Only participants can read messages
- **Review Integrity**: Only clients who worked with professionals can review

#### Key Data Types & Enums
\`\`\`sql
user_type: 'client' | 'professional' | 'admin'
project_status: 'draft' | 'published' | 'in_progress' | 'completed' | 'archived'
application_status: 'pending' | 'accepted' | 'rejected'
project_budget_level: 'budget' | 'mid_range' | 'premium' | 'luxury'
\`\`\`

#### Database Connection
- **Project URL**: Use `mcp__supabase__get_project_url` to get the API endpoint
- **Anonymous Key**: Use `mcp__supabase__get_anon_key` for client-side connections
- **TypeScript Types**: Generate with `mcp__supabase__generate_typescript_types`

#### Migration Status & Refactoring Plan

**Current:** 89 migrations applied (up to 089_fix_critical_security_issues.sql)

**Upcoming Refactoring:** (See REFACTORING_PLAN.md for details)
- **Phase 1:** Drop unused tables (project_applications, notifications, saved_professionals)
- **Phase 2A:** Rename `professionals` → `team_members` + add VIEW for compatibility
- **Phase 2B:** Remove VIEW after testing

**Rationale:** Clarify company-centric architecture and reduce AI agent confusion

#### Usage Patterns
\`\`\`sql
-- Get professional listings
SELECT * FROM public.search_professionals(
  search_query := 'architect',
  location_filter := 'Amsterdam',
  verified_only := true,
  limit_count := 20
);

-- Get project listings
SELECT * FROM public.search_projects(
  location_filter := 'Utrecht',
  category_filter := 'uuid-of-architecture-category',
  limit_count := 12
);

-- Refresh materialized views
SELECT public.refresh_all_materialized_views();
\`\`\`
