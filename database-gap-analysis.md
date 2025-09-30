# Database Gap Analysis for Project CRUD Workflows

**Created:** 2025-09-30
**Purpose:** Identify missing database schema elements required for PRD implementation
**Focus:** Project listing wizard and management workflows

---

## ✅ Executive Summary

**Overall Assessment:** Database schema is **75% ready** for project CRUD workflows with several critical gaps.

**Critical Issues:** 8 major gaps
**Medium Issues:** 5 schema enhancements needed
**Minor Issues:** 3 optimization opportunities

**Recommendation:** Implement 3 new tables and 12 new columns before starting project wizard development.

**Key Constraint:** Only professional accounts are allowed to list projects; the Create Company flow must promote homeowners to professionals before exposing the wizard.

---

## 🔴 CRITICAL GAPS - Must Implement

### 1. **Missing: `project_features` Table** ⚠️ BLOCKER

**PRD Requirement:**
- Photos must be grouped by "building features" (e.g., Kitchen, Bathroom, Living Room, Garden)
- Each feature can have:
  - Multiple photos
  - A cover photo
  - A tagline/description
  - A "highlight" flag (for Highlights section on PDP)
  - Custom order for display
- Features without photos are hidden on PDP
- First feature is always "Building" for house projects

**Current Schema:**
- `project_photos` table has no feature/room association
- `projects.features` is just an array of strings (no structure)

**Required Schema:**
```sql
CREATE TABLE project_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id), -- Link to taxonomy for feature types
  name TEXT NOT NULL, -- e.g., "Kitchen", "Master Bathroom"
  tagline TEXT CHECK (tagline IS NULL OR length(tagline) <= 200),
  description TEXT CHECK (description IS NULL OR length(description) <= 500),
  is_highlighted BOOLEAN DEFAULT false, -- Show in Highlights section
  is_building_default BOOLEAN DEFAULT false, -- True for default "Building" feature
  cover_photo_id UUID REFERENCES project_photos(id), -- Primary image for this feature
  order_index INTEGER DEFAULT 0 CHECK (order_index >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_project_features_project_id ON project_features(project_id);
CREATE INDEX idx_project_features_category_id ON project_features(category_id);
```

**Impact:** HIGH - Wizard Photo Tour steps cannot be built without this.

---

### 2. **Missing: `feature_id` Column in `project_photos`** ⚠️ BLOCKER

**PRD Requirement:**
- Photos must be associated with specific features
- Photos can be moved between features
- Photos without features go to "Building" or "Additional photos"

**Required Migration:**
```sql
ALTER TABLE project_photos
ADD COLUMN feature_id UUID REFERENCES project_features(id) ON DELETE SET NULL;

CREATE INDEX idx_project_photos_feature_id ON project_photos(feature_id);

-- Allow NULL for photos not yet assigned to features
COMMENT ON COLUMN project_photos.feature_id IS 'Feature/room this photo belongs to';
```

**Impact:** HIGH - Photo organization workflow cannot function without this.

---

### 3. **Missing: Location Fields in `projects`** ⚠️ CRITICAL

**PRD Requirement:**
- Address autocomplete with Google Places API
- Store lat/lng for map display
- "Share exact location" toggle (controls city-only vs full address display)
- Formatted address string

**Current Schema:**
- Only has `location` TEXT field (too simplistic)

**Required Migration:**
```sql
ALTER TABLE projects
ADD COLUMN address_street TEXT,
ADD COLUMN address_city TEXT,
ADD COLUMN address_region TEXT,
ADD COLUMN address_postal_code TEXT,
ADD COLUMN address_country TEXT DEFAULT 'Netherlands',
ADD COLUMN address_formatted TEXT, -- Full formatted address from Google Places
ADD COLUMN latitude NUMERIC(10, 7),
ADD COLUMN longitude NUMERIC(10, 7),
ADD COLUMN share_exact_location BOOLEAN DEFAULT false; -- Privacy toggle

CREATE INDEX idx_projects_location ON projects USING gist(point(longitude, latitude));

COMMENT ON COLUMN projects.share_exact_location IS 'If false, only show city/region publicly';
```

**Impact:** HIGH - Wizard Step 5 (Location Confirm) and map display blocked.

---

### 4. **Missing: Project Category Field** ⚠️ CRITICAL

**PRD Requirement:**
- Project Category (e.g., "House", "Bed & Bath") is REQUIRED in Wizard Step 1
- Project Type (e.g., "Villa", "Kitchen") filters based on selected Category
- Categories are hierarchical in taxonomy

