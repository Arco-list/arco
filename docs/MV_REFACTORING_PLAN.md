# Safe Schema Changes with Materialized Views

**Date:** 2025-10-31
**Status:** 🟡 ACTIVE PLAN - Ready to Implement
**Priority:** HIGH - Preventing future CASCADE incidents

> **This is the primary active plan** following the Phase 1 cleanup completion and CASCADE incident recovery.

## 🎯 The Real Problem

**MVs are NOT the problem** - they're a deliberate performance optimization. The problem is: **we don't have safeguards to prevent breaking them when changing schema.**

**What went wrong in Phase 1:**
1. ❌ Used `DROP TABLE ... CASCADE` without checking dependencies
2. ❌ Didn't query `pg_depend` or check MV definitions before dropping
3. ❌ No automated way to know what MVs reference which tables
4. ❌ No pre-migration checks to prevent CASCADE disasters

**Example from Phase 1:**
```sql
-- This DROP broke 4 views because we didn't check first
DROP TABLE project_applications CASCADE;
  ↓
  Destroyed: mv_project_summary (had LEFT JOIN to it)
  ↓
  Destroyed: project_search_documents (built on mv_project_summary)
  ↓
  App completely broken, 3 hotfix migrations needed
```

**The Goal:** Keep MVs for performance, but add safety checks so schema changes don't break them.

## 📊 Current Materialized View Inventory

| MV Name | Purpose | Dependencies | Complexity | Refresh Strategy |
|---------|---------|--------------|------------|------------------|
| `mv_project_summary` | Project listings | projects, profiles, project_photos, project_categories, categories | HIGH (7 tables, subqueries) | Manual/Triggered |
| `mv_professional_summary` | Professional listings | professionals, companies, profiles, company_ratings, professional_specialties, categories | VERY HIGH (9 tables, multiple subqueries) | Manual/Triggered |
| `mv_company_listings` | Company directory | companies, professionals, company_ratings, professional_specialties, categories | HIGH (8 tables, EXISTS subqueries) | Manual/Triggered |

**Regular Views:**
| View Name | Purpose | Dependencies |
|-----------|---------|--------------|
| `company_metrics` | Company stats | Companies, professionals, project_professionals, reviews |
| `project_search_documents` | FTS for projects | mv_project_summary |
| `professional_search_documents` | FTS for professionals | mv_professional_summary |

## 🎯 Goals

1. **Keep MVs for performance** - They exist for a reason
2. **Make schema changes safe** - No more CASCADE surprises
3. **Clear dependency tracking** - Know what depends on what BEFORE changing schema
4. **Automated safety checks** - Prevent human error
5. **Low risk deployment** - Can't afford another incident

## 🔧 Solution: Safety Guardrails

### 1. Pre-Migration Dependency Checker Function

Create a function that checks what MVs would be affected BEFORE dropping/renaming tables:

```sql
CREATE OR REPLACE FUNCTION check_table_dependencies(target_table TEXT)
RETURNS TABLE(
  object_type TEXT,
  object_name TEXT,
  definition TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN c.relkind = 'm' THEN 'MATERIALIZED VIEW'
      WHEN c.relkind = 'v' THEN 'VIEW'
      ELSE 'OTHER'
    END as object_type,
    c.relname::TEXT as object_name,
    pg_get_viewdef(c.oid)::TEXT as definition
  FROM pg_class c
  WHERE c.relkind IN ('m', 'v')
    AND pg_get_viewdef(c.oid) ILIKE '%' || target_table || '%'
  ORDER BY c.relkind, c.relname;
END;
$$ LANGUAGE plpgsql;
```

**Usage:**
```sql
-- BEFORE dropping any table:
SELECT * FROM check_table_dependencies('project_applications');

-- Output would have shown:
-- MATERIALIZED VIEW | mv_project_summary | SELECT ... FROM project_applications ...
-- VIEW | project_search_documents | SELECT ... FROM mv_project_summary ...
```

### 2. Always Use RESTRICT, Never CASCADE

**New Migration Rule:**
```sql
-- ✅ CORRECT: Will fail if dependencies exist, forcing you to check
DROP TABLE table_name RESTRICT;

-- ❌ NEVER USE: Silently destroys everything
DROP TABLE table_name CASCADE;
```

**Migration Template:**
```sql
-- Step 1: Check dependencies first
DO $$
DECLARE
  dep_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dep_count
  FROM check_table_dependencies('table_name');

  IF dep_count > 0 THEN
    RAISE EXCEPTION 'Table has % dependent objects. Check with: SELECT * FROM check_table_dependencies(''table_name'')', dep_count;
  END IF;
END $$;

-- Step 2: Only if safe, drop with RESTRICT
DROP TABLE table_name RESTRICT;
```

### 3. Document MV Dependencies

Create a reference file documenting what each MV depends on:

**File: `supabase/MV_DEPENDENCIES.md`**
```markdown
# Materialized View Dependencies

## mv_project_summary
**Depends on:**
- projects (direct)
- profiles (JOIN)
- project_photos (LEFT JOIN)
- project_categories (LEFT JOIN)
- categories (JOIN through project_categories)

**Used by:**
- project_search_documents (VIEW)

## mv_professional_summary
**Depends on:**
- professionals (direct)
- companies (JOIN)
- profiles (LEFT JOIN)
- company_ratings (LEFT JOIN)
- professional_specialties (LEFT JOIN)
- categories (JOIN through professional_specialties)
- company_photos (subquery)

**Used by:**
- professional_search_documents (VIEW)

## mv_company_listings
**Depends on:**
- companies (direct)
- professionals (EXISTS subquery)
- company_ratings (LEFT JOIN)
- professional_specialties (EXISTS subquery)
- categories (JOIN)

**Used by:** (none)
```

