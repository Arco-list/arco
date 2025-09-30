# New Project Page - User Stories & Requirements

**Created:** 2025-09-30
**Source:** arco-prd.md
**Component Path:** `app/new-project/details/page.tsx`
**Feature:** Multi-step Project Creation Wizard

---

## Overview

The New Project page is a comprehensive multi-step wizard that guides users through creating and publishing a project listing on the Arco platform. The wizard supports draft saving, autosave functionality, and extensive validation throughout the process.

---

### Current Implementation Snapshot (February 2025)

- Step 1 runs in production UI and now pulls Category and Type options from Supabase (with a bundled fallback list).
- Building type, project styles, size ranges, budget tiers, and feature taxonomies load from Supabase (`project_taxonomy_options`) and gracefully fall back to the bundled snapshot when the API is unreachable.
- Steps 2-5 are functional prototypes that still rely on client-side state only; persistence and autosave are outstanding, but inline validation is now in place for all active steps.
- Photo Tour and Professionals steps render UI flows but lack Supabase storage or taxonomy wiring.
- Save & Exit button is present but not yet connected to a draft workflow.

---

## Wizard Architecture

### Core Components

**Main Wizard Flow:**
1. **Project Details** - Project Type
2. **Location & Materials** - Feature Selection
3. **Details** - Size, Budget, Year
4. **Name & Description** - Title and Description
5. **Location (Confirm)** - Address and Map
6. **Photo Tour** - Add Photos, Choose Features, Features List
7. **Professionals** - Add Professionals, Invite Professionals
8. **Finalize** - Review and Publish

### Navigation & State Management

**Stepper Component:**
- Visual progress indicator showing all steps
- Highlights current step
- Prevents skipping ahead without completing required fields
- Supports back navigation without data loss

**Navigation Controls:**
- **Back button:** Returns to previous step, preserves all data
- **Next button:** Advances to next step (disabled until validation passes)
- **Save & Exit:** Returns to Listings with "In progress" status
- **Complete/Publish:** Final submission button

**Autosave System:**
- Autosaves on step change (before navigating away)
- Autosaves every 30 seconds when there are unsaved changes
- Prevents data loss if user closes browser or navigates away

**Help System:**
- "Questions?" link opens external help page in new tab/window

---

## Step-by-Step Requirements

### Step 1: Project Details - Project Type

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599133134-arco-projectWizard-1-v0.png?alt=media&token=815534ee-68c8-4ad3-aa30-9d44440c153a)

#### Functional Requirements

**Required Selections (all must be completed before Next):**
1. **Project Category** (required)
   - Examples: House, Bed & Bath
   - Selection determines available options in other fields

2. **Project Type** (required)
   - Examples: Villa, Apartment, Kitchen
   - Filtered based on Project Category selection

3. **Building Type** (required)
   - Options: New build, Renovated, Interior designed

4. **Project Style** (required)
   - Examples: Modern, Contemporary, Traditional

#### Data Source
- Project categories and types are fetched from Supabase (`categories` joined with `project_category_attributes`).
- Project styles, building types, size ranges, and budget tiers are sourced from the new `project_taxonomy_options` table.
- When Supabase is unavailable, we fall back to the PRD-aligned taxonomy snapshot bundled in the client.
- Options are sorted by the taxonomy `sort_order` field (fallback to alphabetical).
- Dropdowns use a custom menu with inline text search for filtering options.

#### Acceptance Criteria
- ✅ Next button stays disabled until all four selections are made.
- ✅ Project type options filter to the selected category (Supabase taxonomy with fallback snapshot).
- ✅ Building type, style, size, and budget dropdowns read from Supabase and fall back safely if the request fails.
- ✅ Inline error messaging replaces blocking alerts.
- ✅ Dropdown menus support inline text search for filtering options.
- TODO: Persist selections across Save & Exit as described in the PRD.

---

### Step 2: Location & Materials - Feature Selection

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599147157-arco-wizard-2-v0.png?alt=media&token=06c53f8e-3653-41c6-af0f-3ea237f28104)

#### Functional Requirements

