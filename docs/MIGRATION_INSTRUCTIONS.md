# Migration Instructions: Add Image URLs to Categories

## Overview
This migration adds an `image_url` column to the `categories` table and populates it with appropriate professional images for each parent category.

## Migration File
**Location:** `/Users/vincent/arco-1/supabase/migrations/094_add_image_url_to_categories.sql`

## Available Images
The following professional images are available in the `/public` directory:

1. `/professional-architect-working-on-blueprints.jpg` - For Design & Planning
2. `/construction-manager-at-building-site.jpg` - For Construction
3. `/structural-engineer-working-on-technical-drawings.jpg` - For Systems
4. `/interior-designer-working-on-modern-room-design.jpg` - For Finishing
5. `/landscape-designer-working-in-beautiful-garden.jpg` - For Outdoor

## Option 1: Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ogvobdcrectqsegqrquz
2. Navigate to: **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the entire content from `supabase/migrations/094_add_image_url_to_categories.sql`
5. Click **Run** or press `Ctrl+Enter`

## Option 2: Supabase CLI

```bash
# Login to Supabase (if not already logged in)
npx supabase login

# Link to the project
npx supabase link --project-ref ogvobdcrectqsegqrquz

# Push the migration
npx supabase db push
```

## Option 3: Direct psql Connection

If you have the database password:

```bash
psql "postgresql://postgres:[YOUR_PASSWORD]@db.ogvobdcrectqsegqrquz.supabase.co:5432/postgres" \
  -f ./supabase/migrations/094_add_image_url_to_categories.sql
```

## What the Migration Does

### Step 1: Add Column
```sql
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;
```

This adds a new `image_url` column to the `categories` table if it doesn't already exist.

### Step 2: Update Parent Categories

Updates 5 parent categories with appropriate professional images:

| Category Slug | Category Name | Image URL |
|--------------|---------------|-----------|
| `design-planning` | Design & Planning | `/professional-architect-working-on-blueprints.jpg` |
| `construction` | Construction | `/construction-manager-at-building-site.jpg` |
| `systems` | Systems | `/structural-engineer-working-on-technical-drawings.jpg` |
| `finishing` | Finishing | `/interior-designer-working-on-modern-room-design.jpg` |
| `outdoor` | Outdoor | `/landscape-designer-working-in-beautiful-garden.jpg` |

## Verification

After running the migration, verify the changes with:

```sql
SELECT id, name, slug, image_url
FROM categories
WHERE parent_id IS NULL
ORDER BY name;
```

Expected result: All 5 parent categories should have their respective `image_url` values populated.

## Troubleshooting

### Column already exists error
If you get an error that the column already exists, that's okay - the `IF NOT EXISTS` clause will handle it. The UPDATE statements will still execute.

### Category not found
If an UPDATE statement doesn't affect any rows, check that:
1. The category slug matches exactly (case-sensitive)
2. The category exists in your database
3. The `parent_id IS NULL` condition is correct (these should be parent categories)

### Permission errors
Make sure you're running the SQL as a user with sufficient privileges. The Supabase SQL Editor and CLI both use admin credentials by default.

## Rollback (if needed)

If you need to remove the column:

```sql
ALTER TABLE categories DROP COLUMN IF EXISTS image_url;
```

**Note:** This will permanently delete all image_url data. Use with caution.
