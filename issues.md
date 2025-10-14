Critical Issues
1. RLS Bypass Vulnerability ⚠️
Location: hooks/use-professional-taxonomy.ts:99

The taxonomy hook directly queries mv_professional_summary, but migration 052 revokes access to this view. This will break in production.

// Current code (will fail):
supabase
  .from("mv_professional_summary")
  .select("company_country,company_state_region,company_city")
Solution: Create a dedicated RPC function or use the public search_professionals RPC to get location facets:

-- Add to migration 052 or new migration 053
CREATE OR REPLACE FUNCTION public.get_professional_location_facets()
RETURNS TABLE (
  country TEXT,
  state_region TEXT,
  city TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.company_country,
    p.company_state_region,
    p.company_city
  FROM public.mv_professional_summary p
  WHERE
    p.is_available = TRUE
    AND p.company_plan_tier = 'plus'
    AND p.company_status = 'listed'
    AND (p.company_plan_expires_at IS NULL OR p.company_plan_expires_at > NOW())
  ORDER BY
    p.company_country,
    p.company_state_region,
    p.company_city;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
Then update the hook to call this function instead.

2. Icon Registry Inconsistency
Location: components/professionals-filter-bar.tsx:72

The icon registry includes "construction-welness" (typo) but migration 052 fixes this to "wellness". This inconsistency could cause icons to not display correctly.

// Line 72 includes both:
[["construction-wellness", "construction-welness", "wellness"], HeartPulse],
Solution: Remove the "construction-welness" typo reference since it's been fixed in the database.

Performance Concerns
3. Expensive Location Options Computation
Location: components/professionals-filter-bar.tsx:220-243

The locationOptionsList computation runs on every render when dependencies change, and it's doing complex nested operations.

Recommendation: Move this logic to the context provider or a separate hook to share across components and reduce recalculation.

4. Missing Index on Search Vector
Location: supabase/migrations/050_update_professional_filters.sql

The full-text search uses search_vector (migration 052:90) but there's no GIN index on it in the view definition.

Solution: Add index to migration 052:

CREATE INDEX idx_professional_search_documents_search_vector 
ON public.professional_search_documents USING gin(search_vector);
However, note that you cannot index views directly - you'd need to either:

Make professional_search_documents a materialized view instead, OR
Add the search_vector column directly to mv_professional_summary and index it there
Code Quality Issues
5. Magic Numbers
Locations: Multiple files

PAGE_SIZE = 20 (hooks/use-professionals-query.ts:10)
INITIAL_PAGE_SIZE = 20 (lib/professionals/queries.ts:18)
CACHE_TTL_MS = 5 * 60 * 1000 (hooks/use-professional-taxonomy.ts:9)
300 debounce ms (contexts/professional-filter-context.tsx:397)
Recommendation: Extract to a shared constants file for consistency and easier configuration.

6. Lodash Dependency
Location: contexts/professional-filter-context.tsx:14

Using lodash-es just for debounce adds ~7KB to bundle size. Consider using a native implementation or a smaller alternative like just-debounce-it (~200 bytes).

7. Error Handling Could Be More User-Friendly
Location: hooks/use-professionals-query.ts:167

Errors are set as raw strings. Consider a structured error type with user-friendly messages and error codes for better debugging.

Security Considerations
8. SSRF Risk in WebSearch ⚠️
Location: Context indicates WebSearch tool is available

If users can input arbitrary location strings that are then used in API calls, ensure proper validation to prevent SSRF attacks.

9. Array Filter Injection
Location: supabase/migrations/052_fix_professional_filters.sql:96-105

The RPC function uses && operator for array filtering. While Supabase should handle this safely, verify that UUID validation is happening before the query to prevent any injection via category/service filters.

Verification needed: Check if service_filters and category_filters parameters are properly validated as UUID[] at the boundary.