**Location Features (required):**
- Checkbox group with multiple selection allowed
- At least one selection required
- Examples: Urban, Suburban, Waterfront, Mountain

**Material Features (required):**
- Checkbox group with multiple selection allowed
- At least one selection required
- Examples: Wood, Stone, Concrete, Glass

#### Data Source
- Both feature groups are loaded from Supabase (`project_taxonomy_options` with types `location_feature` and `material_feature`).
- Icons map from the taxonomy records; when absent we fall back to the legacy icon cycle.
- If the Supabase query fails, the UI reverts to the bundled snapshot.

#### Acceptance Criteria
- ✅ Next is blocked until each group has at least one selection; inline errors surface underneath the grid.
- ✅ Selected tiles remain checked when navigating Back within the wizard session.
- ✅ Feature options pull from Supabase taxonomy with fallback.
- TODO: Persist selections across Save & Exit.

---

### Step 3: Details - Size, Budget, Year

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599160906-arco-wizard-3-v0.png?alt=media&token=388dd18a-2aca-4d1d-9bea-5c2bd6bd9306)

#### Functional Requirements

**Size (required):**
- Dropdown range selection
- Options sourced from Supabase taxonomy; values include < 100 m2, 100-200 m2, 200-500 m2, > 500 m2

**Budget (required):**
- Predefined budget ranges
- Examples: Budget, Mid-range, Premium, Luxury
- Maps to `project_budget_level` enum in database

**Year Built (required):**
- 4-digit year input
- Must be within configurable bounds (e.g., 1800 to current year)

**Building Year (required):**
- 4-digit year input (original construction year if different)
- Must be within configurable bounds (e.g., 1800 to current year)
- Must be less than or equal to Year Built

#### Validation Rules
- Size and budget selections are required.
- Year fields must be 4 digits, between 1800 and the current year.
- Building year must be less than or equal to Year built.
- Inline validation messages highlight each field on error.

#### Acceptance Criteria
- ✅ Next is disabled until Size, Budget, Year built, and Building year are valid.
- ✅ Inline errors surface beneath any invalid field.
- TODO: Persist entries across Save & Exit.

---

### Step 4: Name & Description

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599185273-arco-wizard-4-v0.png?alt=media&token=e8d21269-585f-49d9-ae53-b1d71ed2c99b)

#### Functional Requirements

**Project Title (required):**
- Text input field with live character counter (max 120 characters).
- Example: "Modern Villa with Sea View in Costa Brava"

**Project Description (required):**
- TipTap-backed editor with constrained toolbar (bold, italic, underline, bulleted list, numbered list).
- Live word and character counters with minimum 50-character requirement.
- Output stored as HTML string and validated via plain-text length check to keep parity with PRD copy guidelines.

#### Validation Rules
- Title required, max 120 characters
- Description required, minimum 50 characters
- Character counters update in real-time
- Invalid states show inline error messages

#### Acceptance Criteria
- ✅ Next is disabled until both Title and Description meet length constraints.
- ✅ Character counters and word counts update live and reflect validation state.
- ✅ Inline error messages replace alerts.
- TODO: Persist values across Save & Exit.

---

### Step 5: Location (Confirm)

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599202484-arco-wizard-5-v0.png?alt=media&token=e2dc097a-3bbb-41d2-a34e-4ed6f2dfe2cb)

#### Functional Requirements

**Address Selection:**
- Google Places autocomplete integration
- Address search bar with suggestions
- Draggable map pin for precise location
- Store:
  - Latitude
  - Longitude
  - Formatted address string
  - City/region for masking purposes

**Privacy Control:**
- "Share exact location" toggle
- When OFF: Public display shows only city/region
- When ON: Public display shows full address
- Toggle state persists in database

**Map Integration:**
- Interactive map display (Google Maps)
- User can drag pin to adjust location
- Map updates when address selected from autocomplete
- Zoom controls and map type selector

> Current UI: renders a static Google Maps iframe and manual address input; autocomplete, pin drag, and persistence are pending.

