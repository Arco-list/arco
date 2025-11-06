# Button Size Jump Fixes

## Issue
Buttons that change `variant` on state change (like Save/Like) were jumping in size because different variants have different font sizes:
- Tertiary: 14px font
- Primary (default): 16px font

## Files Fixed

### ✅ components/professional-action-buttons.tsx
**Before:**
```tsx
<Button
  variant={isSaved ? "default" : "tertiary"}  // Changes font size!
  size="tertiary"
/>
```

**After:**
```tsx
<Button
  variant="tertiary"
  size="tertiary"
  className={isSaved ? "bg-primary text-primary-foreground hover:bg-primary-hover" : ""}
/>
```

### ✅ components/project-action-buttons.tsx
Fixed both Like and Save buttons using the same approach.

## Result
- ✅ Buttons stay the same size
- ✅ Only background color changes (tertiary gray → primary red)
- ✅ No layout shift when toggling save/like state
- ✅ Icons fill state still works

## Cards (No Action Needed)
- `professional-card.tsx` - Uses native button with icon color change only
- `project-card.tsx` - Uses native button with icon color change only

These are already correct - they don't use Button component and only change icon color.