**Current Schema:**
- `project_categories` junction table exists (good!)
- But no `project_category_id` for the PRIMARY category
- PRD indicates one primary category with possible subcategories

**Required Migration:**
```sql
-- Add primary category to projects table for easy filtering
ALTER TABLE projects
ADD COLUMN primary_category_id UUID REFERENCES categories(id);

CREATE INDEX idx_projects_primary_category ON projects(primary_category_id);

-- Update project_categories to ensure one is marked primary
ALTER TABLE project_categories
ALTER COLUMN is_primary SET DEFAULT false;

COMMENT ON COLUMN projects.primary_category_id IS 'Primary project category - duplicates the primary entry in project_categories for query optimization';
```

**Impact:** MEDIUM-HIGH - Can work around with junction table queries, but impacts performance.

---

### 5. **Missing: Project Style Field** ⚠️ CRITICAL

**PRD Requirement:**
- "Project style" (e.g., "Modern", "Classic", "Contemporary") is REQUIRED in Wizard Step 1
- Single selection, not multi-select
- Currently stored in `style_preferences` array

**Required Migration:**
```sql
ALTER TABLE projects
ADD COLUMN project_style TEXT; -- Single style selection

-- Migrate data if needed
UPDATE projects
SET project_style = style_preferences[1]
WHERE style_preferences IS NOT NULL AND array_length(style_preferences, 1) > 0;

-- Keep style_preferences for backward compatibility or remove later
COMMENT ON COLUMN projects.project_style IS 'Primary architectural/design style';
COMMENT ON COLUMN projects.style_preferences IS 'DEPRECATED - use project_style instead';
```

**Impact:** MEDIUM - Can work around with array, but PRD indicates single selection.

---

### 6. **Missing: `project_professionals` Junction Table** ⚠️ CRITICAL

**PRD Requirement:**
- Homeowners invite professionals by email during wizard (Step 9-10)
- Track invitation status per professional per project
- If email domain matches a company, link to professional account
- Otherwise store email pending account creation
- Professionals can accept, reject, or remove themselves from projects
- Project owner sees statuses: Listing owner, Invite sent, Listed, Unlisted, Removed

**Current Schema:**
- NO table to track professional invitations or associations with projects
- `project_applications` only tracks applications FROM professionals TO projects
- Need reverse: homeowner inviting professionals TO completed projects

**Required Schema (aligns with PRD statuses):**
```sql
CREATE TYPE professional_project_status AS ENUM (
  'invited',        -- Matches PRD "Invited" status
  'listed',         -- Listed on both project page and company page
  'live_on_page',   -- Listed on company page but not project page
  'unlisted',       -- Hidden everywhere
  'rejected',       -- Professional declined
  'removed'         -- Professional removed themselves
);

CREATE TABLE project_professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE, -- NULL if not yet matched
  invited_email TEXT NOT NULL,
  invited_service_category_id UUID REFERENCES categories(id), -- Service they were invited for
  status professional_project_status DEFAULT 'invited',
  is_project_owner BOOLEAN DEFAULT false, -- True for the company that created the listing
  invited_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(project_id, invited_email, invited_service_category_id)
);

CREATE INDEX idx_project_professionals_project ON project_professionals(project_id);
CREATE INDEX idx_project_professionals_professional ON project_professionals(professional_id);
CREATE INDEX idx_project_professionals_email ON project_professionals(invited_email);

COMMENT ON TABLE project_professionals IS 'Professionals invited to or associated with completed projects';
```

**Impact:** HIGH - Wizard Step 9-10 (Professionals) cannot be built without this. Listing creation is restricted to professional accounts, so a homeowner must complete Create Company first.

> **Create Company Flow Dependency:** When a homeowner completes the "Create Company" onboarding, persist the "professional" user type to `profiles.user_types`. Without this flag the UI will keep redirecting them back to `/homeowner`, even if invitations are stored.

---

### 7. **Missing: Listing Status Workflow Fields** ⚠️ MEDIUM-HIGH

**PRD Requirement:**
- Listing statuses: In Progress, In Review, Invited, Live on Page, Listed, Unlisted, Rejected
- Admin rejection notes
- Role tracking (Project Owner vs Contributor)
- Date tracking for status changes

**Current Schema:**
- `projects.status` enum has: draft, published, in_progress, completed, archived
- Missing: in_review, rejected, unlisted, invited