#### Acceptance Criteria
- ✅ Complete button (within this step) remains disabled until an address is provided.
- ✅ Inline error messaging appears if the address is left blank when continuing.
- TODO: Integrate Places autocomplete and map pin syncing to validate addresses.
- TODO: Persist address and toggle state across Save & Exit.

---

### Step 6: Photo Tour - Add Photos

**Mockups:**
- [Add Photos 1](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599254856-arco-wizard-photos-2.png?alt=media&token=9f91c456-bfa6-489c-9d2a-e9484f5f6bd7)
- [Add Photos 2](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599254858-arco-wizard-Photos-1-v0.png?alt=media&token=796097aa-6c23-4180-83ab-3ae8ebb7f363)

#### Functional Requirements

**Upload Methods:**
- Drag and drop files onto upload zone
- Click to browse and select files
- Multi-file upload support
- Progressive upload (show each file as it uploads, no need to wait for all)

**File Requirements:**
- Supported formats: JPG, PNG
- File size limits (TBD - recommend max 10MB per file)
- Image dimension requirements (TBD - recommend min 1200px width)

**Photo Management:**
- Display uploaded photos in grid layout
- Per-photo actions menu:
  - **Set as cover photo** - Designates primary project image
  - **Delete** - Removes photo from project
- Reorder photos via drag-and-drop
- Photo counter showing uploaded count

**Validation:**
- Minimum 5 photos required to proceed
- Show "5 needed" or similar affordance
- Next button disabled until minimum met
- Counter updates as photos are uploaded/deleted

#### Database Integration
- Photos stored in `project_photos` table
- Each photo has:
  - URL reference (Supabase Storage)
  - Display order
  - Is_primary flag for cover photo
  - Associated feature (optional)

#### Acceptance Criteria
- ✅ Next disabled until at least 5 photos uploaded
- ✅ Show '5 needed' or count affordance
- ✅ Drag-and-drop or click to upload JPG/PNG
- ✅ Show each file as it uploads (no need to wait for all)
- ✅ Per-photo menu allows 'Set cover photo' and 'Delete'
- ✅ Photo selections persist on Back and Save & Exit

---

### Step 7: Photo Tour - Choose Features

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599288526-arco-wizard-photos-3.png?alt=media&token=bab23a44-c7f2-4f8e-af7c-87fdd1c1a9cf)

#### Functional Requirements

**Feature Selection:**
- Display available features as selectable tiles
- Examples: Bedroom, Bathroom, Kitchen, Living Room, Garden, Pool
- Each tile shows:
  - Feature icon (from taxonomy)
  - Feature name
- Multi-select allowed
- Checkbox or toggle state on each tile

**Feature Organization:**
- Sorted by  'sort' field
- **Building** feature always appears first (default)
  - Contains all building images not associated with specific features
  - Automatically created for Project Type "House"
- **Additional Photos** feature always appears last
  - Catch-all for miscellaneous photos

**Actions:**
- **Select photos** - Opens Select Photos popup for that feature
- **Add photos** - Opens global Add Photos popup
- **Add features** - Opens Add Features popup to select more

#### Acceptance Criteria
- ✅ Display available features (e.g., Bedroom, Bathroom) as selectable tiles with icons
- ✅ Icons and sort order from taxonomy
- ✅ Multi-select allowed
- ✅ Selections persist on Back/Save & Exit
- ✅ Next navigates to Features List

---

### Step 8: Photo Tour - Features List

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599404569-arco-wizard-photos-4.png?alt=media&token=04c0a0e0-bb74-454c-a87b-9e6c838642d4)

#### Functional Requirements

**Feature Cards:**
- Display each selected feature as a card
- Each card shows:
  - Feature name and icon
  - Photo count or "Add photos" link
  - "Select photos" button to open photo selection modal

**Photo Requirements:**
- At least one feature must have ≥1 photo (recommended, not required)
- Only features with photos will be published on Project Detail Page
- Show informational message: "Only features with photos will be published"

**Floating Action Button (+):**
- Opens menu with options:
  - **Add photos** - Opens global photo upload popup
  - **Add feature** - Opens Add Features popup

