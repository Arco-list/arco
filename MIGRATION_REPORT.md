# Categories Table Migration Report

**Date**: November 5, 2025
**Migration File**: `/Users/vincent/arco-1/supabase/migrations/094_add_image_url_to_categories.sql`

## Current Schema

The `categories` table currently has the following columns:

1. `id` (UUID, primary key)
2. `name` (TEXT)
3. `slug` (TEXT)
4. `description` (TEXT)
5. `icon` (TEXT)
6. `color` (TEXT)
7. `parent_id` (UUID, nullable - references parent category)
8. `is_active` (BOOLEAN)
9. `sort_order` (INTEGER)
10. `created_at` (TIMESTAMP)
11. `updated_at` (TIMESTAMP)

### Status: ❌ `image_url` column does NOT exist

## Parent Categories (19 total)

Categories with `parent_id IS NULL`:

1. **Bathroom Design**
   - ID: `3f3184e3-16a6-4653-86e1-ce0138de1629`
   - Slug: `bathroom-design`

2. **Bed & Bath**
   - ID: `0be039ad-a5af-486a-938f-359cdc406fe7`
   - Slug: `bed-bath`

3. **Commercial**
   - ID: `2eb99499-95ed-4836-9eed-042c56b03c34`
   - Slug: `commercial`

4. **Construction** ⭐
   - ID: `75ecb86b-af7a-4d6d-b1ed-0252e7db9724`
   - Slug: `construction`
   - Will receive: `/construction-manager-at-building-site.jpg`

5. **Design & Planning** ⭐
   - ID: `d339d74e-18c3-4537-ab38-913a4a13c562`
   - Slug: `design-planning`
   - Will receive: `/professional-architect-working-on-blueprints.jpg`

6. **Finishing** ⭐
   - ID: `3786b6e4-61da-437b-a7ff-1ebe2abac70f`
   - Slug: `finishing`
   - Will receive: `/interior-designer-working-on-modern-room-design.jpg`

7. **Home Automation**
   - ID: `76bdc05b-fc2d-481b-a970-a17edf2bdf0c`
   - Slug: `home-automation`

8. **House**
   - ID: `44e690c6-009c-46fc-b9f6-4900dbb3d8c7`
   - Slug: `house`

9. **Interior Design**
   - ID: `18b8eb0f-ba7d-4ad8-897f-642d7259d954`
   - Slug: `interior-design`

10. **Kitchen & Living**
    - ID: `a9e419aa-e6df-4bda-9fd7-41e9be0833ac`
    - Slug: `kitchen-living`

11. **Kitchen Design**
    - ID: `e1cc307c-ba2a-4084-a740-3e8dc9def0ea`
    - Slug: `kitchen-design`

12. **Landscaping**
    - ID: `4211bdcc-3ac0-4fa1-9a03-88cc8ad0183f`
    - Slug: `landscaping`

13. **Lighting Design**
    - ID: `f55cfeb7-ab5e-4083-9c3b-d039ee9fe878`
    - Slug: `lighting-design`

14. **New Construction**
    - ID: `ebe6d30a-01de-4f89-b1ef-05327bb105c1`
    - Slug: `new-construction`

15. **Other**
    - ID: `e8986c47-a11b-4d8a-84b1-93ad42d64b0a`
    - Slug: `other`

16. **Outdoor** ⭐
    - ID: `78383240-9964-4085-9fea-6015d8ceab13`
    - Slug: `outdoor`
    - Will receive: `/landscape-designer-working-in-beautiful-garden.jpg`

17. **Renovation**
    - ID: `ca34ba4c-24c7-4a66-86d3-fce2e6277dd9`
    - Slug: `renovation`

18. **Residential**
    - ID: `877d3c2e-e618-4fb6-8083-6547759ccf8f`
    - Slug: `residential`

19. **Systems** ⭐
    - ID: `e4ce384f-d088-4bca-b8bd-ad49613c227d`
    - Slug: `systems`
    - Will receive: `/structural-engineer-working-on-technical-drawings.jpg`

⭐ = Will receive image_url value in this migration

## Migration Details

**File**: `094_add_image_url_to_categories.sql`

### What it does:

1. **Adds `image_url` column** (TEXT, nullable) to the `categories` table
2. **Updates 5 parent categories** with their respective image URLs:
   - `design-planning` → `/professional-architect-working-on-blueprints.jpg`
   - `construction` → `/construction-manager-at-building-site.jpg`
   - `systems` → `/structural-engineer-working-on-technical-drawings.jpg`
   - `finishing` → `/interior-designer-working-on-modern-room-design.jpg`
   - `outdoor` → `/landscape-designer-working-in-beautiful-garden.jpg`

### SQL Preview:

```sql
-- Add image_url column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update the 5 parent categories with their image URLs
UPDATE categories
SET image_url = '/professional-architect-working-on-blueprints.jpg'
WHERE slug = 'design-planning' AND parent_id IS NULL;

UPDATE categories
SET image_url = '/construction-manager-at-building-site.jpg'
WHERE slug = 'construction' AND parent_id IS NULL;

UPDATE categories
SET image_url = '/structural-engineer-working-on-technical-drawings.jpg'
WHERE slug = 'systems' AND parent_id IS NULL;

UPDATE categories
SET image_url = '/interior-designer-working-on-modern-room-design.jpg'
WHERE slug = 'finishing' AND parent_id IS NULL;

UPDATE categories
SET image_url = '/landscape-designer-working-in-beautiful-garden.jpg'
WHERE slug = 'outdoor' AND parent_id IS NULL;
```

## How to Apply This Migration

### Option 1: Supabase Dashboard SQL Editor (Recommended - Easiest)

1. Go to: https://supabase.com/dashboard/project/ogvobdcrectqsegqrquz/sql/new
2. Copy the entire contents of `supabase/migrations/094_add_image_url_to_categories.sql`
3. Paste into the SQL editor
4. Click "Run" button
5. Verify success message

### Option 2: Supabase CLI

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref ogvobdcrectqsegqrquz

# Push migrations
supabase db push
```

### Option 3: Using psql (PostgreSQL Client)

```bash
# Install PostgreSQL (if not installed)
brew install postgresql  # macOS
# or
sudo apt-get install postgresql-client  # Linux

# Get connection string from:
# https://supabase.com/dashboard/project/ogvobdcrectqsegqrquz/settings/database

# Run migration
psql "your-connection-string-here" < supabase/migrations/094_add_image_url_to_categories.sql
```

### Option 4: Using Node.js with pg package

```bash
# Install pg package
npm install pg

# Set DATABASE_URL environment variable with your connection string
# Get it from: https://supabase.com/dashboard/project/ogvobdcrectqsegqrquz/settings/database

# Run the migration script
DATABASE_URL="your-connection-string" node execute-migration-direct.mjs
```

## Verification

After applying the migration, verify it worked:

```bash
node check-categories.mjs
```

Or in Supabase SQL Editor:

```sql
-- Check column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'categories' AND column_name = 'image_url';

-- Check updated values
SELECT name, slug, image_url
FROM categories
WHERE parent_id IS NULL AND image_url IS NOT NULL
ORDER BY name;
```

Expected result: 5 parent categories should have image_url values.

## Notes

- The migration uses `ADD COLUMN IF NOT EXISTS` so it's safe to run multiple times
- Only 5 of the 19 parent categories receive image URLs in this migration
- The other 14 parent categories will have `NULL` for `image_url`
- Child categories (those with a `parent_id`) are not affected by this migration