### 4. Automated Post-Migration Tests

Add a test migration that runs after EVERY migration:

```sql
-- Test: Verify all MVs still exist
DO $$
DECLARE
  missing_mvs TEXT[];
BEGIN
  SELECT ARRAY_AGG(mv_name)
  INTO missing_mvs
  FROM (VALUES
    ('mv_project_summary'),
    ('mv_professional_summary'),
    ('mv_company_listings')
  ) AS expected(mv_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE schemaname = 'public'
      AND matviewname = mv_name
  );

  IF array_length(missing_mvs, 1) > 0 THEN
    RAISE EXCEPTION 'Missing materialized views: %', array_to_string(missing_mvs, ', ');
  END IF;

  RAISE NOTICE 'All materialized views exist ✓';
END $$;
```

### 5. Pre-Commit Hook for Migrations

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
# Check for dangerous CASCADE usage in migrations

if git diff --cached --name-only | grep -q "supabase/migrations/"; then
  if git diff --cached | grep -i "DROP.*CASCADE"; then
    echo "❌ ERROR: Found DROP ... CASCADE in migration"
    echo "Use DROP ... RESTRICT and check dependencies first"
    exit 1
  fi
fi
```

---

## 📋 Implementation Plan

### Phase 1: Safety Infrastructure (This Week) - LOW RISK

**Goal:** Add guardrails to prevent future CASCADE incidents

1. [ ] Create `check_table_dependencies()` function in database
2. [ ] Create `supabase/MV_DEPENDENCIES.md` reference file
3. [ ] Add post-migration test to verify MVs still exist
4. [ ] Add pre-commit hook to block CASCADE usage
5. [ ] Update migration template in docs

**Migration:**
```sql
-- Migration: 094_add_dependency_checker.sql
CREATE OR REPLACE FUNCTION check_table_dependencies(target_table TEXT)
RETURNS TABLE(object_type TEXT, object_name TEXT, definition TEXT)
AS $$ ... $$;

-- Test it works
SELECT * FROM check_table_dependencies('professionals');
```

### Phase 2: Documentation (This Week) - ZERO RISK

1. [ ] Document all current MV dependencies
2. [ ] Add "Before Dropping Tables" checklist to migration docs
3. [ ] Update CLAUDE.md with migration safety rules
4. [ ] Create runbook for "MV accidentally dropped" recovery

### Phase 3: Automated Testing (Next Week) - LOW RISK

1. [ ] Add integration tests that verify MVs exist
2. [ ] Add tests that verify MVs have expected columns
3. [ ] Run tests in CI/CD pipeline before deployment

**Example Test:**
```typescript
describe('Materialized Views', () => {
  it('should have all expected MVs', async () => {
    const { data } = await supabase
      .from('pg_matviews')
      .select('matviewname')
      .eq('schemaname', 'public');

    expect(data).toContainEqual({ matviewname: 'mv_project_summary' });
    expect(data).toContainEqual({ matviewname: 'mv_professional_summary' });
    expect(data).toContainEqual({ matviewname: 'mv_company_listings' });
  });
});
```

---

## 🚦 Migration Safety Checklist

**BEFORE dropping or renaming any table, ALWAYS:**

- [ ] Run `SELECT * FROM check_table_dependencies('table_name');`
- [ ] Check `supabase/MV_DEPENDENCIES.md` for documented dependencies
- [ ] Use `DROP TABLE ... RESTRICT` (NEVER CASCADE)
- [ ] If dependencies exist, manually update MV definitions first
- [ ] Test MV queries still work after schema change
- [ ] Run post-migration tests to verify MVs intact

---

## 🎓 Why This Matters

**Current State (After Phase 1 Incident):**
- ❌ No way to check MV dependencies before schema changes
- ❌ Can't safely drop or rename tables
- ❌ Every migration is high risk
- ❌ Already had one production incident requiring 3 hotfix migrations

**After Implementing Safety Guardrails:**
- ✅ Can check dependencies BEFORE making changes
- ✅ Automated tests catch broken MVs immediately
- ✅ Pre-commit hooks prevent CASCADE usage
- ✅ Clear documentation of what depends on what
- ✅ Safe to proceed with Phase 2 (professionals → team_members rename)

**This enables:**
- Future schema refactoring without fear
- Safe execution of Phase 2 (if approved)
- Confidence in database migrations
- Faster development without breaking production

---

## 📌 What Changed from Previous Version

**Previous Plan (WRONG):**
- ❌ Assumed MVs were "too complex and fragile"
- ❌ Proposed converting MVs to regular views
- ❌ Missed that MVs are deliberate performance optimization

**Updated Plan (CORRECT):**
- ✅ MVs are a feature, not a bug - keep them for performance
- ✅ Problem is lack of safety checks, not MVs themselves
- ✅ Add guardrails to make schema changes safe
- ✅ Document dependencies so we know what to check

**Key Insight:** The CASCADE incident wasn't because MVs are bad - it was because we didn't check dependencies before dropping tables. This plan adds those checks.

---

## 📌 Next Steps

**Recommendation:** Implement Phase 1 (Safety Infrastructure) this week

**Why:**
- Low risk (just adding safety functions and docs)
- Immediate value (prevents future CASCADE incidents)
- Enables future work (Phase 2 rename can proceed safely)
- Takes ~2 hours to implement

**After Phase 1 Complete:**
- Safer to proceed with Phase 2 (professionals → team_members) if desired
- Can confidently make future schema changes
- Have recovery runbook if issues occur

---

**Document Status:** 🔴 UPDATED - Ready for Review
**Owner:** Database Team
**Review Required:** Yes
**Previous Error:** Incorrectly proposed removing MVs instead of adding safety checks