**Complete Button:**
- Remains enabled when overall photo minimum is met (5+ photos total)
- Disabled if total photos < 5
- Does NOT require every feature to have photos

#### Acceptance Criteria
- ✅ List selected features as cards
- ✅ Each shows 'Select photos' which opens Select Photos modal
- ✅ Floating action button '+' opens menu: 'Add photos' and 'Add feature'
- ✅ Only features with photos will be published; show this message
- ✅ Complete button finishes Photo Tour; remain enabled when overall photo minimum met
- ✅ Complete disabled until overall photo minimum met (≥5 photos)
- ✅ At least one feature with ≥1 photo recommended (not required)

---

### Step 9: Photo Tour - Select Photos (Modal)

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599488422-arco-wizard-photos-4b.png?alt=media&token=8e1b595a-2a57-4cfb-9388-8d710fc701eb)

#### Functional Requirements

**Modal Header:**
- Shows current feature name (e.g., "Master Bedroom")
- Close button to dismiss modal

**Photo Pool:**
- Display all uploaded photos in grid
- Each photo has checkbox toggle for selection
- Multiple photos can be selected
- Selected photos are associated with the feature

**Upload in Place:**
- Drop zone for adding new photos directly in modal
- "Browse files" button as alternative to drag-drop
- New photos added to global pool and auto-associated with current feature

**Cover Photo:**
- Per-photo action: "Set as cover" for the feature
- Only one cover photo per feature
- Cover photo used as feature thumbnail on PDP

**Feature Management:**
- Top-right "Delete feature" button
- Removes feature from project
- Photos remain in global pool (not deleted)

**Save Action:**
- "Save Selection (N)" button shows count of selected photos
- Saves photo associations to feature
- Returns to Features List

#### Acceptance Criteria
- ✅ Header shows current feature name
- ✅ User can upload new photos in-place (drop zone + 'Browse files')
- ✅ Select from existing photos pool with check toggles
- ✅ Selected count shown in Save button (e.g., 'Save Selection (2)')
- ✅ Per-photo action: 'Set as cover' for the feature
- ✅ Only one cover per feature
- ✅ Top-right 'Delete feature' removes the feature; photos remain in pool

---

### Step 10: Photo Tour - Add Photos (Popup)

#### Functional Requirements
- Same functionality as Step 6 (Add Photos)
- Upload additional photos to global pool
- Same file validations (JPG/PNG)
- Photos become available for association with any feature

#### Acceptance Criteria
- ✅ Upload additional photos to global pool
- ✅ Same validations as Add Photos step
- ✅ Photos available for all features after upload

---

### Step 11: Photo Tour - Add Features (Popup)

#### Functional Requirements

**Feature Selection:**
- List remaining features from taxonomy
- Shows features NOT yet selected for the project
- Each feature displays:
  - Icon
  - Name
  - Description (optional)
- Checkbox or tile selection

**Actions:**
- Select multiple features to add
- "Add" button adds selected features to project
- Returns to Features List or Choose Features view

#### Acceptance Criteria
- ✅ List remaining features from taxonomy not yet selected
- ✅ Allow adding them to the project
- ✅ Multi-select supported
- ✅ Features added become available in Features List

---

### Step 12: Professionals - Add Professionals

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599576225-arco-wizard-professionals-2.png?alt=media&token=1b9b74d9-45d5-4d7e-8e4d-f6e3783ccf41)

#### Functional Requirements

**Professional Services:**
- Display professional services from  taxonomy
- Examples: Architect, Interior Designer, Contractor, Landscape Architect
- Each service tile shows:
  - Service icon (from taxonomy)
  - Service name
- Multi-select allowed
- Sorted by 'sort' column

**Selection:**
- Users select one or more services via tiles
- No minimum selection required (optional step)
- Selections persist on Back/Save & Exit

**Next Action:**
- Next button navigates to Invite Professionals
- Enabled regardless of selections made