**Required Migration:**
```sql
-- Extend project_status enum
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'unlisted';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'invited';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'listed';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'live_on_page';

-- Add admin review fields
ALTER TABLE projects
ADD COLUMN submitted_for_review_at TIMESTAMPTZ,
ADD COLUMN reviewed_at TIMESTAMPTZ,
ADD COLUMN reviewed_by UUID REFERENCES profiles(id),
ADD COLUMN rejection_reason TEXT CHECK (rejection_reason IS NULL OR length(rejection_reason) <= 1000),
ADD COLUMN admin_notes TEXT CHECK (admin_notes IS NULL OR length(admin_notes) <= 2000);

COMMENT ON COLUMN projects.rejection_reason IS 'Admin explanation for rejection, shown to user';
COMMENT ON COLUMN projects.admin_notes IS 'Internal admin notes, not shown to user';
```

**Impact:** MEDIUM-HIGH - Listing status workflow incomplete without this.

---

### 8. **Missing: Draft/Autosave Fields** ⚠️ MEDIUM

**PRD Requirement:**
- Wizard autosaves every 30 seconds
- Save & Exit creates draft
- User can return to wizard to continue
- Track which wizard step user is on

**Required Migration:**
```sql
ALTER TABLE projects
ADD COLUMN wizard_step INTEGER DEFAULT 1 CHECK (wizard_step >= 1 AND wizard_step <= 11),
ADD COLUMN wizard_completed BOOLEAN DEFAULT false,
ADD COLUMN last_autosave_at TIMESTAMPTZ,
ADD COLUMN draft_data JSONB; -- Store temporary wizard data

CREATE INDEX idx_projects_draft ON projects(client_id, status) WHERE status = 'draft';

COMMENT ON COLUMN projects.wizard_step IS 'Current step in project creation wizard (1-11)';
COMMENT ON COLUMN projects.draft_data IS 'Temporary wizard state for in-progress drafts';
```

**Impact:** MEDIUM - Autosave and wizard resume functionality blocked.

---

## 🟡 MEDIUM PRIORITY - Schema Enhancements

### 9. **Materials Field Structure**

**PRD Requirement:**
- "Location & Materials" step has Material features (checkbox group)
- Currently `projects.features` array is generic

**Recommendation:**
- Either split into `location_features` and `material_features` arrays
- OR use JSONB with structure: `{"location": ["waterfront"], "materials": ["wood", "stone"]}`

**Suggested Migration:**
```sql
ALTER TABLE projects
ADD COLUMN location_features TEXT[],
ADD COLUMN material_features TEXT[];

-- Migrate existing features array to location_features temporarily
UPDATE projects SET location_features = features WHERE features IS NOT NULL;
```

---

### 10. **Project Size as Structured Field**

**PRD Requirement:**
- Size selection from taxonomy or range list
- Currently `projects.project_size` is TEXT (unstructured)

**Recommendation:**
- Keep as TEXT linked to taxonomy, OR
- Add numeric fields for actual dimensions

**Suggested Enhancement:**
```sql
ALTER TABLE projects
ADD COLUMN size_sq_meters NUMERIC,
ADD COLUMN size_sq_feet NUMERIC;
```

---

### 11. **Photo Upload Metadata** _(optional enhancement)_

**PRD Requirement:**
- Drag-and-drop upload with progress
- Minimum 5 photos required
- Track upload status per photo

**Recommendation:** (optional, improves UX but not required for initial launch)
- Add upload tracking fields to `project_photos`

**Suggested Migration:**
```sql
ALTER TABLE project_photos
ADD COLUMN upload_status TEXT DEFAULT 'completed'
  CHECK (upload_status IN ('uploading', 'completed', 'failed')),
ADD COLUMN upload_progress INTEGER DEFAULT 100 CHECK (upload_progress >= 0 AND upload_progress <= 100),
ADD COLUMN thumbnail_url TEXT;
```

---

### 12. **Listing Editor Audit Trail** _(optional enhancement)_

**PRD Requirement:**
- Track who edited what and when
- Version history for admin disputes

**Recommendation:** (optional, supports admin tooling and dispute resolution)
```sql
CREATE TABLE project_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES profiles(id),
  changes JSONB NOT NULL, -- Field-level change tracking
  edit_type TEXT NOT NULL CHECK (edit_type IN ('create', 'update', 'status_change', 'photo_add', 'photo_remove')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 13. **Professional Service Type in Invitations**

**PRD Requirement:**
- When inviting professionals, user selects service type (e.g., Architect, Interior Designer)
- This is already covered in `project_professionals.invited_service_category_id` (see Gap #6)

**Status:** ✅ Addressed in Critical Gap #6

---

## 🟢 MINOR OPTIMIZATIONS

### 14. **Search Performance** _(optional enhancement)_

**Recommendation:**
- Add full-text search indexes for project discovery

```sql
-- Add tsvector column for search
ALTER TABLE projects
ADD COLUMN search_vector tsvector;

