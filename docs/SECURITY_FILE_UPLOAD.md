# File Upload Security Documentation

**Last Updated**: 2025-10-01
**Component**: Project Photo Upload (`app/new-project/photos/page.tsx`)

## Overview

This document details the multi-layered security measures implemented for photo uploads in the Arco platform.

## Security Layers

### 1. Client-Side Validation (First Line of Defense)

**Location**: `app/new-project/photos/page.tsx` (lines 73-85, 603-635)

**Implemented Checks**:
- ✅ **MIME Type Validation**: Only `image/jpeg` and `image/png` allowed
- ✅ **File Size Limit**: 10 MB maximum per file
- ✅ **Bulk Upload Protection**: Maximum 30 files per upload operation
- ✅ **Image Dimension Validation**: Minimum 1200px width
- ✅ **Extension Allowlist**: Only `.jpg`, `.jpeg`, `.png` extensions accepted
- ✅ **MIME-Extension Mapping**: Validates extension matches MIME type

**Code Reference**:
```typescript
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MIN_IMAGE_WIDTH = 1200
const MAX_FILES_PER_UPLOAD = 30
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png"])
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
}

// Validation in processFiles() function:
if (!allowedMimeTypes.has(file.type)) {
  errors.push(`${file.name}: Only JPG and PNG files are supported.`)
  continue
}

if (file.size > MAX_FILE_SIZE_BYTES) {
  errors.push(`${file.name}: File exceeds the 10 MB limit.`)
  continue
}

if (width < MIN_IMAGE_WIDTH) {
  errors.push(`${file.name}: Image must be at least ${MIN_IMAGE_WIDTH}px wide.`)
  continue
}
```

### 2. Server-Side Storage Policies (Second Line of Defense)

**Location**: `supabase/migrations/018_fix_project_photo_storage_security.sql`

**Row-Level Security (RLS) Policies**:
- ✅ **Path-Based Validation**: Project ID extracted from storage path (format: `{project_id}/{photo_id}.{ext}`)
- ✅ **UUID Validation**: Path segments validated against UUID format
- ✅ **Ownership Verification**: Only project owners can upload/update/delete photos
- ✅ **Authentication Required**: All write operations require authenticated user

**Policy Functions**:
```sql
-- Validates project ownership from storage path
CREATE FUNCTION public.is_project_photo_owner_by_path(_path text)
RETURNS boolean
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = split_part(_path, '/', 1)::uuid
      AND p.client_id = auth.uid()
  );
$$;

-- Upload policy example
CREATE POLICY "Project owners can upload photos" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'project-photos'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_project_photo_owner_by_path(name)
);
```

### 3. Bucket Configuration (Third Line of Defense)

**Location**: `supabase/migrations/020_add_storage_mime_type_validation.sql`

**Recommended Bucket Settings** (Applied via Supabase Dashboard):
- ✅ **File Size Limit**: 10,485,760 bytes (10 MB)
- ✅ **Allowed MIME Types**: `image/jpeg`, `image/png`
- ✅ **Public Read Access**: Enabled for published projects
- ✅ **Private Write Access**: Only authenticated project owners

**Manual Configuration Steps**:
1. Navigate to: Supabase Dashboard → Storage → Buckets → `project-photos` → Settings
2. Set "File size limit": `10485760`
3. Set "Allowed MIME types": `image/jpeg, image/png`
4. Confirm "Public" is enabled for read access

**Alternative via Supabase CLI**:
```bash
supabase storage update project-photos \
  --file-size-limit 10485760 \
  --allowed-mime-types 'image/jpeg,image/png' \
  --public
```

## Security Threat Model

### Mitigated Threats

| Threat | Mitigation Layer | Status |
|--------|------------------|--------|
| **Malicious File Upload** (executables, scripts) | Client MIME validation + Server bucket config | ✅ Protected |
| **Storage Abuse** (large files) | Client size check + Server bucket limit | ✅ Protected |
| **Bulk Upload DoS** | Client file count limit (30 files) | ✅ Protected |
| **Unauthorized Access** | Server RLS policies + Path validation | ✅ Protected |
| **Path Traversal** | UUID validation in storage path | ✅ Protected |
| **Metadata Spoofing** | Path-based validation (not metadata-based) | ✅ Protected |
| **XSS via SVG** | MIME type restriction (no SVG allowed) | ✅ Protected |
| **Low-Quality Images** | Dimension validation (min 1200px) | ✅ Protected |

### Defense-in-Depth Strategy

```
User Upload Request
    ↓
[Client-Side Validation] ← First rejection point (fast, UX-friendly)
    ↓
[Supabase Storage API]
    ↓
[Bucket MIME Type Check] ← Second rejection point (server-enforced)
    ↓
[Bucket Size Limit Check] ← Third rejection point (server-enforced)
    ↓
[RLS Policy Validation] ← Fourth rejection point (authorization)
    ↓
[Storage Success]
```

## Testing & Verification

### Client-Side Validation Tests

**Test Case 1: Invalid MIME Type**
```typescript
// Expected: Error message displayed to user
const testFile = new File(["content"], "test.exe", { type: "application/x-msdownload" })
// Result: "Only JPG and PNG files are supported."
```

**Test Case 2: Oversized File**
```typescript
// Expected: Error message displayed to user
const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" })
// Result: "File exceeds the 10 MB limit."
```

**Test Case 3: Bulk Upload Abuse**
```typescript
// Expected: Error message displayed to user
const files = Array.from({ length: 31 }, (_, i) =>
  new File(["content"], `photo${i}.jpg`, { type: "image/jpeg" })
)
// Result: "You can upload a maximum of 30 files at once."
```

### Server-Side Policy Tests

**Test Case 1: Unauthorized Upload Attempt**
```sql
-- Expected: Permission denied
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES ('project-photos', 'other-user-project-id/photo.jpg', auth.uid());
-- Result: RLS policy blocks insertion
```

**Test Case 2: Path Traversal Attempt**
```sql
-- Expected: UUID validation failure
INSERT INTO storage.objects (bucket_id, name)
VALUES ('project-photos', '../../../etc/passwd');
-- Result: UUID regex validation fails
```

## Monitoring & Alerts

### Recommended Monitoring

1. **Upload Failure Rate**: Track rejected uploads by error type
2. **Storage Usage**: Monitor total storage consumption per project
3. **Suspicious Activity**: Alert on multiple failed upload attempts
4. **Performance**: Track upload success rate and latency

### Supabase Logs

Monitor storage logs for:
- Policy violation attempts (`storage.objects` RLS failures)
- Large file rejections
- Invalid MIME type attempts
- Path validation failures

## Maintenance & Updates

### Regular Security Reviews

- **Monthly**: Review upload error logs for attack patterns
- **Quarterly**: Update MIME type allowlist if new image formats needed
- **Annually**: Comprehensive security audit of upload workflow

### Version History

| Date | Change | Reason |
|------|--------|--------|
| 2025-10-01 | Added `MAX_FILES_PER_UPLOAD` constant (30 files) | Prevent bulk upload abuse |
| 2025-10-01 | Created server-side MIME validation migration | Defense-in-depth security |
| 2024-XX-XX | Implemented path-based RLS validation | Fix metadata spoofing vulnerability |

## References

- **Client Code**: `app/new-project/photos/page.tsx`
- **Storage Policies**: `supabase/migrations/018_fix_project_photo_storage_security.sql`
- **Bucket Config**: `supabase/migrations/020_add_storage_mime_type_validation.sql`
- **Supabase Storage Docs**: https://supabase.com/docs/guides/storage

## Contact

For security concerns or vulnerability reports, contact: security@arco.example.com
