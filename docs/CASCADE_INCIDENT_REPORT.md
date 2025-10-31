# CASCADE Incident Report - Migration 090

**Date:** 2025-10-31
**Severity:** HIGH
**Status:** RESOLVED

## 🚨 What Happened

Migration 090 (`090_phase1_drop_unused_tables.sql`) used `DROP TABLE ... CASCADE` to remove unused tables. The CASCADE keyword was too aggressive and caused a chain reaction of deletions.

## 💥 Cascade Chain of Destruction

```
DROP TABLE project_applications CASCADE
  ↓
Dropped mv_project_summary (referenced project_applications in LEFT JOIN)
  ↓
Dropped project_search_documents (view built on mv_project_summary)

DROP TABLE notifications CASCADE
  ↓
Dropped mv_professional_summary (may have referenced notifications)
  ↓
Dropped professional_search_documents (view built on mv_professional_summary)
```

## 🔴 Impact

### User-Visible Errors
1. **Landing page crashed:**
   - `relation "public.mv_project_summary" does not exist`
   - `column mv_professional_summary.primary_specialty_slug does not exist`

2. **Projects page failed:**
   - `GET /rest/v1/project_search_documents 404 (Not Found)`
   - `Failed to load projects`

3. **Saved projects broken:**
   - `Failed to load saved projects`

### Database Objects Lost
- ❌ `mv_project_summary` (materialized view)
- ❌ `mv_professional_summary` (materialized view)
- ❌ `project_search_documents` (view)
- ❌ `professional_search_documents` (view)

## ✅ Resolution

### Migration 091: Recreate mv_project_summary
**File:** `091_hotfix_recreate_mv_project_summary.sql`

**Changes:**
- Recreated `mv_project_summary` WITHOUT `project_applications` reference
- Removed unused application count columns
- Restored all required columns for project listings

**Result:** 8 projects restored

### Migration 092: Recreate mv_professional_summary
**File:** `092_hotfix_recreate_mv_professional_summary.sql`

**Changes:**
- Recreated `mv_professional_summary` with complete column set
- **Critical:** Added back `primary_specialty_slug` (required by landing page)
- Combined features from migrations 058, 063, and 074
- Included all rating, location, and company fields

**Result:** 14 professionals restored

### Migration 093: Recreate search document views
**File:** `093_hotfix_recreate_search_documents_views.sql`

**Changes:**
- Recreated `project_search_documents` view
- Recreated `professional_search_documents` view
- Restored full-text search functionality

**Result:** Both views working with 8 projects and 14 professionals

## 📊 Final Database State

All database objects verified and working:

| Object Type | Name | Status | Rows |
|-------------|------|--------|------|
| Materialized View | `mv_company_listings` | ✅ Working | 8 |
| Materialized View | `mv_professional_summary` | ✅ Working | 14 |
| Materialized View | `mv_project_summary` | ✅ Working | 8 |
| View | `company_metrics` | ✅ Working | N/A |
| View | `professional_search_documents` | ✅ Working | 14 |
| View | `project_search_documents` | ✅ Working | 8 |

## 🎓 Lessons Learned

### 1. Never Trust CASCADE Blindly
**Problem:** `DROP TABLE ... CASCADE` doesn't show what it will delete
**Solution:** Use `DROP TABLE ... RESTRICT` and handle dependencies manually

### 2. Check Materialized View Dependencies
**Problem:** Views that reference tables in subqueries are CASCADE victims
**Solution:** Query `pg_depend` before dropping:

```sql
-- Find what depends on a table
SELECT
  dependent_ns.nspname,
  dependent_view.relname as dependent_view,
  source_table.relname as source_table
FROM pg_depend
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid
JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid
JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
WHERE source_table.relname = 'table_name';
```

### 3. Test Migrations on Branches First
**Problem:** Production database was affected
**Solution:** Always test destructive migrations on development branches

### 4. Document CASCADE Side Effects
**Problem:** Migration didn't warn about CASCADE consequences
**Solution:** Add warning comments in migrations:

```sql
-- ⚠️ WARNING: This migration will CASCADE and drop dependent views
-- Dependencies checked: mv_project_summary references this table
```

## 🔧 Prevention Measures

### For Future Migrations

1. **Pre-migration dependency check:**
   ```bash
   # Check dependencies before dropping
   SELECT * FROM pg_depend WHERE refobjid = 'table_name'::regclass;
   ```

2. **Use RESTRICT by default:**
   ```sql
   DROP TABLE table_name RESTRICT;  -- Fails if dependencies exist
   ```

3. **Manual CASCADE with documentation:**
   ```sql
   -- Explicitly dropping: table_name, dependent_view_1, dependent_view_2
   DROP TABLE table_name CASCADE;
   ```

4. **Test on branch database:**
   - Create branch with `mcp__supabase__create_branch`
   - Test migration on branch
   - Verify app works
   - Merge to production

## 📝 Related Files

### Migrations
- `supabase/migrations/090_phase1_drop_unused_tables.sql` - Original (updated with warnings)
- `supabase/migrations/091_hotfix_recreate_mv_project_summary.sql` - Fix 1
- `supabase/migrations/092_hotfix_recreate_mv_professional_summary.sql` - Fix 2
- `supabase/migrations/093_hotfix_recreate_search_documents_views.sql` - Fix 3

### Code Changes
- `app/admin/users/actions.ts:527` - Removed saved_professionals reference
- `components/faq12.tsx:74` - Removed notifications mention
- `lib/supabase/types.ts` - Regenerated after table drops

## ✅ Verification Checklist

- [x] All materialized views exist and have data
- [x] All search document views working
- [x] Landing page loads without errors
- [x] Projects page loads correctly
- [x] Professional listings work
- [x] TypeScript types regenerated
- [x] No orphaned foreign keys
- [x] Application fully functional

## 🎯 Status: RESOLVED

**Total downtime:** ~30 minutes
**Migrations applied:** 4 (090 + 3 hotfixes)
**Database objects restored:** 4
**Application status:** ✅ Fully operational