#### Acceptance Criteria
- ✅ Display professional services from  with icons
- ✅ Sorted by 'sort' column
- ✅ Users select one or more services via tiles (multi-select)
- ✅ Selection persists on Back/Save & Exit
- ✅ Next navigates to Invite Professionals
- ✅ No minimum selection required
- ✅ Next enabled even if zero services selected

---

### Step 13: Professionals - Invite Professionals

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599596208-arco-wizard-professionals-3.png?alt=media&token=b27d7d42-ca01-4e3a-9dc3-18a7bf5a1c51)

#### Functional Requirements

**Service Cards:**
- Show each selected service as a card
- Each card contains:
  - Service name and icon
  - "Invite professional" button
  - Kebab menu (⋮) with actions

**Kebab Menu Actions:**
- **Edit email** - Opens Update Professional popup
- **Remove service** - Removes service from project
- **Cancel invite** - Available if invite pending

**Invite Professional:**
- Button opens Invite Professional popup
- Collects email address for professional
- Email validation required
- Domain validation:
  - If domain matches company account: show company name + primary service
  - Otherwise: display the email address
  - Optionally block personal domains (gmail.com, hotmail.com, etc.)

**Floating Action Button (+):**
- Opens menu to "Add professionals" (popup)
- Allows adding more services after initial selection

**Invite Queue:**
- Invites are queued (not sent immediately)
- Invites sent when project is **published AND approved by admin**
- Status tracking for pending invites

#### Acceptance Criteria
- ✅ Show each selected service as card with 'Invite professional' button
- ✅ Kebab menu per card opens Update Professional popup
- ✅ Actions: Edit email, Remove service, Cancel invite (if pending)
- ✅ Floating '+' opens menu to Add professionals (popup)
- ✅ Invites queued and sent when project published and approved
- ✅ If domain matches company account, show company name + primary service
- ✅ Otherwise display email
- ✅ Email must be valid
- ✅ Optionally block configured personal domains

---

### Step 14: Professionals - Add Professionals (Popup)

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599612118-arco-wizard-professionals-3b.png?alt=media&token=82bc57f8-292f-4bea-8a97-90c849b374f5)

#### Functional Requirements

**Service Display:**
- Shows service name + icon
- One service per form entry

**Email Input:**
- Company email address field
- Email validation
- Domain validation:
  - Block common personal domains if enabled
  - Examples: gmail.com, hotmail.com, yahoo.com, outlook.com

**Actions:**
- **Add** - Adds professional invitation to service
- **Remove** - Remove previously added service from project
- Multiple professionals can be added for same service

#### Acceptance Criteria
- ✅ Show service + icon
- ✅ User adds company email
- ✅ Block common personal domains if enabled
- ✅ Remove previously added service option available

---

### Step 15: Professionals - Invite Professionals (Popup)

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599699192-arco-wizard-professionals-3b.png?alt=media&token=ff629265-f884-43ca-9f5c-3f24c7491024)

#### Functional Requirements

**Modal Form:**
- Email address input field
- Service context displayed (which service is being invited)
- Email validation

**Send Action:**
- **Send** button adds pending invite to selected service
- Invite not sent immediately
- Status set to "pending"
- Will be sent after project published and admin approved

#### Acceptance Criteria
- ✅ Invite Professional modal collects email address
- ✅ Send adds pending invite to selected service
- ✅ Email validation required
- ✅ Invite queued, not sent immediately

---

### Step 16: Finalize

**Mockup:** [View Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599723491-arco-wizard-professionals-4.png?alt=media&token=0d7b47b3-98a8-484e-af34-63b8e99b0522)

#### Functional Requirements

**Preview:**
- Display project thumbnail (cover photo)
- Show key project details summary:
  - Title
  - Location (city/region)
  - Project type and style
  - Photo count
  - Professional services count
- Click thumbnail to open listing preview in new screen/tab

**Final Validation:**
- Run comprehensive validation before allowing publish
- Check all required fields completed
- Verify minimum photo requirements met
- Validate all data integrity

**Publish Action:**
- **Publish** button submits project for review
- On success:
  - Navigate to Listings page
  - Project shows with status "● In review"
  - Success toast notification displayed
