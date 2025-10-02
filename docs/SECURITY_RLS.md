# Row-Level Security (RLS) Best Practices

**Created:** 2025-10-01
**Purpose:** Comprehensive guide to implementing and validating Row-Level Security in Supabase
**Security Level:** CRITICAL

## Table of Contents

1. [Overview](#overview)
2. [Core Principles](#core-principles)
3. [Implementation Guide](#implementation-guide)
4. [Validation & Testing](#validation--testing)
5. [Common Vulnerabilities](#common-vulnerabilities)
6. [Monitoring & Auditing](#monitoring--auditing)

---

## Overview

Row-Level Security (RLS) is the **primary security mechanism** for protecting data in Supabase. It enforces access control at the database level, preventing unauthorized access even if application-level checks fail.

### Why RLS is Critical

❌ **Without RLS:**
```typescript
// Application assumes this filters correctly
const { data } = await supabase
  .from("projects")
  .select("*")
  .eq("client_id", userId)  // ← Can be bypassed!
```

✅ **With RLS:**
```sql
-- Database enforces this automatically
CREATE POLICY "users_own_projects" ON projects
  FOR SELECT
  USING (auth.uid() = client_id);
```

Even if the application forgets `.eq("client_id", userId)`, RLS ensures users only see their own data.

---

## Core Principles

### 1. Defense in Depth

**Never trust client-side filtering alone**

```typescript
// ❌ BAD: Relies solely on application logic
const { data } = await supabase
  .from("projects")
  .select("*")
  .eq("client_id", userId)

// ✅ GOOD: RLS enforces at database level + application validates
const { data } = await supabase
  .from("projects")
  .select("*")
  .eq("client_id", userId)  // Application-level filter (belt)
  // + RLS policy (suspenders)
```

### 2. Fail Secure

**Block access if RLS validation fails**

```typescript
const { isSecure, errors } = useRLSValidation()

if (!isSecure && !loading) {
  // Fail secure: Show error, don't show data
  return <SecurityError errors={errors} />
}
```

### 3. Zero Trust

**Validate every query, every time**

```typescript
// ❌ BAD: Assumes RLS is configured
await supabase.from("projects").select("*")

// ✅ GOOD: Validates RLS before critical operations
const validation = await validateProjectRLS(supabase, userId)
if (!validation.isValid) {
  throw new SecurityError("RLS validation failed")
}
```

### 4. Audit Trail

**Log all security validation failures**

```typescript
if (!isRLSSecure) {
  logRLSFailures(results, {
    userId: authData.user.id,
    page: "dashboard/listings",
  })
}
```

---

## Implementation Guide

### Step 1: Enable RLS on Tables

```sql
-- Enable RLS on critical tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

### Step 2: Create RLS Policies

#### SELECT Policies (Read Access)

```sql
-- Users can read their own projects
CREATE POLICY "users_read_own_projects" ON projects
  FOR SELECT
  USING (auth.uid() = client_id);

-- Users can read published projects (public access)
CREATE POLICY "anyone_read_published_projects" ON projects
  FOR SELECT
  USING (status = 'published');
```

#### INSERT Policies (Create Access)

```sql
-- Users can create projects for themselves
CREATE POLICY "users_create_own_projects" ON projects
  FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- Users can upload photos to their own projects
CREATE POLICY "users_upload_to_own_projects" ON project_photos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_photos.project_id
        AND projects.client_id = auth.uid()
    )
  );
```

#### UPDATE Policies (Modify Access)

```sql
-- Users can update their own projects
CREATE POLICY "users_update_own_projects" ON projects
  FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- Users can update their own profile
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

#### DELETE Policies (Remove Access)

```sql
-- Users can delete their own projects
CREATE POLICY "users_delete_own_projects" ON projects
  FOR DELETE
  USING (auth.uid() = client_id);

-- Users can delete photos from their own projects
CREATE POLICY "users_delete_own_photos" ON project_photos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_photos.project_id
        AND projects.client_id = auth.uid()
    )
  );
```

### Step 3: Implement Runtime Validation

```typescript
import { useRLSValidation } from "@/hooks/useRLSValidation"

export default function DashboardListingsPage() {
  // Validate RLS on page load
  const { isSecure, errors, loading } = useRLSValidation({
    enabled: true,
    page: "dashboard/listings",
  })

  // Show security warning if RLS fails
  if (!loading && !isSecure) {
    return (
      <SecurityWarning
        errors={errors}
        message="RLS policies are not correctly configured"
      />
    )
  }

  // Proceed with normal page rendering
  return <DashboardContent />
}
```

### Step 4: Test RLS Policies

```typescript
// Test that users can only access their own projects
test("RLS prevents unauthorized project access", async () => {
  const validation = await validateProjectRLS(supabase, userId)

  expect(validation.isValid).toBe(true)
  expect(validation.error).toBeUndefined()
})
```

---

## Validation & Testing

### Automated RLS Validation

Use the provided validation utilities to test RLS policies:

```typescript
import { runRLSValidationSuite, isRLSSecure } from "@/lib/supabase/rls-validator"

// Run comprehensive validation
const results = await runRLSValidationSuite(supabase, userId)

// Check if all policies pass
const secure = isRLSSecure(results)

// Get security recommendations
const errors = getRLSSecurityErrors(results)
```

### Manual Testing Checklist

- [ ] **Test SELECT policies**: Can users read only their own data?
- [ ] **Test INSERT policies**: Can users create data for themselves only?
- [ ] **Test UPDATE policies**: Can users modify only their own data?
- [ ] **Test DELETE policies**: Can users delete only their own data?
- [ ] **Test cross-user access**: Attempt to access another user's data (should fail)
- [ ] **Test unauthenticated access**: Attempt operations without auth (should fail for protected tables)

### SQL Testing Queries

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'project_photos', 'profiles');

-- List all RLS policies
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test as specific user (replace USER_UUID)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"USER_UUID"}';

SELECT * FROM projects;  -- Should only show user's projects
```

---

## Common Vulnerabilities

### 1. Missing RLS Policies

**Vulnerability:**
```sql
-- Table has RLS enabled but NO policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ← No policies created! Users can't access anything.
```

**Fix:**
```sql
-- Add appropriate policies
CREATE POLICY "users_read_own_projects" ON projects
  FOR SELECT
  USING (auth.uid() = client_id);
```

### 2. Overly Permissive Policies

**Vulnerability:**
```sql
-- ❌ Allows ALL users to read ALL projects
CREATE POLICY "allow_all" ON projects
  FOR SELECT
  USING (true);
```

**Fix:**
```sql
-- ✅ Restrict to owner OR published projects
CREATE POLICY "read_own_or_published" ON projects
  FOR SELECT
  USING (
    auth.uid() = client_id
    OR status = 'published'
  );
```

### 3. Missing WITH CHECK Clauses

**Vulnerability:**
```sql
-- ❌ Users can update, but might change ownership
CREATE POLICY "update_projects" ON projects
  FOR UPDATE
  USING (auth.uid() = client_id);
  -- Missing WITH CHECK!
```

**Fix:**
```sql
-- ✅ Prevents changing client_id
CREATE POLICY "update_own_projects" ON projects
  FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);
```

### 4. Application Logic Bypass

**Vulnerability:**
```typescript
// ❌ Application assumes RLS is working
const { data } = await supabase
  .from("projects")
  .select("*")
// No .eq("client_id", userId)
// Relies entirely on RLS
```

**Fix:**
```typescript
// ✅ Defense in depth: Filter + RLS
const { data } = await supabase
  .from("projects")
  .select("*")
  .eq("client_id", userId)  // Application filter
// + RLS policy enforces at DB level
```

### 5. Service Role Key Misuse

**Vulnerability:**
```typescript
// ❌ Using service_role bypasses ALL RLS!
const adminClient = createClient(url, SERVICE_ROLE_KEY)
const { data } = await adminClient
  .from("projects")
  .select("*")
// Returns ALL projects, ignoring RLS
```

**Fix:**
```typescript
// ✅ Use anon/authenticated keys for user operations
const userClient = createClient(url, ANON_KEY)

// Only use service_role for admin operations
// that explicitly need to bypass RLS
```

---

## Monitoring & Auditing

### Security Event Logging

```typescript
// Log RLS validation failures
logRLSFailures(results, {
  userId: authData.user.id,
  page: "dashboard/listings",
})

// Production: Send to security monitoring
if (process.env.NODE_ENV === "production") {
  Sentry.captureException(new Error("RLS_VALIDATION_FAILURE"), {
    extra: {
      userId,
      page,
      failures,
    },
  })
}
```

### Metrics to Track

1. **RLS Validation Failures**: Count of failed validations per page
2. **Unauthorized Access Attempts**: Users attempting to access others' data
3. **Policy Enforcement Time**: Performance impact of RLS policies
4. **Missing Policies**: Tables with RLS enabled but no policies

### Alerting Thresholds

- **CRITICAL**: RLS validation failure rate > 1%
- **HIGH**: Unauthorized access attempts > 10/hour
- **MEDIUM**: Policy enforcement time > 100ms
- **LOW**: Missing policies on non-critical tables

---

## Quick Reference

### Enable RLS on a Table

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

### Create Basic SELECT Policy

```sql
CREATE POLICY "policy_name" ON table_name
  FOR SELECT
  USING (auth.uid() = user_id);
```

### Validate RLS in React Component

```typescript
const { isSecure, errors } = useRLSValidation()

if (!isSecure) {
  return <SecurityError errors={errors} />
}
```

### Check RLS Status

```sql
SELECT check_rls_enabled('table_name');
```

---

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Reference](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

---

## Security Contacts

- **Security Issues**: [Report here](https://github.com/tinkso0/arco/security)
- **Urgent Security Concerns**: Contact admin team immediately