-- Create GIN index
CREATE INDEX idx_projects_search ON projects USING GIN(search_vector);

-- Auto-update trigger
CREATE TRIGGER projects_search_update
BEFORE INSERT OR UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(search_vector, 'pg_catalog.english', title, description);
```

---

### 15. **Soft Delete for Photos** _(optional enhancement)_

**Recommendation:**
- Add soft delete instead of hard delete (user can undo)

```sql
ALTER TABLE project_photos
ADD COLUMN deleted_at TIMESTAMPTZ,
ADD COLUMN deleted_by UUID REFERENCES profiles(id);

CREATE INDEX idx_project_photos_active ON project_photos(project_id) WHERE deleted_at IS NULL;
```

---

### 16. **Thumbnail Generation Tracking** _(optional enhancement)_

**Recommendation:**
- Track thumbnail generation status

```sql
ALTER TABLE project_photos
ADD COLUMN thumbnails_generated BOOLEAN DEFAULT false,
ADD COLUMN thumbnail_sizes JSONB; -- Store all generated sizes
```

---

## 📊 Data Model Requirements Summary

### New Tables Required: 3
1. ✅ `project_features` - Photo grouping by rooms/features
2. ✅ `project_professionals` - Professional invitations and associations
3. ⚠️ `project_edit_history` - Audit trail (optional)

### Modified Tables: 2
1. ✅ `projects` - 15+ new columns needed
2. ✅ `project_photos` - 5+ new columns needed

### New Enums: 1
1. ✅ `professional_project_status` - For professional invitation workflow

### Existing Tables That Work (with seeding): 11
- ✅ `profiles` - User data is sufficient (ensure Create Company sets `professional` type)
- ✅ `companies` - Company info sufficient
- ✅ `categories` - Taxonomy system ready but needs seed data (see below)
- ✅ `project_categories` - Junction table works
- ✅ `project_photos` - Base structure good (needs columns)
- ✅ `saved_projects` - Favoriting ready
- ✅ `reviews` - Review system ready
- ✅ `messages` - Messaging ready
- ✅ `notifications` - Notifications ready
- ✅ `project_applications` - Application flow ready (different from invitations)
- ✅ `professional_specialties` - Professional categories ready once seeded

---

## 📦 Seed Data Requirements (run post-migration)

Prepare SQL (or Supabase seed scripts) to insert the following baseline taxonomy values immediately after Phase 1 migrations deploy:

**Professional categories & services**

| Category | Service |
| --- | --- |
| Design & Planning | Architecture |
| Design & Planning | Interior design |
| Design & Planning | Garden design |
| Construction | General contractor |
| Construction | Roof |
| Construction | Tiles and stone |
| Construction | Kitchen |
| Construction | Stairs |
| Construction | Elevator |
| Construction | Windows |
| Construction | Bathroom |
| Construction | Swimming pool |
| Construction | Welness |
| Construction | Doors |
| Systems | Lighting |
| Systems | Electrical systems |
| Systems | Security systems |
| Systems | Domotica |
| Finishing | Interior fit-out |
| Finishing | Fireplace |
| Finishing | Interior styling |
| Finishing | Painting |
| Finishing | Decoration and carpentry |
| Finishing | Indoor plants |
| Finishing | Floor |
| Finishing | Furniture |
| Finishing | Art |
| Outdoor | Outdoor lighting |
| Outdoor | Garden |
| Outdoor | Garden house |
| Outdoor | Outdoor furniture |
| Outdoor | Fencing and gates |

**Project categories, sub-types, and metadata**

| Category | Sub-type | Listing type? | Building feature? |
| --- | --- | --- | --- |
| House | Villa | Yes | No |
| House | House | Yes | No |
| House | Apartment | Yes | No |
| House | Chalet | Yes | No |
| House | Bungalow | Yes | No |
| House | Farm | Yes | No |
| House | Extension | Yes | No |
| Kitchen & Living | Kitchen | Yes | Yes |
| Kitchen & Living | Living room | No | Yes |
| Kitchen & Living | Dining room | No | Yes |
| Kitchen & Living | Sunroom | No | Yes |
| Bed & Bath | Bathroom | Yes | Yes |
| Bed & Bath | Bedroom | No | Yes |
| Bed & Bath | Indoor Pool | No | Yes |
| Bed & Bath | Jacuzzi | Yes | Yes |
| Bed & Bath | Sauna | Yes | Yes |
| Bed & Bath | Steam room | No | Yes |
| Outdoor | Garden | Yes | Yes |
| Outdoor | Outdoor pool | Yes | Yes |
| Outdoor | Garden house | Yes | Yes |
| Outdoor | Outdoor kitchen | No | Yes |
| Outdoor | Garage | No | Yes |
| Outdoor | Porch | No | Yes |
| Other | Hall | No | Yes |
| Other | Home office | No | Yes |
| Other | Bar | No | Yes |
| Other | Cinema | No | Yes |
| Other | Gym | No | Yes |
| Other | Game room | No | Yes |
| Other | Kids room | No | Yes |
| Other | Wine cellar | No | Yes |

Store the additional columns (`listing_type`, `is_building_feature`) wherever the taxonomy lives (e.g., extended `categories` table or a new lookup table) so the wizard can enforce PRD rules.

---

## 🎯 Implementation Priority

### Phase 1: Critical Blockers (Do First)
1. Create `project_features` table
2. Add `feature_id` to `project_photos`
3. Add location fields to `projects`
4. Create `project_professionals` table
5. Wire Create Company flow to set `professional` user type (unlock project wizard)
6. Seed taxonomy tables (professional categories/services, project categories/sub-types)

**Estimated Development Time:** 2-3 hours
**Blocks:** All Photo Tour steps, Professional invitation steps, Location step, baseline taxonomy required for dropdowns

---

### Phase 2: Essential Workflow Fields
5. Add project style field
6. Add primary category field
7. Extend status enum and add review fields
8. Add wizard/autosave fields

**Estimated Development Time:** 1-2 hours
**Blocks:** Wizard state management, Admin approval workflow

---

### Phase 3: Enhancements (Can Do Later)
_All items in this phase are optional improvements that can be deferred until after the core wizard flows ship._
9. Split features into location/materials
10. Add photo upload tracking
11. Add search optimization
12. Add soft delete

**Estimated Development Time:** 2-3 hours
**Blocks:** User experience improvements, performance

---

## 🚀 Next Steps

### Immediate Actions:
1. **Review and approve** this gap analysis with stakeholders
2. **Create migration files** for Phase 1 (critical blockers)
3. **Update TypeScript types** using `mcp__supabase__generate_typescript_types`
4. **Test migrations** on development environment
5. **Wire the Create Company flow** so it persists `professional` in `profiles.user_types` and surfaces the project wizard only for professional users
6. **Seed taxonomy data** (professional categories/services, project categories/sub-types) immediately after Phase 1 migrations so dropdowns work out of the box (see Seed Data Requirements section)
7. **Begin wizard development** once Phase 1 migrations are deployed and seed data is in place

### Migration Sequence:
```bash
# Recommended migration order
001_create_project_features_table.sql
002_add_feature_id_to_photos.sql
003_add_location_fields_to_projects.sql
004_create_project_professionals_table.sql
005_extend_project_status_enum.sql
006_add_workflow_fields_to_projects.sql
007_add_materials_location_split.sql
008_add_search_optimization.sql
```

---

## ⚠️ Breaking Changes & Migration Notes

### Data Migration Required:
- **`projects.features`** → Split into `location_features` and `material_features`
- **`projects.style_preferences[0]`** → Copy to `projects.project_style`
- **`projects.location`** → Parse and split into structured address fields (if data exists)

### RLS Policy Updates Needed:
- `project_features` - Users can edit features for their own projects
- `project_professionals` - Project owners can invite, professionals can update status
- All new columns in `projects` and `project_photos` - Update existing policies

### Application Code Impact:
- 🔴 HIGH: Photo upload/management code must be rewritten to use features
- 🔴 HIGH: Project creation wizard must handle new schema
- 🔴 HIGH: Access control must gate the wizard to `professional` profiles only (Create Company promotion required)
- 🟡 MEDIUM: Project listing queries must join with features
- 🟡 MEDIUM: Professional invitation workflow is new functionality
- 🟢 LOW: Existing project display can remain mostly unchanged

---

## 📝 Conclusion

**Database Readiness:** 75% complete for project CRUD workflows

**Critical Path:** Implement 4 critical changes (project_features table, feature_id column, location fields, project_professionals table) before starting wizard development, wire Create Company so it sets the `professional` user type (only professionals can access the wizard), and seed the category/service taxonomy required by the PRD.

**Timeline Estimate:**
- Phase 1 migrations: 2-3 hours
- Phase 2 migrations: 1-2 hours
- RLS policy updates: 1 hour
- TypeScript type generation: 15 minutes
- **Total: ~5 hours before wizard development can begin**

**Risk Assessment:** LOW - All gaps are addressable with standard database patterns. No architectural changes needed.
