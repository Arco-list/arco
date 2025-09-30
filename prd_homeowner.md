# Homeowner (Client User) Feature Checklist

**Created:** 2025-09-30
**User Type:** Client/Homeowner
**Purpose:** Development roadmap for all homeowner-facing features

---

## 📋 Priority Order for Development

### Phase 1: Core Authentication & Discovery (Foundation)
These features allow homeowners to browse and discover without requiring an account initially.

- [ ] **F-11: Create an account (sign up)**
  - Sign up form with First name, Last name, Email, Password
  - Email format validation
  - Password rules enforcement
  - ToS/Privacy consent
  - Inline error handling without clearing inputs
  - User type: 'client' in profiles table
  - Component: `app/signup/page.tsx` or `components/auth/AuthModal.tsx`

- [ ] **F-12: Log in / Log out**
  - Login form with Email and Password
  - "Forgot password?" link
  - Remember me checkbox
  - Context preservation after auth
  - Component: `app/login/page.tsx`, `components/login1.tsx`

- [ ] **F-10: Save/Like prompts sign-up (from anonymous)**
  - Auth modal triggers on gated actions (Save, Like, Write review)
  - Context preservation (tab, filters, sort, scroll, image index, pending action)
  - Auto-complete pending action after auth
  - Component: `components/auth/AuthModal.tsx`

---

### Phase 2: Basic Project Browsing (Anonymous + Authenticated)
Allow homeowners to discover and explore projects for inspiration.

- [ ] **F-01: Discover projects from the Landing page**
  - Browse latest projects grid
  - Category filter in header
  - "See all projects" link to full discover page
  - Component: `app/page.tsx` (landing page)

- [ ] **F-02: Search & filter projects (keyword + facets)**
  - Keyword search over project title
  - Filters: Category, Sub-type, Features, Year range, Location
  - Filter chips with clear/reset
  - Results count display
  - Component: `app/projects/page.tsx`

- [ ] **F-03: Sort project results (popularity/newest)**
  - Sort dropdown: Newest, Most Popular, Most Liked
  - Component: `app/projects/page.tsx`

- [ ] **F-04: Open a project detail**
  - Click project card → Project Detail Page
  - Component: `app/projects/[id]/page.tsx`

- [ ] **F-05: View project image gallery (lightbox)**
  - Click project image → Full-screen lightbox
  - Navigation arrows, close button, image counter
  - Support for feature-grouped photos
  - Component: `components/project/ImageGallery.tsx`

- [ ] **F-06: Navigate to related projects**
  - "Similar projects" section at bottom of PDP
  - Algorithm: same category, location, or style
  - Component: `components/project/RelatedProjects.tsx`

- [ ] **F-07: Jump to professionals from a project**
  - Professionals section on PDP
  - Click professional card → Company Page
  - Component: `app/projects/[id]/page.tsx`

- [ ] **F-09: Share a project**
  - Share button with social icons (Facebook, Twitter, LinkedIn, Copy link)
  - Toast confirmation on copy
  - Component: `components/project/ShareButton.tsx`

---

### Phase 3: Professional Discovery
Allow homeowners to find and evaluate professionals.

- [ ] **F-08: Browse the professionals directory**
  - Professionals listing page
  - Filter by: Service Category, Location, Verified status
  - Search by Company Name
  - Sort by: Rating, Reviews count, Alphabetical
  - Component: `app/professionals/page.tsx`

