# Security Verification: update_company_services RPC

## Issue Description
**Location:** `app/dashboard/company/actions.ts:445-446`

The concern was that an attacker could bypass the Next.js server action's `getCompanyContext()` check by calling the Supabase RPC function `update_company_services` directly via browser console or API.

## Mitigation Applied (Migration 088)

The `update_company_services` RPC function now has **server-side authorization checks** that cannot be bypassed:

```sql
CREATE OR REPLACE FUNCTION public.update_company_services(
  p_company_id UUID,
  ...
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_owner_id UUID;
BEGIN
  -- 1. Get the current authenticated user's ID from JWT
  v_user_id := auth.uid();

  -- 2. Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 3. Get the company's owner_id from the database
  SELECT owner_id INTO v_owner_id
  FROM public.companies
  WHERE id = p_company_id;

  -- 4. Check if company exists
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  -- 5. Verify the user owns this company
  IF v_owner_id != v_user_id THEN
    RAISE EXCEPTION 'Access denied: You do not own this company';
  END IF;

  -- 6. Only reaches here if authorized
  UPDATE public.companies
  SET ...
  WHERE id = p_company_id;
END;
$$;
```

## Attack Scenarios Prevented

### ❌ Scenario 1: Direct Browser Console Attack
```javascript
// Attacker tries to update someone else's company via browser console
const { data, error } = await supabase.rpc('update_company_services', {
  p_company_id: 'victim-company-uuid',  // Someone else's company
  p_services_offered: ['malicious', 'data'],
  // ...
})

// Result: ERROR
// "Access denied: You do not own this company"
```

### ❌ Scenario 2: Direct API Call via curl
```bash
curl -X POST 'https://your-project.supabase.co/rest/v1/rpc/update_company_services' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "p_company_id": "victim-company-uuid",
    "p_services_offered": ["malicious", "data"]
  }'

# Result: HTTP 500
# {"message": "Access denied: You do not own this company"}
```

### ❌ Scenario 3: Modified Client Code
Even if an attacker modifies the Next.js server action code locally to bypass `getCompanyContext()`, the database-level check still prevents unauthorized access.

## How the Defense Works

1. **JWT-Based Authentication**: `auth.uid()` extracts the user ID from the JWT token in the request
2. **Database-Level Verification**: The function queries the `companies` table to get the actual `owner_id`
3. **Comparison Check**: Only if `auth.uid()` matches `owner_id` does the update proceed
4. **SECURITY DEFINER**: Even though the function runs with elevated privileges, it explicitly checks authorization

## Defense in Depth

| Layer | Protection | Status |
|-------|------------|--------|
| Client-side check | `getCompanyContext()` in server action | ✅ Present |
| Database RPC | Ownership verification in SQL function | ✅ Added (Migration 088) |
| Row Level Security | RLS policies on companies table | ✅ Enabled (Migration 007) |

## Verification

To verify the fix is working:

```sql
-- Check function has authorization logic
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'update_company_services';

-- Should contain:
-- "IF v_owner_id != v_user_id THEN"
-- "RAISE EXCEPTION 'Access denied: You do not own this company'"
```

## Conclusion

**Status:** ✅ **SECURE**

The RPC function `update_company_services` now enforces server-side authorization that **cannot be bypassed** by:
- Browser console manipulation
- Direct API calls
- Modified client code
- Any other client-side attack vector

The `getCompanyContext()` check in the server action remains as a first line of defense, but the database-level check ensures security even if that layer is bypassed.

---

**Fixed in:** Migration 088 (`088_fix_update_company_services_authorization.sql`)
**Applied:** ✅ Verified in production database
**Severity:** 🟢 Mitigated (was 🔴 HIGH)