- On error:
  - Show error message
  - Allow user to correct issues

**Post-Publish:**
- Project enters admin approval queue
- Status: "In review"
- User can edit draft while in review
- Professional invites sent after admin approval

#### Acceptance Criteria
- ✅ Clicking project thumbnail opens listing preview in new screen
- ✅ Publish takes user to Listings with status "● In review"
- ✅ On publish, run final validation and show success toast
- ✅ Project enters admin approval queue
- ✅ Cannot publish until all validation passes

---

## Cross-Cutting Concerns

### Draft Management

**Automatic Draft Creation:**
- Draft created on first step of wizard
- Status: "draft" in database
- Draft ID persisted for subsequent saves

**Draft Listing:**
- Appears in user's Listings page
- Status badge: "In progress"
- Thumbnail:
  - Shows cover photo if photos uploaded
  - Shows gray placeholder if no photos yet

**Resume Draft:**
- User can return to draft from Listings
- Opens wizard on last-saved step
- All data preserved and editable

### Validation System

**Progressive Validation:**
- Inline validation on field change
- Step-level validation before allowing Next
- Final validation before Publish

**Validation Types:**
1. **Required Field** - Field cannot be empty
2. **Format** - Email, year (4 digits), etc.
3. **Range** - Years within bounds, character limits
4. **Logic** - Building year ≤ Year built
5. **Minimum** - At least 5 photos, at least 1 feature selection
6. **Uniqueness** - One cover photo per feature

**Error Display:**
- Inline error messages below/next to field
- Red border or highlight on invalid fields
- Error icon indicators
- Disable Next/Complete buttons until resolved

### Data Persistence

**Autosave Triggers:**
1. User changes step (before navigation)
2. Every 30 seconds if unsaved changes detected
3. Save & Exit button clicked
4. Browser beforeunload event (page close warning)

**Data Stored:**
- All form field values
- Photo uploads and associations
- Feature selections and associations
- Professional service selections and invites
- Current wizard step position

**Storage Location:**
- Supabase database
- `projects` table with status "draft"
- Related tables: `project_photos`, `project_categories`, etc.

### Accessibility

**Keyboard Navigation:**
- Tab order follows logical flow
- Enter key advances through steps where appropriate
- Escape key closes modals
- Arrow keys for photo reordering

**Screen Reader Support:**
- ARIA labels on all interactive elements
- Status announcements for validation errors
- Progress announcements when moving between steps
- Image alt text for icons and photos

**Visual Accessibility:**
- Sufficient color contrast (WCAG AA minimum)
- Focus indicators on all interactive elements
- Error states clearly visible
- Large touch targets for mobile (min 44x44px)

---

## Database Schema Mapping

### Tables Involved

**`projects`** - Main project record
- `id` (uuid, primary key)
- `title` (text)
- `description` (text)
- `user_id` (uuid, foreign key to profiles)
- `category_id` (uuid, foreign key to categories)
- `project_type` (text)
- `building_type` (text)
- `project_style` (text)
- `size` (text)
- `budget_level` (project_budget_level enum)
- `year_built` (integer)
- `building_year` (integer)
- `location` (geometry/point)
- `formatted_address` (text)
- `share_exact_location` (boolean)
- `status` (project_status enum: draft, published, in_progress, completed, archived)
- `created_at`, `updated_at` (timestamps)

**`project_photos`** - Photo management
- `id` (uuid, primary key)
- `project_id` (uuid, foreign key to projects)
- `photo_url` (text)
- `display_order` (integer)
- `is_primary` (boolean)
- `feature_name` (text, optional)

**`project_categories`** - Many-to-many project-category relationships
- `project_id` (uuid, foreign key)
- `category_id` (uuid, foreign key)

**`categories`** - Taxonomy for all categorization
- `id` (uuid, primary key)
- `name` (text)
- `type` (text: project_category, location_feature, material_feature, professional_service, etc.)
- `icon_url` (text)
- `sort` (integer)

**`professional_specialties`** - Professional invitations
- Professional invitation data (exact schema TBD)
- Links projects to invited professionals