- [ ] **Professional Detail (Company Page) - View**
  - Company info: Logo, Name, Primary service, Location, Rating, Reviews count
  - About section
  - Projects gallery (company's projects)
  - Reviews list
  - Contact button
  - Component: `app/professionals/[id]/page.tsx`

---

### Phase 4: Authenticated User Features (Save & Manage)
Core features for logged-in homeowners to save and organize their inspiration.

- [ ] **F-13: Save (favorite) a project**
  - Heart icon on project cards
  - Toggle save/unsave
  - Requires authentication
  - Saved count visible to user
  - Table: `saved_projects`

- [ ] **F-14: Save (favorite) a professional**
  - Bookmark icon on professional cards
  - Toggle save/unsave
  - Requires authentication
  - Table: `saved_professionals`

- [ ] **F-15: View & manage Saved Projects**
  - Card grid with image, title, metadata, heart icon
  - Filter by Sub-type, Year
  - Search by Title
  - Unfavorite with fade animation
  - Empty state illustration
  - Component: `app/dashboard/page.tsx` → Saved Projects section

- [ ] **F-16: View & manage Saved Professionals**
  - Card grid with logo, company name, rating, reviews, service, location
  - Filter by Service Category
  - Search by Company Name
  - Remove via heart icon with animation
  - Empty state illustration
  - Component: `app/dashboard/page.tsx` → Saved Professionals section

- [ ] **F-17: Edit profile & change password**
  - Update: First Name, Last Name, Display Name, Profile Photo, Phone
  - Change Password: Current Password, New Password, Confirm New Password
  - Password rules enforcement
  - Log out other sessions on password change
  - Toast confirmation
  - Component: `app/dashboard/page.tsx` → Account Settings section

---

### Phase 5: Company Account Creation (Optional Upgrade)
Allow homeowners to also become professionals by creating a company account.

- [ ] **Create a company - Company Setup**
  - Access via "Company Setup" link on List With Us page
  - Company logo upload
  - Company name, phone number
  - Primary professional service selection (dropdown)
  - Company domain
  - Company email (must match company domain)
  - Email verification flow
  - Navigate to Professional Portal on success
  - Table: `companies`
  - Component: `app/create-company/page.tsx`

- [ ] **Role Switcher (Homeowner ↔ Professional)**
  - Appears in header if user has both roles
  - Toggle between Homeowner Dashboard and Professional Dashboard
  - State persists across sessions
  - Component: `components/RoleSwitcher.tsx`

---

### Phase 6: Advanced User Features (Reviews & Engagement)

- [ ] **F-31: Write a review for a professional**
  - Requires authentication
  - Only clients who worked with professional can review
  - Multi-dimensional rating: Overall, Communication, Quality, Timeline, Value
  - Review text (optional)
  - Photo upload (optional)
  - Submission confirmation
  - Table: `reviews`
  - Component: `components/reviews/WriteReview.tsx`

- [ ] **Like a project (engagement metric)**
  - Thumb up icon on project cards and PDP
  - Like count visible
  - Requires authentication
  - Table: Project engagement tracking (may need new table or field)

---

### Phase 7: Homeowner Dashboard - Project Listing (Advanced)
This is the most complex feature for homeowners: listing their own completed projects.

#### F-26: List a new project (multi-step wizard)

**Wizard Steps:**
1. Project Type
2. Location & Materials
3. Details
4. Name & Description
5. Location (Confirm)
6. Photo Tour (Add Photos)
7. Photo Tour (Choose Features)
8. Photo Tour (Features List)
9. Professionals (Add Professionals)
10. Professionals (Invite Professionals)
11. Finalize

**Implementation Checklist:**

- [ ] **Wizard Infrastructure**
  - Multi-step wizard component with stepper
  - Back/Next navigation
  - Save & Exit functionality (saves as draft)
  - Autosave on step change and every 30 seconds
  - Progress persistence
  - Step validation and disabled states
  - "Questions?" external help link
  - Component: `components/project/ProjectWizard.tsx`

- [ ] **Step 1: Project Type**
  - Select Project Category (House, Bed & Bath, etc.)
  - Select Project Type (Villa, Apartment, Kitchen) - filtered by Category
  - Select Building Type (New built, Renovated, Interior designed)
  - Select Project Style (Modern, etc.)
  - All dropdowns source from taxonomies
  - Next disabled until all 4 selected
  - Mockup: `arco-projectWizard-1-v0.png`

- [ ] **Step 2: Location & Materials**
  - Location features checkbox group (at least one required)
  - Material features checkbox group (at least one required)
  - Source from taxonomies with icons
  - Inline error if none selected
  - Mockup: `arco-wizard-2-v0.png`

- [ ] **Step 3: Details**
  - Size selection (taxonomy/range)
  - Budget selection (predefined ranges)
  - Year built (4-digit, 1800–current year)
  - Building year (4-digit, must be ≤ Year built)
  - All fields required
  - Inline validation errors
  - Mockup: `arco-wizard-3-v0.png`

- [ ] **Step 4: Name & Description**
  - Project title (required, max 120 characters, live counter)
  - Project description (required, rich-text basics, word/character count)
  - Character meters update live
  - Inline validation
  - Mockup: `arco-wizard-4-v0.png`

- [ ] **Step 5: Location (Confirm)**
  - Address autocomplete (Google Places API)
  - Draggable map pin
  - Store lat/lng + formatted address
  - "Share exact location" toggle (controls public masking)
  - Next disabled until valid address selected
  - Mockup: `arco-wizard-5-v0.png`

- [ ] **Step 6: Photo Tour - Add Photos**
  - Drag-and-drop or click to upload JPG/PNG
  - Show each file as it uploads (streaming)
  - Per-photo menu: Set cover photo, Delete
  - Minimum 5 photos to proceed
  - Counter display: "5 needed" affordance
  - Next disabled until ≥5 photos uploaded
  - Mockups: `arco-wizard-photos-2.png`, `arco-wizard-Photos-1-v0.png`

- [ ] **Step 7: Photo Tour - Choose Features**
  - Display available features from taxonomy (Bedroom, Bathroom, etc.)
  - Show icons and names
  - Multi-select tiles
  - Sorted by taxonomy sort column
  - Default: Building (first), Additional photos (last)
  - "Select photos" opens Select Photos popup
  - "Add photos" / "Add features" buttons
  - Next navigates to Features List
  - Mockup: `arco-wizard-photos-3.png`

- [ ] **Step 8: Photo Tour - Features List**
  - List selected features as cards
  - Each card shows "Select photos" button → Select Photos modal
  - Floating "+" button with menu: Add photos (global), Add feature
  - Only features with photos will be published (show message)
  - "Complete" button finishes Photo Tour section
  - Remain enabled when overall photo minimum met
  - Mockup: `arco-wizard-photos-4.png`

- [ ] **Popup: Select Photos**
  - Header shows current feature name
  - Upload new photos in-place (drop zone + browse)
  - Select from existing photos pool (checkboxes)
  - Selected count in Save button: "Save Selection (2)"
  - Per-photo action: "Set as cover" (one cover per feature)
  - Top-right "Delete feature" removes feature (photos remain in pool)
  - Mockup: `arco-wizard-photos-4b.png`

- [ ] **Popup: Add Photos**
  - Upload additional photos to global pool
  - Same validations as Add Photos step

- [ ] **Popup: Add Features**
  - List remaining features from taxonomy not yet selected
  - Allow adding to project

- [ ] **Step 9: Professionals - Add Professionals**
  - Display professional services from taxonomy with icons
  - Sorted by taxonomy sort column
  - Multi-select tiles
  - Selection persists on Back/Save & Exit
  - Next navigates to Invite Professionals
  - No minimum selection required
  - Mockup: `arco-wizard-professionals-2.png`

- [ ] **Step 10: Professionals - Invite Professionals**
  - Show each selected service as card
  - "Invite professional" button per card
  - Kebab menu: Edit email, Remove service, Cancel invite (if pending)
  - Floating "+" opens Add Professionals popup
  - Invites queued, sent when project published and approved
  - Mockup: `arco-wizard-professionals-3.png`

- [ ] **Popup: Add Professionals**
  - Show service + icon
  - Add company email input
  - Block common personal domains (gmail.com, hotmail.com) if enabled
  - Email validation
  - Remove previously added service
  - Mockup: `arco-wizard-professionals-3b.png`

- [ ] **Popup: Invite Professional**
  - Collect email address
  - Send button adds pending invite to service
  - Mockup: `arco-wizard-professionals-3b.png` (alt version)

- [ ] **Step 11: Finalize**
  - Project thumbnail preview
  - Click thumbnail → listing preview in new screen
  - "Publish" button
  - Final validation on publish
  - Success toast
  - Navigate to Listings with status "In review"
  - Mockup: `arco-wizard-professionals-4.png`

---

#### F-27: Manage an existing project listing

**Listing Editor Features:**

- [ ] **Listings Page - View All Projects**
  - Project cards with: Image, Title, Status, Role, Actions
  - Statuses: In Progress, In Review, Invited, Live on Page, Listed, Unlisted, Rejected
  - Roles: Project Owner, Contributor
  - Filter by: Status, Role, Year
  - Search by: Title, Sub-type
  - Click card or "Edit listing" → Listing Editor (if Live/Listed/Unlisted)
  - Draft status → List a Project Wizard
  - Click Status label or "Update status" → Listing Status Popup
  - "Edit cover image" → Cover Photo Popup
  - Delete listing confirmation (soft-delete)
  - Color-coded status chips
  - Auto-refresh on wizard save
  - Component: `app/dashboard/page.tsx` → Listings section
  - Mockups: `image 10.png`, `1756516771921-i714cox.png`

- [ ] **Listing Editor Drawer**
  - Navigation tabs: Photo Tour, Professionals, Details, Location
  - Status label above nav (click → Listing Status Popup)
  - Mobile: Hamburger menu for nav
  - "Save Changes" button (applies edits immediately)
  - "Request Re-Review" button (if Rejected status)
  - Close with unsaved changes warning
  - Component: `components/dashboard/ListingEditor.tsx`

- [ ] **Listing Editor - Photo Tour Tab**
  - Feature cards with photos count or "Add photos"
  - Click feature card → Room Editor Popup
  - Click "Add Photo" link → Add Photo Popup
  - "+" button → Add Feature Popup
  - First feature: "Building" (holds unassociated images)
  - Only features with ≥1 photo shown on PDP
  - Mockups: `1756516786951-p41ukg0.png`, `image 14.png`

- [ ] **Listing Editor - Professionals Tab**
  - List professionals added in wizard
  - Show: Email or Company name, Status (Listing owner, Invite sent, Listed, Unlisted, Removed)
  - "Invite Professional" button → Add Professional Popup
  - Add button (plus icon) → Add Professional Service Popup
  - Mockup: `1756516786956-xuo43pn.png`

- [ ] **Listing Editor - Details Tab**
  - Update listing details form
  - Same fields as wizard steps
  - Mockup: `image 20.png`

- [ ] **Listing Editor - Location Tab**
  - Address bar with autocomplete
  - Map showing selected address
  - "Share exact location" toggle
  - Mockup: `1756516786965-1m75qjh.png`

- [ ] **Popup: Add Feature**
  - Show selected features
  - Add/remove features via checkboxes
  - Mockup: `image 15.png`

- [ ] **Popup: Add Photo**
  - Overview of all uploaded photos
  - Select one or multiple via checkboxes
  - Browse or drag-and-drop more images
  - Mockup: `image 16.png`

- [ ] **Popup: Room Editor**
  - Left panel: Feature cards with image and name
  - Right panel: Images for selected feature
  - First image tagged "Cover photo"
  - "+" button → Add Photo Popup
  - Per-image Action menu: Move to other feature, Remove from feature, Delete from project
  - Add tagline (displayed below feature title on PDP)
  - "Highlight feature" toggle (shows in Highlights section on PDP)
  - Delete feature with confirmation
  - Mockup: `image 17.png`

- [ ] **Popup: Add Professional**
  - Add email for selected professional service
  - Remove professional service
  - Mockup: `image 18.png`

- [ ] **Popup: Add Professional Service**
  - Select/deselect professional services
  - Updates professional cards on Professionals tab
  - Mockup: `image 19.png`

- [ ] **Popup: Listing Status**
  - Show: Image, Title, [Style] [Sub-type] in [Location]
  - Select listing status: Live on Page, Listed, Unlisted
  - Delete listing with confirmation (soft-delete)
  - Mockup: `image 11.png`

- [ ] **Popup: Listing Rejected**
  - Show: Image, Title, [Style] [Sub-type] in [Location]
  - Display rejection note
  - "Edit Listing" → List a Project Wizard
  - Delete listing with confirmation (soft-delete)
  - Mockup: `image 12.png`

- [ ] **Popup: Cover Photo**
  - Select photo from project images
  - Will be displayed in "Your Projects" section and on Company Page
  - Mockup: `image 13.png`

---

## 📊 Feature Summary Statistics

**Total Features:** 31 major features + 28 sub-features/popups
**Authentication Required:** 18 features
**Anonymous Access:** 9 features
**Admin Dependent:** 1 feature (project approval)

---

## 🗄️ Database Tables Used by Homeowner Features

- `profiles` - User profile data (user_type: 'client')
- `projects` - Project listings
- `project_photos` - Project images with features
- `project_categories` - Project category relationships
- `categories` - Taxonomy data
- `saved_projects` - Favorited projects
- `saved_professionals` - Favorited professionals
- `professionals` - Professional/company data
- `companies` - Company profiles (if user creates company account)
- `reviews` - Professional reviews
- `notifications` - User notifications (future)
- `messages` - Project-based messaging (future)

---

## 🎯 Success Criteria

**Phase 1-3:** Homeowner can browse and discover projects/professionals anonymously
**Phase 4:** Homeowner can save favorites and manage profile
**Phase 5:** Homeowner can upgrade to professional/company account
**Phase 6:** Homeowner can engage (like, review)
**Phase 7:** Homeowner can list and manage their own completed projects

---

## 📝 Notes

- **Context Preservation:** Critical requirement - auth flow must preserve user context (filters, scroll, pending actions)
- **Validation:** All forms require inline validation without clearing inputs
- **Taxonomies:** Most dropdowns/selections source from `categories` table with sorting
- **Photo Management:** Minimum 5 photos per project, features with 0 photos hidden on PDP
- **Professional Invites:** Queued until project approved and published
- **Status Flow:** Draft → In Review (admin approval) → Live/Listed/Unlisted
- **Autosave:** Wizard autosaves every 30 seconds and on step change
- **Email Validation:** Block personal domains for professional invites if configured