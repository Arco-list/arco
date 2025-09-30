# Arco Platform Database Setup

This directory contains the complete database schema and migrations for the Arco platform - a professional services marketplace connecting clients with architects, interior designers, contractors, and other construction professionals.

## 📋 Overview

The database schema is designed to support:
- **User Management**: Built on Supabase Auth with extended profiles
- **Professional Profiles**: Service providers with specialties, ratings, and portfolios
- **Project Management**: Client project listings with photos and applications
- **Reviews & Messaging**: User interactions and communication
- **Search & Discovery**: Optimized for filtering and search functionality

## 🚀 Quick Start

### Option 1: Using Supabase Dashboard (Recommended)

1. Open your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to SQL Editor
3. Execute the migration files in order (001 through 008)
4. Enable Realtime for tables you need live updates for

### Option 2: Using Supabase CLI

\`\`\`bash
# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
\`\`\`

## 🔑 Auth Environment Configuration

Supabase Auth requires a consistent set of environment variables locally and in deployment (e.g., Vercel). Copy the values from the Supabase dashboard **Project Settings → API** page and keep them in sync with your `.env.local` file.

| Variable | Scope | Source | Local target | Notes |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & server | Supabase `Project URL` | `.env.local` | Exposed to the browser; must match the Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Supabase `anon public` key | `.env.local` | Public key required for browser authentication flows. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase `service_role` key | `.env.local` | Never expose to the client; used by server actions that need elevated RLS access. |

### Sync workflow

1. In Supabase, open **Project Settings → API** and copy the three values above.
2. Create or update `.env.local` at the repo root:
   \`\`\`env
   NEXT_PUBLIC_SUPABASE_URL="..."
   NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
   SUPABASE_SERVICE_ROLE_KEY="..."
   \`\`\`
3. Restart the Next.js dev server after edits so the environment variables reload.
4. Mirror the same values in your deployment provider (e.g., Vercel) to keep runtime environments aligned.
5. Do not commit `.env.local`; rely on dashboard-managed secrets for shared environments.

## 🧩 Generating Typed Clients

Run the Supabase CLI against your hosted project to keep `lib/supabase/types.ts` in sync with the database schema:

\`\`\`bash
pnpm supabase gen types typescript --project-id <your-project-ref> --schema public > lib/supabase/types.ts
\`\`\`

The project reference is visible in the Supabase dashboard under **Project Settings → General**. Regenerate the file after any migration or schema change so both `lib/supabase/browser.ts` and `lib/supabase/server.ts` share the latest `Database` types.

## 📁 Migration Files

Execute these SQL files **in order** in your Supabase SQL Editor:

1. **001_create_core_enums_and_types.sql**
   - Core enum types (user_type, project_status, etc.)
   - Foundation data types

2. **002_create_profiles_table.sql**
   - Extended user profiles linking to auth.users
   - Automatic profile creation trigger
   - User type management

3. **003_create_companies_and_professionals.sql**
   - Company information and management
   - Professional profiles with ratings
   - Automatic rating aggregation system

4. **004_create_projects_and_photos.sql**
   - Project listings and metadata
   - Photo management with ordering
   - Project applications workflow

5. **005_create_categorization_system.sql**
   - Service categories and specialties
   - Professional-category relationships
   - Pre-populated category data

6. **006_create_user_interactions.sql**
   - Review and rating system
   - Project-based messaging
   - Saved items (projects/professionals)
   - Notification system

7. **007_implement_rls_policies.sql**
   - Comprehensive Row Level Security
   - User permission management
   - Data access control

8. **008_performance_optimizations.sql**
   - Performance indexes
   - Materialized views for fast queries
   - Search functions
   - Analytics capabilities

9. **009_remove_unnecessary_views.sql**
   - Cleans up legacy materialized views
   - Simplifies analytics footprint

10. **010_create_project_features_table.sql**
    - Introduces `project_features` for photo tour grouping
    - Adds ordering/highlight metadata and triggers

11. **011_add_feature_id_to_project_photos.sql**
    - Links each photo to an optional feature via `feature_id`
    - Preps the photo tour drag/drop experience

12. **012_add_location_fields_to_projects.sql**
    - Stores structured address data, lat/lng, and privacy toggle
    - Adds a spatial index for map queries

13. **013_create_project_professionals_table.sql**
    - Creates `project_professionals` with invitation status enum
    - Tracks which professionals are listed/live/unlisted per project
    - Enables RLS + updated_at trigger

## 🔐 Security Features

### Row Level Security (RLS)
All tables have RLS policies that ensure:
- Users can only access their own private data
- Public data is available to anonymous users
- Proper permissions for professional-client interactions

### Key Security Measures
- **Profile Protection**: Users can only modify their own profiles
- **Project Privacy**: Draft projects are private, published projects are public
- **Message Security**: Only participants can read messages
- **Review Integrity**: Only clients who worked with professionals can review them

## 📊 Key Database Features

### User System
- **auth.users**: Supabase built-in authentication
- **profiles**: Extended user data with type (client/professional/admin)
- **companies**: Professional organization profiles

### Professional System
- **professionals**: Service provider profiles
- **professional_specialties**: Many-to-many with categories
- **professional_ratings**: Aggregated rating data (auto-updated)

### Project System
- **projects**: Client project listings
- **project_photos**: Multiple photos with primary designation
- **project_applications**: Professional applications to projects

### Interaction System
- **reviews**: Multi-dimensional rating system
- **messages**: Project-based communication
- **saved_projects/professionals**: User bookmarks
- **notifications**: System notifications

## 🔍 Search & Performance

### Optimized Queries
- **Materialized Views**: Pre-computed data for fast listings
  - `mv_professional_summary`: Optimized professional data
  - `mv_project_summary`: Optimized project data

### Search Functions
- `search_professionals()`: Filter by location, specialty, rating, etc.
- `search_projects()`: Filter by category, budget, features, etc.

## 🌱 Seed Scripts

Located in `supabase/seed`. Run them after the Phase 1 migrations to populate dropdowns the wizard depends on.

### 001_seed_professional_taxonomy.sql

- Inserts the Design & Planning / Construction / Systems / Finishing / Outdoor categories
- Adds each professional service as a child category (idempotent upserts via slug)
- Safe to re-run — updates names and keeps entries active

### 002_seed_project_taxonomy.sql

- Ensures a `project_category_attributes` helper table exists
- Populates project categories (House, Kitchen & Living, etc.) and their sub-types
- Flags whether each sub-type is listable and/or a building feature
- Re-runnable without duplication

### How to Apply Seeds

```bash
# assuming you have supabase CLI linked
supabase db remote commit              # optional: snapshot current state
supabase db push                       # applies pending migrations (010–013)
psql "$SUPABASE_DB_URL" -f supabase/seed/001_seed_professional_taxonomy.sql
psql "$SUPABASE_DB_URL" -f supabase/seed/002_seed_project_taxonomy.sql