---

## User Stories

### Epic: Create New Project Listing

**US-1: Start Project Creation**
- **As a** homeowner
- **I want to** start creating a project listing
- **So that** I can showcase my completed project and connect with professionals

**Acceptance Criteria:**
- Given I am on the Dashboard or Listings page
- When I click "Add Project" or "Create Project"
- Then the Project Wizard opens on Step 1 (Project Details)
- And a draft project is created in the database

---

**US-2: Select Project Type and Style**
- **As a** homeowner
- **I want to** specify my project category, type, building type, and style
- **So that** my project is properly classified and discoverable

**Acceptance Criteria:**
- Given I am on Step 1 of the wizard
- When I select all four required fields
- Then the Next button becomes enabled
- And my selections are saved automatically
- And I can proceed to the next step

---

**US-3: Choose Project Features**
- **As a** homeowner
- **I want to** select location and material features
- **So that** potential clients can filter and find projects like mine

**Acceptance Criteria:**
- Given I am on Step 2 of the wizard
- When I select at least one location feature and one material feature
- Then the Next button becomes enabled
- And an inline error displays if I try to proceed without selections

---

**US-4: Enter Project Details**
- **As a** homeowner
- **I want to** specify size, budget, and year information
- **So that** the project has complete and accurate details

**Acceptance Criteria:**
- Given I am on Step 3 of the wizard
- When I enter valid Size, Budget, Year built, and Building year
- Then the Next button becomes enabled
- And validation prevents invalid year combinations
- And inline errors show for invalid entries

---

**US-5: Add Project Title and Description**
- **As a** homeowner
- **I want to** write a compelling title and description
- **So that** my project stands out and tells its story

**Acceptance Criteria:**
- Given I am on Step 4 of the wizard
- When I enter a title (≤120 chars) and description
- Then character counters update in real-time
- And Next button enables when both fields are valid
- And I can use basic rich text formatting in the description

---

**US-6: Confirm Project Location**
- **As a** homeowner
- **I want to** specify the exact location of my project
- **So that** it appears correctly on maps and location searches

**Acceptance Criteria:**
- Given I am on Step 5 of the wizard
- When I search for an address or drag the map pin
- Then the location is saved with lat/lng coordinates
- And I can toggle whether to share the exact address publicly
- And Complete button enables only after valid address selected

---

**US-7: Upload Project Photos**
- **As a** homeowner
- **I want to** upload multiple photos of my project
- **So that** I can visually showcase the work completed

**Acceptance Criteria:**
- Given I am on the Photo Tour section
- When I drag-and-drop or select files
- Then photos upload progressively
- And I must upload at least 5 photos to proceed
- And I can set one photo as the cover image
- And I can delete photos I don't want

---

**US-8: Organize Photos by Feature**
- **As a** homeowner
- **I want to** assign photos to specific building features
- **So that** visitors can browse photos by room or area

**Acceptance Criteria:**
- Given I have uploaded photos
- When I select features (Bedroom, Bathroom, Kitchen, etc.)
- Then I can associate photos with each feature
- And I can set a cover photo for each feature
- And only features with photos will be published

---

**US-9: Invite Professionals**
- **As a** homeowner
- **I want to** invite the professionals who worked on my project
- **So that** they get credit and exposure for their work

**Acceptance Criteria:**
- Given I am on the Professionals section
- When I select professional services and provide email addresses
- Then pending invitations are created
- And invitations are sent after project is published and approved
- And I can add multiple professionals per service
- And personal email domains can be blocked

---

**US-10: Review and Publish Project**
- **As a** homeowner
- **I want to** review all project details before publishing
- **So that** I can ensure everything is correct

**Acceptance Criteria:**
- Given I am on the Finalize step
- When I click the project thumbnail
- Then a preview opens in a new tab
- And when I click Publish
- Then final validation runs
- And the project status changes to "In review"
- And I am redirected to Listings page with success message

---

**US-11: Save Draft and Resume Later**
- **As a** homeowner
- **I want to** save my progress and return later
- **So that** I don't lose work if I need to stop

