# Photo State Reducer Migration Guide

## Problem Statement

The original `page.tsx` had **20+ useState hooks** causing:
- High re-render frequency (every state change triggers render)
- Difficult to reason about state transitions
- Race conditions between states (e.g., `uploadProgress` vs `isUploading`)
- Complex state interdependencies

## Solution: useReducer Pattern

Consolidated all state into a single reducer with:
- **Single source of truth** for all photo tour state
- **Atomic state updates** preventing race conditions
- **Predictable state transitions** through action types
- **Better performance** with fewer re-renders

## Migration Steps

### Step 1: Replace useState with useReducer

**Before:**
```typescript
const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([])
const [dragOver, setDragOver] = useState(false)
const [isUploading, setIsUploading] = useState(false)
// ... 17+ more useState calls
```

**After:**
```typescript
import { useReducer } from "react"
import { photoReducer, initialPhotoState, type PhotoAction } from "./photo-state-reducer"

const [state, dispatch] = useReducer(photoReducer, initialPhotoState)
```

### Step 2: Update State Setters to Dispatch Actions

**Before:**
```typescript
setDragOver(true)
setUploadedPhotos([...uploadedPhotos, newPhoto])
setIsUploading(false)
```

**After:**
```typescript
dispatch({ type: "SET_DRAG_OVER", value: true })
dispatch({ type: "ADD_UPLOADED_PHOTOS", photos: [newPhoto] })
dispatch({ type: "SET_UPLOADING", value: false })
```

### Step 3: Update State Readers

**Before:**
```typescript
if (uploadedPhotos.length > 0) { ... }
const isBusy = isUploading || isSavingFeatures
```

**After:**
```typescript
if (state.uploadedPhotos.length > 0) { ... }
const isBusy = state.isUploading || state.isSavingFeatures
```

### Step 4: Use Batch Updates for Multiple Changes

**Before:**
```typescript
setProjectId(projectIdFromParams)
setFeatureIdMap(idMap)
setFeatureMetadata(metadata)
setSelectedFeatures([BUILDING_FEATURE_ID, ...Array.from(taxonomySelection)])
setUploadedPhotos(normaliseCoverFlag(nextUploadedPhotos))
setFeaturePhotos(nextFeaturePhotos)
setFeatureCoverPhotos(nextFeatureCoverPhotos)
```

**After:**
```typescript
dispatch({
  type: "LOAD_PROJECT_SUCCESS",
  payload: {
    projectId: projectIdFromParams,
    featureIdMap: idMap,
    featureMetadata: metadata,
    selectedFeatures: [BUILDING_FEATURE_ID, ...Array.from(taxonomySelection)],
    uploadedPhotos: nextUploadedPhotos,
    featurePhotos: nextFeaturePhotos,
    featureCoverPhotos: nextFeatureCoverPhotos,
  }
})
```

## Action Types Reference

### Step Navigation
- `SET_STEP` - Set specific step
- `NEXT_STEP` - Advance to next step
- `PREV_STEP` - Go back to previous step

### Photo Operations
- `SET_UPLOADED_PHOTOS` - Replace all photos
- `ADD_UPLOADED_PHOTOS` - Add new photos
- `REMOVE_PHOTO` - Delete a photo
- `SET_COVER_PHOTO` - Set cover photo
- `REORDER_PHOTOS` - Drag and drop reorder

### UI State
- `SET_DRAG_OVER` - Drag over main area
- `SET_MODAL_DRAG_OVER` - Drag over modal
- `SET_OPEN_MENU_ID` - Open dropdown menu
- `TOGGLE_ADD_MENU` - Toggle add button menu
- `OPEN_PHOTO_SELECTOR` - Open photo selector modal
- `CLOSE_PHOTO_SELECTOR` - Close photo selector modal
- `OPEN_ADD_FEATURE_MODAL` - Open add feature modal
- `CLOSE_ADD_FEATURE_MODAL` - Close add feature modal

### Feature Operations
- `SET_SELECTED_FEATURES` - Replace selected features
- `ADD_FEATURES` - Add new features
- `REMOVE_FEATURE` - Remove a feature
- `SET_FEATURE_PHOTOS` - Set photos for a feature
- `UPDATE_FEATURE_PHOTOS` - Batch update feature photos
- `SET_FEATURE_COVER_PHOTO` - Set feature cover photo
- `UPDATE_FEATURE_COVER_PHOTOS` - Batch update covers

### Loading States
- `SET_UPLOADING` - Upload in progress
- `SET_LOADING_FEATURES` - Loading feature options
- `SET_LOADING_PROJECT` - Loading project data
- `SET_SAVING_FEATURES` - Saving features
- `SET_SAVING_SELECTION` - Saving photo selection

### Error Management
- `SET_UPLOAD_ERRORS` - Replace upload errors
- `APPEND_UPLOAD_ERROR` - Add single error
- `SET_MODAL_UPLOAD_ERRORS` - Modal upload errors
- `SET_FEATURE_ERROR` - Feature loading error
- `SET_PROJECT_LOAD_ERROR` - Project loading error
- `SET_FEATURE_MUTATION_ERROR` - Feature mutation error

### Batch Operations
- `BATCH_UPDATE` - Update multiple state fields at once
- `LOAD_PROJECT_SUCCESS` - Load entire project state atomically

## Benefits

### Performance
- **Fewer re-renders**: Single state object reduces render triggers
- **Atomic updates**: Batch updates prevent intermediate states
- **Predictable timing**: No race conditions between state setters

### Maintainability
- **Centralized logic**: All state transitions in one place
- **Type safety**: TypeScript enforces valid actions
- **Testability**: Reducer is pure function, easy to test
- **Debugging**: Actions provide clear audit trail

### Developer Experience
- **Clear intent**: Action names document what's happening
- **Easier refactoring**: Change reducer logic without touching components
- **Better IDE support**: IntelliSense for action types
- **Simplified debugging**: Redux DevTools compatible

## Testing Example

```typescript
import { photoReducer, initialPhotoState } from "./photo-state-reducer"

test("SET_COVER_PHOTO marks correct photo as cover", () => {
  const stateWithPhotos = {
    ...initialPhotoState,
    uploadedPhotos: [
      { id: "1", url: "a.jpg", isCover: true, storagePath: null },
      { id: "2", url: "b.jpg", isCover: false, storagePath: null },
    ]
  }

  const newState = photoReducer(stateWithPhotos, {
    type: "SET_COVER_PHOTO",
    photoId: "2"
  })

  expect(newState.uploadedPhotos[0].isCover).toBe(false)
  expect(newState.uploadedPhotos[1].isCover).toBe(true)
})
```

## Migration Checklist

- [x] Create reducer file with state types
- [x] Define all action types
- [x] Implement reducer logic with normalization
- [ ] Update page.tsx to use useReducer
- [ ] Replace all useState calls with state reads
- [ ] Replace all setState calls with dispatch actions
- [ ] Update all state readers (add `state.` prefix)
- [ ] Batch multi-step state updates
- [ ] Test all user interactions
- [ ] Verify no regression in functionality

## Next Steps

1. Apply the reducer to `page.tsx`
2. Run full QA testing
3. Monitor for race conditions (should be eliminated)
4. Consider adding Redux DevTools for debugging
