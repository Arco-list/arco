# Security Documentation

## Overview

This document outlines the security measures implemented for the /dashboard/company page and file uploads.

## Security Measures Implemented

### 1. Authentication & Authorization

**Page Level Protection:**
- ✅ Server-side authentication check via `supabase.auth.getUser()`
- ✅ Automatic redirect to login for unauthenticated users
- ✅ Company ownership verification (`owner_id` filter)
- ✅ Prevents unauthorized access to other companies' data

**Server Actions Protection:**
- ✅ Every action validates user authentication via `getCompanyContext()`
- ✅ Company ownership verified on every mutation
- ✅ Early return with errors if auth fails

### 2. Row Level Security (RLS)

**Companies Table:**
- Public read access for company discovery
- Owner-only insert/update/delete operations

**Company Photos Table:**
- All CRUD operations restricted to company owner via EXISTS subquery
- Prevents photo manipulation across companies

**Company Social Links Table:**
- All CRUD operations restricted to company owner via EXISTS subquery
- Prevents social link manipulation across companies

### 3. Storage Security

**Bucket Configuration:**
- ✅ File size limit: 5MB per file
- ✅ Allowed MIME types: image/jpeg, image/png, image/svg+xml
- ✅ Public read access (photos are meant to be visible)

**Storage RLS Policies:**
- ✅ Authenticated uploads only to owned company folders
- ✅ Owner-only delete and update permissions
- ✅ Public read access for all company assets

**File Path Structure:**
```
company-assets/
  {company_id}/
    logo/
      {timestamp}-{sanitized-filename}
    photos/
      {uuid}-{sanitized-filename}
```

### 4. File Upload Security

**Input Validation:**
- ✅ File type whitelist (JPG, PNG, SVG only)
- ✅ File size limit (5MB max)
- ✅ Filename sanitization (removes special characters)
- ✅ SVG content sanitization with DOMPurify

**SVG Sanitization:**
```typescript
// Sanitize SVG files to prevent XSS attacks
const sanitizedSvg = DOMPurify.sanitize(svgContent, {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ["use"],
  ADD_ATTR: ["target"],
})
```

**Photo Limits:**
- Maximum 5 photos per company
- Enforced server-side via count check

### 5. Rate Limiting

**Implementation:**
- Uses Upstash Redis for distributed rate limiting
- 10 uploads per minute per user
- Separate limits for logo and photo uploads
- Gracefully degrades if Redis not configured

**Configuration:**
```env
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

**Rate Limit Behavior:**
- When limit exceeded: Returns error "Too many upload attempts. Please try again later."
- Sliding window algorithm (10 requests per 60 seconds)
- Per-user tracking prevents abuse

### 6. SQL Injection Protection

- ✅ All queries use Supabase client parameterization
- ✅ Zod schemas validate all input types
- ✅ UUID validation for all ID parameters
- ✅ No raw SQL or string interpolation

### 7. XSS Protection

- ✅ User inputs validated via Zod schemas
- ✅ Next.js auto-escapes JSX output
- ✅ URL validation prevents javascript: protocols
- ✅ SVG sanitization removes malicious scripts

### 8. Race Condition Prevention

**Atomic Photo Reordering:**
```sql
-- Database function for atomic updates
CREATE FUNCTION reorder_company_photos(
  photo_ids uuid[],
  company_id_param uuid
)
```

- ✅ Single database function call
- ✅ Transactional updates
- ✅ Validates photo ownership before reordering

## Security Best Practices

### For Developers

1. **Never bypass authentication checks** - Always use `getCompanyContext()` in server actions
2. **Validate all inputs** - Use Zod schemas for type safety
3. **Use service role client sparingly** - Only for operations that require elevated permissions
4. **Test RLS policies** - Verify users can only access their own data
5. **Monitor rate limits** - Check Upstash dashboard for abuse patterns

### For Deployment

1. **Environment Variables:**
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is properly set
   - Configure `UPSTASH_REDIS_REST_URL` and token for rate limiting
   - Never commit `.env.local` to version control

2. **Storage Bucket:**
   - Verify RLS policies are active on `storage.objects`
   - Confirm file size and MIME type restrictions
   - Monitor storage usage for abuse

3. **Database:**
   - Ensure all RLS policies are enabled
   - Run `SELECT * FROM pg_policies` to verify policies
   - Monitor for failed authentication attempts

## Security Monitoring

### Recommended Monitoring

1. **Upload Patterns:**
   - Track upload success/failure rates
   - Monitor unusual upload spikes
   - Alert on rate limit violations

2. **Authentication:**
   - Log failed authentication attempts
   - Monitor for brute force patterns
   - Track unauthorized access attempts

3. **Storage:**
   - Monitor storage bucket size growth
   - Alert on unusual file uploads
   - Track bandwidth usage

### Logging

All security-relevant events are logged via the logger utility:
- Authentication failures
- Upload failures
- Rate limit violations
- RLS policy violations

## Incident Response

### If Suspicious Activity Detected

1. **Immediate Actions:**
   - Review audit logs for affected user
   - Check for unauthorized data access
   - Verify RLS policies are active

2. **Investigation:**
   - Identify attack vector
   - Assess data exposure
   - Document findings

3. **Remediation:**
   - Revoke compromised tokens
   - Patch vulnerabilities
   - Notify affected users if data exposed

## Security Updates

Last Updated: 2025-10-03
Last Security Review: 2025-10-03

### Recent Changes
- Added SVG sanitization (2025-10-03)
- Implemented rate limiting (2025-10-03)
- Added storage bucket restrictions (2025-10-03)
- Implemented atomic photo reordering (2025-10-03)