**Acceptance Criteria:**
- Given I am at any step in the wizard
- When I click "Save & Exit"
- Then all data is saved
- And I return to the Listings page
- And the draft shows with "In progress" status
- And when I click to edit the draft
- Then the wizard reopens on the last step I was on

---

**US-12: Navigate Between Steps**
- **As a** homeowner
- **I want to** go back and forth between wizard steps
- **So that** I can review and edit previous entries

**Acceptance Criteria:**
- Given I am on any wizard step
- When I click Back
- Then I return to the previous step
- And all previously entered data is preserved
- And when I click Next again
- Then I return to where I was without data loss

---

**US-13: Autosave Protection**
- **As a** homeowner
- **I want to** have my work automatically saved
- **So that** I don't lose progress if my browser closes

**Acceptance Criteria:**
- Given I am entering data in the wizard
- When 30 seconds pass with unsaved changes
- Then the system automatically saves my progress
- And when I change steps
- Then the system saves before navigating
- And when I try to close the browser
- Then I see a warning if there are unsaved changes

---

## Admin Context

### Admin Project Creation

Admins have additional capabilities when creating projects:

**Admin-Specific Features:**
- Can create projects on behalf of users
- Access to all project statuses (not just draft/published)
- Can bypass some validation rules
- Can publish immediately without review queue

**Admin Workflow:**
- Access via Admin dashboard "Create Project" button
- Same wizard interface as users
- Opens to Step 1 by default
- Can edit any existing project via Edit icon in projects table

**Admin Acceptance Criteria:**
- Given row actions in admin Projects table
- When admin clicks Create Project
- Then open Create/Edit wizard on Step 1
- And when admin clicks Edit on existing project
- Then open wizard on last-saved step
- And preserve context on return to admin table

---

## Non-Functional Requirements

### Performance
- Page load time < 2 seconds
- Photo upload < 5 seconds per image (avg)
- Step navigation < 500ms
- Autosave operation < 1 second (non-blocking)

### Security
- User can only create/edit their own projects
- Admin can create/edit any project
- File upload validation (type, size)
- SQL injection prevention on all inputs
- XSS protection on rich text editor

### Usability
- Mobile-responsive design (all viewport sizes)
- Touch-friendly controls on mobile
- Clear error messages with actionable guidance
- Progress indicator shows completion status
- Help text/tooltips for complex fields

### Browser Support
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- Mobile browsers: iOS Safari, Chrome Android

---

## Open Questions / TBD

1. **Photo Storage:** Exact file size limits and image dimension requirements?
2. **Description Length:** Minimum character count for project description?
3. **Professional Invites:** Email notification templates and timing?
4. **Admin Approval:** Detailed admin review workflow and criteria?
5. **Draft Expiration:** Do drafts expire after X days of inactivity?
6. **Duplicate Prevention:** How to handle users creating very similar projects?
7. **SEO Fields:** Are meta title/description editable by users or auto-generated?
8. **Localization:** Multi-language support for wizard interface?
9. **Slug Generation:** Auto-generate from title or allow custom URLs?
10. **Professional Domain List:** Specific list of blocked personal email domains?

---

## Success Metrics

**Completion Metrics:**
- % of users who complete wizard vs. abandon
- Average time to complete wizard
- Step with highest abandonment rate
- % of drafts that get published

**Quality Metrics:**
- Average number of photos per project
- % of projects with all optional fields completed
- % of projects approved on first review
- Average professional invitations per project

**User Satisfaction:**
- Wizard usability rating
- Photo upload success rate
- Error rate per field
- Support requests related to project creation

---

## Related Features

**Related PRD Sections:**
- **F-19:** Admin — Create a new project (multi-step)
- **F-20:** Admin — Edit an existing project
- **F-18:** Start "List with Us" (Professional signup)

**Related Components:**
- Listings Dashboard (where drafts appear)
- Project Detail Page (public view of published project)
- Admin Projects Table (admin management interface)

---

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-09-30 | 1.0 | Generated from PRD | Initial comprehensive requirements document |