# or, using Supabase SQL Editor
# 1. Paste the contents of each seed file and run.
```

After seeding:

1. `SELECT slug, name FROM categories WHERE parent_id IS NULL ORDER BY sort_order;`
2. Spot-check child categories and attributes (`SELECT * FROM project_category_attributes LIMIT 5;`).
3. Regenerate types: `pnpm supabase gen types typescript ...` so `lib/supabase/types.ts` picks up new columns.

🚨 **Reminder:** Only professional accounts can create listings. Ensure the Create Company onboarding sets `profiles.user_types` to include `professional` before exposing the wizard.
- Full-text search on titles and descriptions

### Performance Features
- **Composite Indexes**: Optimized for common query patterns
- **GIN Indexes**: Fast array and full-text search
- **Materialized Views**: Pre-computed aggregations
- **Automatic Refresh**: Triggers update views when data changes

## 💾 Data Types & Enums

### Core Enums
\`\`\`sql
user_type: 'client' | 'professional' | 'admin'
project_status: 'draft' | 'published' | 'in_progress' | 'completed' | 'archived'
application_status: 'pending' | 'accepted' | 'rejected'
project_budget_level: 'budget' | 'mid_range' | 'premium' | 'luxury'
\`\`\`

### Key Array Fields
- **projects.style_preferences**: ['Contemporary', 'Modern', 'Traditional']
- **projects.features**: ['Swimming Pool', 'Garden', 'Smart Home']
- **professionals.services_offered**: ['Design', 'Construction', 'Consultation']
- **professionals.languages_spoken**: ['Dutch', 'English', 'German']

## 🔧 Maintenance Functions

### Materialized View Refresh
\`\`\`sql
-- Refresh individual views
SELECT public.refresh_professional_summary();
SELECT public.refresh_project_summary();

-- Refresh all views
SELECT public.refresh_all_materialized_views();
\`\`\`

### Platform Statistics
\`\`\`sql
-- Get platform-wide stats
SELECT * FROM public.get_platform_stats();
\`\`\`

## 📱 Frontend Integration

### Key Views for UI Components
- **v_professional_cards**: Optimized data for professional listings
- **v_project_cards**: Optimized data for project galleries

### Common Queries

#### Get Professional Listings
\`\`\`sql
SELECT * FROM public.search_professionals(
  search_query := 'architect',
  location_filter := 'Amsterdam',
  verified_only := true,
  limit_count := 20
);
\`\`\`

#### Get Project Listings
\`\`\`sql
SELECT * FROM public.search_projects(
  location_filter := 'Utrecht',
  category_filter := 'uuid-of-architecture-category',
  featured_only := false,
  limit_count := 12
);
\`\`\`

#### Get User's Saved Items
\`\`\`sql
-- Saved projects
SELECT p.* FROM public.saved_projects sp
JOIN public.mv_project_summary p ON sp.project_id = p.id
WHERE sp.user_id = auth.uid()
ORDER BY sp.created_at DESC;

-- Saved professionals
SELECT p.* FROM public.saved_professionals sp
JOIN public.mv_professional_summary p ON sp.professional_id = p.id
WHERE sp.user_id = auth.uid()
ORDER BY sp.created_at DESC;
\`\`\`

## 🌐 Realtime Configuration

Enable realtime for tables where you need live updates:

\`\`\`sql
-- Enable realtime for messages (chat functionality)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable realtime for project applications
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_applications;
\`\`\`

## 🚨 Important Notes

1. **Run migrations in order**: The files are numbered and must be executed sequentially
2. **Backup first**: Always backup your database before running migrations
3. **Test thoroughly**: Test all functionality after migration
4. **Monitor performance**: Watch query performance and refresh materialized views as needed
5. **Update access tokens**: Make sure your Supabase access tokens are configured properly

## 📞 Support

For questions about the database schema or implementation:
1. Check the comments in SQL files for detailed explanations
2. Review the RLS policies for security implementation details
3. Examine the materialized views for optimized query patterns

## 🔄 Future Enhancements

The schema is designed to be extensible. Consider these additions as your platform grows:
- **Payment Integration**: Add tables for transactions and billing
- **Advanced Analytics**: More detailed tracking and reporting
- **Multi-language Support**: Localized content tables
- **Advanced Matching**: AI-powered professional-project matching
- **File Management**: Integration with Supabase Storage for documents

---

**Generated with [Claude Code](https://claude.ai/code)**

*Last updated: [Generated on database implementation]*
