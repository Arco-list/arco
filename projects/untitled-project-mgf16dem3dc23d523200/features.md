# Project Detail — Features Requirements

**Source:** `arco_prd_updated.md` (Project Detail, Features-related bullet points)  
**Checked:** 2025-02-15

## Highlights Cards
- Display each highlighted building feature as a card with image, feature name, and description.
- Clicking a highlight card opens the Images Overview modal and auto-scrolls to the corresponding feature grouping.
- Feature tagline (authored in the Room Editor) should appear beneath the feature title on the card.
- Only features explicitly marked as "Highlight" in the authoring flow surface here.

## Features Metadata Block
- Render a metadata list of every building feature with its associated icon.
- Tapping a feature in the list opens the Images Overview modal scoped to that feature.
- Hide features that have zero associated photos; they should not appear in either Highlights or the metadata list.

## Images Overview & Detail Interop
- Images Overview modal groups photos by building feature, showing the feature name and description when photos exist.
- Clicking any image (from hero or within grouped sections) or the "View all photos (N)" CTA opens the modal.
- Selecting a highlight or metadata feature deep links the modal to that feature section.
- Image Detail modal inherits navigation (next/prev, keyboard arrows, swipe) and close behaviors from the overview.

## Authoring Dependencies
- Room Editor allows authors to maintain a tagline per feature (displayed on Highlights) and toggle whether a feature is highlighted.
- Feature cards in the Photo Tour list surface photo counts or an "Add photos" affordance; features with fewer than one photo stay excluded from public Highlights/Features.
- "Building" feature acts as the catch-all group for unassigned photos when the project type is House.
