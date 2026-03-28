# Error Handling Strategy - Photo Upload Page

This document explains the intentional error handling patterns in `app/new-project/photos/page.tsx`.

## Error Handling Patterns

### 1. Critical Initialization Errors (THROW)
**Location**: Lines 184-304 - `loadProjectContext()`
**Pattern**: `throw error`
**Behavior**: Component crashes, triggers Error Boundary
**Use Cases**:
- Failed to load project features
- Failed to load project photos
- Failed to create required "Building" or "Additional photos" features

**Rationale**: Without this data, the page cannot function. Better to show error boundary than broken UI.

```typescript
if (featureResponse.error) {
  throw featureResponse.error // Critical - cannot render without features
}
```

---

### 2. Graceful Degradation (SILENT + STATE)
**Location**: Lines 671-674 - Individual file upload failures
**Pattern**: `catch → console.error + append to errors array`
**Behavior**: Component continues, shows error for specific file
**Use Cases**:
- Individual file upload failure
- Image processing error for single photo

**Rationale**: One file failure shouldn't break entire upload flow. User can retry failed files.

```typescript
catch (error) {
  console.error(error)
  errors.push(`${file.name}: We could not process this image.`)
  // Continue processing other files
}
```

---

### 3. Caller-Controlled Success/Failure (RETURN BOOLEAN)
**Location**: Lines 835, 927 - Feature mutations
**Pattern**: `catch → setState + return false`
**Behavior**: Caller receives failure indicator
**Use Cases**:
- `addFeature()` - returns `boolean`
- `removeFeatureById()` - returns `boolean`

**Rationale**: Let caller decide how to handle failure (retry, show different UI, abort operation).

```typescript
catch (error) {
  console.error("Failed to add features", error)
  setFeatureMutationError(/* ... */)
  return false // Caller knows operation failed
}
```

---

### 4. Contextual Modal Errors (STATE ONLY)
**Location**: Lines 1913-1917 - Photo assignment modal
**Pattern**: `catch → setState(modalErrors)`
**Behavior**: Error shows in modal only, main page unaffected
**Use Cases**:
- `saveSelectedPhotos()` - photo feature assignment

**Rationale**: Modal operations are isolated. Errors should display in modal context, not crash page.

```typescript
catch (error) {
  console.error("Failed to save feature photos", error)
  setModalUploadErrors([error.message]) // Shows in modal UI
}
```

---

## Error State Management

### Error States Used

| State Variable | Scope | Display Location |
|----------------|-------|------------------|
| `projectLoadError` | Global page error | Top of page (red banner) |
| `uploadErrors` | Upload-specific errors | Below file picker |
| `featureMutationError` | Feature CRUD errors | Feature management section |
| `modalUploadErrors` | Modal-specific errors | Inside photo selector modal |

### Error Message Guidelines

1. **User-Friendly**: Avoid technical jargon
2. **Actionable**: Include "Please try again" or next steps
3. **Specific**: Identify what failed (e.g., file name, feature name)
4. **Fallback**: Always provide fallback message if error is not `instanceof Error`

```typescript
error instanceof Error
  ? error.message
  : "We couldn't save these photos. Please try again."
```

---

## Future Improvements

### Potential Enhancements

1. **Retry Logic**: Auto-retry transient failures (network, timeout)
2. **Error Boundary**: Add custom Error Boundary for initialization failures
3. **Sentry Integration**: Log errors to monitoring service
4. **Optimistic UI**: Show success immediately, rollback on failure

### Anti-Patterns to Avoid

❌ **Don't**: Use `throw` for recoverable errors
❌ **Don't**: Silently swallow errors without logging
❌ **Don't**: Mix error handling strategies within same function
✅ **Do**: Document why you're using a specific pattern
✅ **Do**: Provide clear user feedback for all error cases
✅ **Do**: Log errors to console for debugging

---

## Testing Error Scenarios

### Manual Testing Checklist

- [ ] Network failure during project load → Shows error boundary
- [ ] Network failure during file upload → Shows upload error, page still works
- [ ] Invalid file format → Shows file-specific error message
- [ ] Feature creation failure → Returns false, shows mutation error
- [ ] Photo assignment failure → Shows modal error, modal stays open
- [ ] Database constraint violation → Appropriate error message shown

---

**Last Updated**: 2025-01-01
**Maintained By**: Development Team
