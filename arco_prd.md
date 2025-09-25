# Arco Project Readout

## Landing (SCR-LND-001)

**Component Path**: `app/page.tsx` (landing page)

### Functional Requirements
* User can click thru to the Discover Page from nav links.
* User can click to sign up or log in.
* User can type a search query through the search bar widget, navigating the user to the Discover Page.
* User can click on a category block to navigate to the Discover page with projects filtered for that Feature Category.

### User Flows
* Discover projects from the Landing page

### Acceptance Criteria
* Given an unauthenticated visitor loads the site, when the header renders, then show nav items Discover, List with Us, Log In/Sign Up (and hide Saved/Account/Log out).
* Given the hero Search bar has non-empty input, when the user presses Enter or clicks the Search CTA, then navigate to Discover (Projects tab) with the query applied and visible in the Discover search field.

-----

## Discover (SCR-DISC-002)

**Component Path**: `app/discover/page.tsx` (discover page with tabs)

### Functional Requirements
* Visitors and Registered users can browse Projects and Professionals using a two-tab layout.

-----

### Projects (SCR-DISC-PROJ-003)

**Component Path**: `app/discover/projects/page.tsx` (projects tab component)

### Functional Requirements
* User can type in the Keyword Search bar to match Project Title, Slug, Features, Materials, and other metadata.
* User can click Sort and choose Popularity or Newest.
* User can click a Project Card (image or title) to open the Project Detail Page in a new tab.
* User can switch to the Projects tab.
* User can type in the Keyword Search bar to match Project Title, Slug, Features, Materials, and other metadata.
* User can click Filters to expand/collapse the filters panel (mobile: opens drawer).
* User can click Sort and choose Popularity or Newest; system will re-order results accordingly.
* User can see active filter chips above results and click each chip’s “x” to remove it, or click Clear All to reset all filters.
* User can scroll the Results Grid of project cards (thumbnail, Title, Sub-type, Year, key Feature/Material pills).
* User can click a Project Card (image or title) to open the Project Detail Page in a new tab.
* User can click the Save/Favorite (heart) on a card (unauth → Login > Sign Up, then return to context).
* System will lazy-load more results on scroll (infinite load) and show skeleton loaders while fetching.
* User can apply filters by Project Type and Sub-Type (multi-select).
* User can apply filters by Style (multi-select).
* User can apply filters by Building Type (multi-select).
* User can apply filters by Location Features (multi-select), e.g., Waterfront, Mountain, Urban Core.
* User can apply filters by Features (multi-select).
* User can apply filters by Size (multi-select buckets), e.g., <1k sq ft, 1–5k, 5–10k, 10k+.
* User can apply filters by Budget (multi-select buckets), e.g., <$250k, $250–500k, $500k–$1M, $1M+.
* User can apply filters by Project Year (range: From / To).
* User can apply filters by Building Year (range: From / To).
* User can apply filters by Materials (multi-select).
* User can see results update immediately when a filter changes (no explicit “Apply” required).
* User can see a results count reflecting the current filter set.

### User Flows
* Discover projects from the Landing page
* Search & filter projects (keyword + facets)
* Sort project results (popularity/newest)
* Open a project detail

### Acceptance Criteria
* Given an unauthenticated visitor loads the site, when the header renders, then show nav items Discover, List with Us, Log In/Sign Up (and hide Saved/Account/Log out).
* Given the hero Search bar has non-empty input, when the user presses Enter or clicks the Search CTA, then navigate to Discover (Projects tab) with the query applied and visible in the Discover search field.
* Given the search input is non-empty, when the user submits, then filter results by keyword across Title, Slug, Features, Materials; when the field is cleared, then remove the keyword filter.
* Given sort controls are present, when the user selects Popularity or Newest, then reorder results without clearing search/filters.
* Given the page renders, when breadcrumbs are built, then show Projects > {Location} > {Type} > {Sub-type} > {Title} with ancestor crumbs linking to Discover pre-filtered; long labels truncate with tooltip.

### Professionals (SCR-DISC-PROF-004)

**Component Path**: `app/discover/professionals/page.tsx` (professionals tab component)

### Functional Requirements
* User can type in the Keyword Search bar to match Company Name or Services.
* User can click Sort (A–Z or Most Projects).
* User can switch to the Professionals tab (cards show Logo, Company Name, Location).
* User can type in the Keyword Search bar to match Company Name or Services.
* User can click Filters to expand/collapse the panel (mobile: drawer).
* User can click Sort (A–Z or Most Projects); system will re-order results accordingly.
* User can click a Professional Card to open the Professional Detail Page in a new tab.
* User can click Save Professional (bookmark) on a card (unauth → Login > Sign Up, then return).
* User can apply filters by Service Category (multi-select).
* User can apply filters by Plan Tier (Starter, Growth, Pro, if enabled).
* User can apply filters by Location (Country and State/Region).
* User can see active filters displayed as chips.
* User can clear all filters with a single action.

### User Flows
* Browse the professionals directory

### Acceptance Criteria
* Given the Professionals tab is selected, when the page renders, then provide keyword search over Company Name, Services with debounce.

## Project Detail (SCR-PDP-005)

**Component Path**: `app/projects/[id]/page.tsx` (project detail page)

### Functional Requirements
* User can click View All Photos to open the Gallery Lightbox.
* User can view a Multi-Image Header (shows the first 3 uploaded images on desktop; swipeable on mobile).
* User can click View All Photos (button over the header) → system will open the Gallery Lightbox with all images, captions, and next/prev controls.
* User can read Title, Location (if provided), Year, Type/Sub-type, and the Overview rich-text.
* User can view metadata blocks: Features (pills), Materials (pills), Size (if provided; display as a labeled value or pill), and Budget (if provided; display as a labeled value or pill).
* User can click Save/Favorite (heart) (unauth → Login > Sign Up, then return and complete the save).
* User can click Share to open the Share modal (Copy Link, native share if available).
* User can view the Professionals Section (logo + company name chips); clicking a chip navigates to the Professional Detail Page.
* User can scroll to Similar Projects (carousel or grid) and click a card to open that Project Detail.
* System will lazy-load images, track views, and render structured data for SEO.

### User Flows
* Open a project detail
* Navigate to related projects
* Share a project
* View project image gallery (lightbox)
* Jump to professionals from a project
* Save/Like prompts sign-up (from anonymous)
* Save (favorite) a project

### Acceptance Criteria
* Given the page renders, when breadcrumbs are built, then show Projects > {Location} > {Type} > {Sub-type} > {Title} with ancestor crumbs linking to Discover pre-filtered; long labels truncate with tooltip.
* Given the Images Header displays, when a user clicks any image or View all photos (N), then open Images Overview (modal).
* Given similar items exist, when loading Similar Projects, then show same Sub-type & Style sorted by likes; links open in new tab.
* Given professionals are attached, when rendered, then show Logo, Name, Role (and Plan Tier/Verified if applicable); Visit opens Company Page/external site; Show all opens a list popup; Report opens mailto.
* Given an unauthenticated user triggers a gated action (Save, Like, Write a review), when authentication is required, then show the Auth modal (or redirect to Auth page) and persist return context (tab, filters, sort, scroll, image index, and pending action).
* Given Saved Projects list, when loaded, then show cards with Thumb, Title, Sub-type, Year, heart; toggling the heart removes/adds; filters (Sub-type, Year) and keyword over Title work.

-----

### Images Overview (Lightbox) (SCR-PDP-IMG-OVERVIEW-006)

**Component Path**: `components/project/ImageLightbox.tsx` (image gallery modal)

### Functional Requirements
* User can navigate images via Next/Prev controls, keyboard arrows, or swipe on touch.
* User can toggle captions (if available).
* User can close the Lightbox (close icon, ESC key, or backdrop click) and return to the Project Detail Page.
* System will trap keyboard focus in the overlay and lock background scroll while open.

### User Flows
* View project image gallery (lightbox)

### Acceptance Criteria
* Given the Images Header displays, when a user clicks any image or View all photos (N), then open Images Overview (modal).

#### Image Detail (SCR-PDP-IMG-DETAIL-007)

**Component Path**: `components/project/ImageDetail.tsx` (individual image in lightbox)

### User Flows
* View project image gallery (lightbox)

### Acceptance Criteria
* Given the Images Header displays, when a user clicks any image or View all photos (N), then open Images Overview (modal).

### Share (SCR-PDP-SHARE-008)

**Component Path**: `components/project/ShareModal.tsx` (share modal component)

### Functional Requirements
* User can click Share to open the Share modal.

### User Flows
* Share a project

## Professional Detail (Company Page) (SCR-CP-009)

**Component Path**: `app/professionals/[id]/page.tsx` (professional detail page)

### Functional Requirements
* User can click 'Write a review' which requires authentication.
* User can view professional information on the company page.
* User can navigate using a breadcrumb with clickable links.
* User can use a Share button to share the page.
* User can use a Save button to save the professional to the professionals tab of their account.
* User can click on the rating and number of ratings to scroll to the reviews section.
* User can click social icons that are visible when links are added to the company account.
* User can click Show phone number link to reveal the phone number.
* User can click the website link to open the professional’s external site.
* User can click the Contact button to open an email to the professional.
* User can see the number of projects in the Projects section title.
* User can sort projects in the Projects section.
* User can navigate projects with pagination, which scrolls to the top of the Projects section when changed.
* User can view the Meet the professional section.
* User can see the rating and number of reviews in the Reviews section title.
* User can see a summary of ratings and sub-ratings in the Reviews section.
* User can click Show more or Show all X reviews to open a Reviews pop-up (TBD).
* User can click Write a review to open a Write a review pop-up.
* User can only see reviews once they are approved in the admin account.

### User Flows
* Jump to professionals from a project
* Save (favorite) a professional
* User — Write a review for a professional

### Acceptance Criteria
* Given professionals are attached, when rendered, then show Logo, Name, Role (and Plan Tier/Verified if applicable); Visit opens Company Page/external site; Show all opens a list popup; Report opens mailto.
* Given Saved Professionals, when loaded, then show Logo, Name, Location, bookmark; toggling removes/adds; Service Category filter and keyword over Name work.
* Given an unauthenticated user triggers a gated action (Save, Like, Write a review), when authentication is required, then show the Auth modal (or redirect to Auth page) and persist return context (tab, filters, sort, scroll, image index, and pending action).

-----

### Contact Professional (SCR-CP-CONTACT-010)

### Functional Requirements
* User can click 'Contact Professional' to open an email client or contact modal.

### Write Review (SCR-CP-REVIEW-011)

**Component Path**: `components/professional/WriteReviewModal.tsx` (review form modal)

### Functional Requirements
* User can rate overall experience with a professional using a star rating.
* User can enter a short text summary of their overall experience.
* User can indicate whether any work was carried out (Yes/No).
* User can rate specific areas including Quality of Work, Reliability, and Communication using star ratings.
* User can enter additional written feedback in a text box (up to 500 characters).
* User can cancel or submit the review.

### User Flows
* User — Write a review for a professional

### Acceptance Criteria
* Given an unauthenticated user triggers a gated action (Save, Like, Write a review), when authentication is required, then show the Auth modal (or redirect to Auth page) and persist return context (tab, filters, sort, scroll, image index, and pending action).

## Auth (SCR-AUTH-010)

**Component Path**: `components/auth/AuthModal.tsx` (authentication modal)

### User Flows
* Save/Like prompts sign-up (from anonymous)

### Acceptance Criteria
* Given an unauthenticated user triggers a gated action (Save, Like, Write a review), when authentication is required, then show the Auth modal (or redirect to Auth page) and persist return context (tab, filters, sort, scroll, image index, and pending action).

-----

### Login (SCR-LOGIN-011)

**Component Path**: `components/auth/LoginForm.tsx` (login form component)

### User Flows
* Save/Like prompts sign-up (from anonymous)
* Log in / Log out

### Acceptance Criteria
* Given an unauthenticated user triggers a gated action (Save, Like, Write a review), when authentication is required, then show the Auth modal (or redirect to Auth page) and persist return context (tab, filters, sort, scroll, image index, and pending action).
* Given valid credentials or a successful sign up, when auth completes, then return the user to the exact pre-auth context and complete the pending action automatically (e.g., the Like is applied, Save toggled, Review composer opens).

### Sign Up (SCR-SIGNUP-012)

**Component Path**: `components/auth/SignUpForm.tsx` (signup form component)

### User Flows
* Create an account (sign up)

### Acceptance Criteria
* Given the Sign Up form, when the user submits, then validate required fields (email format, password rules, ToS/Privacy consent if required) and surface inline errors without clearing inputs.

### Verification (SCR-VERIFY-013)

## User Portal (SCR-UP-014)

### Functional Requirements
* User can logged-in Homeowner users manage their projects and favorites here. The sidebar order is: Listings → Saved Projects → Saved Professionals → Account Settings
* User can if the user also has a Professional account, a Role Switcher appears in the header to toggle between Homeowner and Professional Dashboard modes (state persists across sessions).

-----

### Listings (SCR-UP-LIST-015)

**Component Path**: `app/dashboard/listings/page.tsx` (user project listings)

### Functional Requirements
* User can view all personal projects in a table with columns Title, Sub-type, Status, Last Edited, Admin Feedback, Actions.
* User can click Add Project to launch the List a Project Wizard.
* User can view all personal projects in a table with columns Title, Sub-type, Status (In Progress · In Review · Live · Rejected), Last Edited (date), Admin Feedback (icon), Actions.
* User can click Add Project to launch the List a Project wizard (opens at Step 1 – Details).
* User can click a row to open the Inline Listing Editor drawer if the status is Live or Rejected; drafts still open the full wizard.
* User can filter by Status, Sub-type, Year; system will remember last-used filters.
* User can search by Title or Sub-type via the keyword Search box.
* User can click the Admin Feedback icon on a Rejected listing to view the rejection reason.
* User can delete an In Progress or Rejected listing (Delete action) after confirmation; system will soft-delete and refresh the table.
* System will color-code status chips and auto-refresh the list when a wizard save occurs.

### User Flows
* Log in / Log out
* Homeowner — Manage an existing project listing

### Acceptance Criteria
* Given valid credentials or a successful sign up, when auth completes, then return the user to the exact pre-auth context and complete the pending action automatically (e.g., the Like is applied, Save toggled, Review composer opens).
* Given a user clicks on a project with status Live or Rejected on the Listings [Page], then the Listing Editor [Drawer] must open.

#### Listing Editor (SCR-UP-LIST-EDIT-017)

**Component Path**: `components/dashboard/ListingEditor.tsx` (inline project editor drawer)

### Functional Requirements
* User can edit Title, Overview, Feature Tags, and Cover Image for a Live or Rejected project.
* User can click Save Changes; system will apply edits to the live listing immediately.
* User can click Request Re-Review on a Rejected listing; system will change status to In Review and notify admins.
* User can close the drawer; system will warn if there are unsaved changes.

### User Flows
* Homeowner — Manage an existing project listing
* Admin — Edit an existing project

### Acceptance Criteria
* Given the list loads, when rendering rows, then show Featured (toggle), Project Title, Sub-type, Features (first 5 + “+N”), Year, Date Created with Title linking to public detail.
* Given a user clicks on a project with status Live or Rejected on the Listings [Page], then the Listing Editor [Drawer] must open.

### Saved Projects (SCR-UP-SAVED-PROJ-018)

**Component Path**: `app/dashboard/saved/projects/page.tsx` (saved projects list)

### Functional Requirements
* User can view saved projects as cards and unfavorite them via a heart icon.
* User can view saved projects as cards (image, title, Sub-type, Year).
* User can click a card to open the public Project Detail in a new tab.
* User can unfavorite a project via the heart icon; system will remove the card with a fade animation.
* User can filter by Sub-type or Year, and search by Title.
* System will display an empty-state illustration if no items are saved.

### User Flows
* Save (favorite) a project
* View & manage Saved Projects
* Create an account (sign up)

### Acceptance Criteria
* Given the Sign Up form, when the user submits, then validate required fields (email format, password rules, ToS/Privacy consent if required) and surface inline errors without clearing inputs.
* Given Saved Projects list, when loaded, then show cards with Thumb, Title, Sub-type, Year, heart; toggling the heart removes/adds; filters (Sub-type, Year) and keyword over Title work.

### Saved Professionals (SCR-UP-SAVED-PROF-019)

**Component Path**: `app/dashboard/saved/professionals/page.tsx` (saved professionals list)

### Functional Requirements
* User can view saved professionals in a card grid (logo, company name, location).
* User can open a professional’s Company Page in a new tab by clicking the card.
* User can remove a professional from Saved via the bookmark icon; system will animate removal.
* User can filter by Service Category and search by Company Name.

### User Flows
* View & manage Saved Professionals
* Save (favorite) a professional

### Acceptance Criteria
* Given Saved Professionals, when loaded, then show Logo, Name, Location, bookmark; toggling removes/adds; Service Category filter and keyword over Name work.

### Account Settings (SCR-UP-ACCT-020)

**Component Path**: `app/dashboard/settings/page.tsx` (account settings form)

### Functional Requirements
* User can update First Name, Last Name, Display Name, Profile Photo, Phone.
* User can enter Current Password, New Password, Confirm New Password.
* User can click Save Password; system will enforce rules, log the user out of other sessions, and confirm change.

### User Flows
* Edit profile & change password

### Acceptance Criteria
* Given Profile form, when saving, then require First/Last Name, validate Photo type, and toast success; photo upload supports replace.

## List a Project — Wizard (SCR-UP-LIST-WIZ-016)

**Component Path**: `components/project/ProjectWizard.tsx` (multi-step project creation wizard)

### Functional Requirements
* User can click Add Project to launch the List a Project wizard.
* Wizard presents steps: Intro & Project Type → Location & Materials → Details → Photo Tour → Review & Submit.
* Wizard enforces per-step required fields and inline validation; Next is disabled until requirements are met.
* User can save progress as Draft at any step; progress persists when returning to the wizard.
* Photo Tour supports multi-file upload via click or drag-and-drop; user can reorder and remove photos.
* Review & Submit step shows a summary of entered data; on Submit, system creates a Listing and adds it to the admin approval queue.
* Wizard shows a stepper with step names; Back/Next navigation preserves inputs and supports returning to prior steps.
* System autosaves on step change and periodically while editing to prevent data loss.
* “Questions?” opens the external help page in a new tab/window.
* Save & Exit returns to Listings with status In progress; if no photos exist, show gray placeholder thumbnail.
* Every step shows a Back button to go to prior step without losing data.
* Stepper highlights current step and prevents skipping required fields.
* Autosave on step change and every 30 seconds when there are unsaved changes.

### User Flows
* Admin — Create a new project (multi-step)

### Acceptance Criteria
* Given row actions, when used, then provide Create Project (admin Create/Edit wizard) and Edit (open wizard to last step); preserve context on return.

-----

### Wizard — Project Details: Project Type (SCR-UP-LIST-WIZ-016-PD-TYPE)

**Component Path**: `components/project/wizard/ProjectTypeStep.tsx` (project type selection step)

### Functional Requirements
* User selects Project type (required).
* All four selections (Category, Project type, Building type, Project style) are required before Next.
* User selects Category (required).
* User selects Building type (required).
* User selects Project style (required).

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Project Details: Location & Materials (SCR-UP-LIST-WIZ-016-PD-LOC-MAT)

**Component Path**: `components/project/wizard/LocationMaterialsStep.tsx` (location and materials selection)

### Functional Requirements
* User selects Location features (checkbox group; at least one required).
* User selects Material features (checkbox group; at least one required).

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Project Details: Details (SCR-UP-LIST-WIZ-016-PD-DETAILS)

**Component Path**: `components/project/wizard/ProjectDetailsStep.tsx` (size, budget, year inputs)

### Functional Requirements
* User selects Size (required; taxonomy or range list).
* User selects Budget (required; predefined ranges).
* User enters Year built (required, 4-digit).
* User enters Building year (required, 4-digit; original construction year if different).

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Project Details: Name & Description (SCR-UP-LIST-WIZ-016-PD-NAME-DESC)

**Component Path**: `components/project/wizard/NameDescriptionStep.tsx` (title and description inputs)

### Functional Requirements
* Project title is required (max 120 characters) with live character meter.
* Project description is required (min 80 characters) with rich-text basics and word/character count.

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Project Details: Location (Confirm) (SCR-UP-LIST-WIZ-016-PD-LOCATION)

**Component Path**: `components/project/wizard/LocationConfirmStep.tsx` (address autocomplete and map)

### Functional Requirements
* Address autocomplete (Google Places) and draggable map pin; store lat/lng plus formatted address.
* Share exact location toggle controls public masking (city/region only when off).

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Photo Tour: Add Photos (SCR-UP-LIST-WIZ-016-PT-ADD-PHOTOS)

**Component Path**: `components/project/wizard/AddPhotosStep.tsx` (photo upload interface)

### Functional Requirements
* Drag-and-drop or click to upload JPG/PNG; show each file as it uploads (no need to wait for all).
* Per-photo menu allows 'Set cover photo' and 'Delete'.
* User must upload at least 5 photos to proceed; show counter and disable Next until ≥5.

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Photo Tour: Choose Features (SCR-UP-LIST-WIZ-016-PT-ADD-FEATURES)

**Component Path**: `components/project/wizard/ChooseFeaturesStep.tsx` (feature selection interface)

### Functional Requirements
* Show features sorted by Xano.sort; default Building first; Additional photos last.
* Each feature shows Select photos; opens Select Photos popup.
* Add photos & Add features open their popups.
* Display available features (e.g., Bedroom, Bathroom) as selectable tiles with icons from taxonomy; multi-select allowed.
* Selections persist on Back/Save & Exit; Next navigates to Features List.

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Photo Tour: Features List (SCR-UP-LIST-WIZ-016-PT-FEATURES)

**Component Path**: `components/project/wizard/FeaturesListStep.tsx` (selected features with photo assignment)

### Functional Requirements
* List selected features as cards; each shows 'Select photos' which opens the Select Photos modal.
* Floating action button '+' opens menu: 'Add photos' (global upload) and 'Add feature' (open Add Features popup).
* Only features with photos will be published; show this message above the grid.
* Complete button finishes the Photo Tour section; remain enabled when overall photo minimum is met.

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Photo Tour: Select Photos (SCR-UP-LIST-WIZ-016-PT-SELECT-PHOTOS)

**Component Path**: `components/project/wizard/SelectPhotosModal.tsx` (photo selection modal for features)

### Functional Requirements
* Header shows current feature name.
* User can upload new photos in-place (drop zone + 'Browse files').
* Select from existing photos pool with check toggles; selected count shown in Save button (e.g., 'Save Selection (2)').
* Per-photo action: 'Set as cover' for the feature; only one cover per feature.
* Top-right 'Delete feature' removes the feature; its photos remain in the pool.

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Photo Tour: Add Photos (Popup) (SCR-UP-LIST-WIZ-016-PT-ADD-PHOTOS-POPUP)

### Functional Requirements
* Upload additional photos to the global pool; same validations as the Add Photos step.

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Photo Tour: Add Features (Popup) (SCR-UP-LIST-WIZ-016-PT-ADD-FEATURES-POPUP)

### Functional Requirements
* List remaining features from taxonomy that are not yet selected; allow adding them to the project.

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Professionals: Add Professionals (SCR-UP-LIST-WIZ-016-PRO-ADD)

**Component Path**: `components/project/wizard/AddProfessionalsStep.tsx` (professional services selection)

### Functional Requirements
* Display professional services from Xano with icons, sorted by the 'sort' column.
* Users select one or more services via tiles (multi-select). Selection persists on Back/Save & Exit.
* Next navigates to Invite Professionals; no minimum selection required.

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Professionals: Invite Professionals (SCR-UP-LIST-WIZ-016-PRO-INVITE)

**Component Path**: `components/project/wizard/InviteProfessionalsStep.tsx` (professional invitation interface)

### Functional Requirements
* Show each selected service as a card; card contains an 'Invite professional' button.
* Kebab menu per card opens Update Professional popup with actions: Edit email, Remove service, Cancel invite (if pending).
* Floating '+' opens menu to Add professionals (popup).
* Invites are queued and will be sent when the project is published and approved.

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Professionals: Add Professionals (Popup) (SCR-UP-LIST-WIZ-016-PRO-ADD-POPUP)

**Component Path**: `components/project/wizard/AddProfessionalModal.tsx` (add professional email modal)

### Functional Requirements
* Show service + icon; user adds a company email.
* Block common personal domains (e.g., gmail.com, hotmail.com) if enabled.
* Remove a previously added service.

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Professionals: Invite Professionals (Popup) (SCR-UP-LIST-WIZ-016-PRO-INV-POPUP)

**Component Path**: `components/project/wizard/InviteProfessionalModal.tsx` (invite professional email modal)

### Functional Requirements
* Invite Professional modal collects an email address; Send adds a pending invite to the selected service.

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Finalize (SCR-UP-LIST-WIZ-016-FINALIZE)

**Component Path**: `components/project/wizard/FinalizeStep.tsx` (project review and publish)

### Functional Requirements
* Clicking the project thumbnail opens listing preview in a new screen.
* Publish takes the user to Listings where the listing is shown with the status ● In review.
* On publish, run final validation and show a success toast.

### User Flows
* Homeowner — List a new project (multi-step wizard)

### Acceptance Criteria
* Next is disabled until Category, Project type, Building type, and Project style are selected.
* All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
* Feature groups populate from Xano Taxonomies with icons and are sorted by 'sort'.
* At least one selection is required in each group; show inline error if none selected.
* Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
* Building year must be less than or equal to Year built; show inline error otherwise.
* Next is disabled until Size, Budget, Year built, and Building year are all valid.
* Next is disabled until both Title and Description meet validation constraints.
* Character counters update live; invalid states show inline messages.
* Complete is disabled until a valid address is selected on the map/autocomplete.
* Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
* Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
* When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
* Next is enabled even if zero services are selected.
* If the domain matches a company account, show company name + primary service; otherwise display the email.
* Email must be valid; optionally block configured personal domains (e.g., gmail.com).
* Selections persist when navigating Back or using Save & Exit.
* Selections persist on Back and Save & Exit.
* Map and toggle state persist on Back and Save & Exit.
* Tile selection state persists across navigation and Save & Exit.

### Wizard — Professionals: Update Professional (Popup) (SCR-UP-LIST-WIZ-016-PRO-UPDATE-POPUP)

**Component Path**: `components/project/wizard/UpdateProfessionalModal.tsx` (update professional details modal)

### Functional Requirements
* Update professional email.
* Remove service or cancel invite.

## Professional Dashboard (SCR-PROF-DASH-021)

**Component Path**: `app/dashboard/professional/page.tsx` (professional dashboard layout)

### User Flows
* Professional — Edit company profile & settings
* Professional — Manage company photos
* Professional — Manage company status

### Acceptance Criteria
* Given a user is on the Company Profile / Settings [Page], when they modify profile data and click Save, then the system must persist the changes and display a success confirmation.
* Given a user drags an image thumbnail to a new position, then the new order must be persisted immediately and reflected on the public Company Page.
* Given a user clicks Deactivate and confirms the action, then the company status must be set to Deactivated and the public page must become inaccessible.

-----

### Company Profile / Settings (SCR-PROF-PROFILE-022)

**Component Path**: `app/dashboard/professional/settings/page.tsx` (company profile settings)

### Functional Requirements
* User can view and change company status:
* User can unlisted links to the Plans page with an upgrade banner.
* User can listed links to the company page in a new screen.
* User can deactivated links to the bottom of the Profile page where the company can be activated.
* System will display the correct status (Unlisted, Listed, Deactivated) based on the company’s subscription and account state.
* System will update the status immediately after a change (no refresh required).
* User can see an upgrade banner if their plan does not include a company page.
* System will hide the upgrade banner once a plan with a company page is active.
* User can upload and update the company logo.
* System will validate logo file format (JPG, PNG, SVG) and size limits.
* User can update the company name.
* System will prevent duplicate company names if restricted by platform rules.
* User can update the company description.
* System will save and display the updated description on the public page.
* User can update contact information including domain, email, phone, and address.
* System will validate email and domain formats, and restrict domain changes if tied to account ownership.
* User can add social links (Facebook, Instagram, LinkedIn, Pinterest).
* System will validate social link formats and display only when a link is added.
* User can update services and features including primary service, other services, languages, and certificates.
* System will show multi-select options from a controlled list (services, languages, certificates).
* User can add and edit a custom domain for their company page.
* System will validate custom domain format and enforce character limits.
* User can deactivate their company account.
* User can reactivate their company account when deactivated.
* System will show “Deactivate” option only when the account is active, and “Activate” option only when the account is deactivated.

### User Flows
* Professional — Edit company profile & settings
* Professional — Manage company photos
* Professional — Manage company status

### Acceptance Criteria
* Given a user is on the Company Profile / Settings [Page], when they modify profile data and click Save, then the system must persist the changes and display a success confirmation.
* Given a user drags an image thumbnail to a new position, then the new order must be persisted immediately and reflected on the public Company Page.
* Given a user clicks Deactivate and confirms the action, then the company status must be set to Deactivated and the public page must become inaccessible.

### Company Listings (SCR-PROF-LIST-023)

**Component Path**: `app/dashboard/professional/listings/page.tsx` (company project listings)

### Company Photos (SCR-CUST-001)

**Component Path**: `app/dashboard/professional/photos/page.tsx` (company photo management)

### Functional Requirements
* User can upload up to 5 photos via drag-and-drop or browse.
* System will enforce the maximum of 5 photos and show an error if the limit is exceeded.
* System will validate photo file types and size before upload.
* User can set any uploaded photo as the cover photo.
* System will display the selected cover photo prominently on the company page and in search results.
* User can delete uploaded photos.
* System will confirm deletion before removing a photo.
* User can view which photo is currently set as cover.
* System will visually indicate the cover photo with a label or marker.

## List With Us (SCR-LWU-024)

**Component Path**: `app/list-with-us/page.tsx` (professional signup landing page)

### Functional Requirements
* Users can scroll through a header image with main message
* Users can scroll through of professionals
* Users can scroll through 4 benefits with a visual
* Users can click through testimonials
* Users can scroll through how to list your project
* Users can scroll through a call to action a banner
* Users can click a ‘Get started’ button, navigating to sign up

### User Flows
* Start “List with Us”

### Acceptance Criteria
* Given a user clicks Get Started, when activated, then open the Professional Signup popup and set focus to the first field; closing the popup returns focus to the CTA.

-----

### Professional Signup (SCR-LWU-POPUP-025)

### Functional Requirements
* User can click a ‘Get started’ button, opening a popup with the Professional signup form.

### User Flows
* Start “List with Us”
* Create an account (sign up)

### Acceptance Criteria
* Given the Sign Up form, when the user submits, then validate required fields (email format, password rules, ToS/Privacy consent if required) and surface inline errors without clearing inputs.
* Given a user clicks Get Started, when activated, then open the Professional Signup popup and set focus to the first field; closing the popup returns focus to the CTA.

## Admin Portal (SCR-ADMIN-026)

**Component Path**: `app/admin/page.tsx` (admin dashboard layout)

-----

### Project Approval (SCR-ADMIN-PROJ-APPROVAL-027)

### Functional Requirements
* User can view a “Pending Projects” table with columns Project Title, Sub-type, Owner, Submitted On, Status.
* User can view a “Pending Projects” table with columns Project Title, Sub-type, Owner (email), Submitted On, Status (Pending / Rejected).
* User can click a row to open the full Project Detail page in a new tab.
* User can click Approve (button in row) → system will set status to Live, publish instantly, remove the row, and notify the owner by email.
* User can click Reject → system will open a Reject Modal with a required Reason textarea; on confirm the project status becomes Rejected, row disappears, owner receives the reason.
* User can multi-select rows and use the Bulk Approve / Bulk Reject buttons (top bar).
* User can filter the queue by Status, Date Range, Sub-type, and Owner email (dropdown + date picker + text input).
* User can type in a keyword search field (top right) to match project title or owner.
* System will paginate 25 rows per page, remember the admin’s last-used filters in local storage, and auto-refresh the table every 60 s.

### Projects (SCR-ADMIN-PROJS-028)

**Component Path**: `app/admin/projects/page.tsx` (admin project management)

### Functional Requirements
* User can view a table of all projects with columns Featured (toggle), Project Title, Sub-type, Features, Year, Created On.
* User can view a table of all projects with columns Featured (toggle), Project Title, Sub-type, Features (pill list), Year, Created On.
* User can click the Featured toggle in any row; system will immediately add/remove that project from the Home/Discover “Featured Projects” carousel, update the toggle icon, and persist the change.
* User can click the SEO View toggle (top right) to switch the table to columns Slug, Meta Title, Meta Description, SEO Status; clicking again returns to the main view.
* User can filter projects by Location (multi-select country/state), Feature tags, Style, Category, Date Created (range picker).
* User can type in a search box to search project Title, Slug, or Features (debounced, case-insensitive).
* User can click any project row (title link) to open the Project Detail admin preview in a new tab.
* User can click Create Project (primary button above table) to open the Create/Edit Project wizard on Step 1.
* User can click the Edit icon in a row to open that project in the wizard, landing on the last-saved step.
* System will show a badge count of projects currently filtered, remember column widths, and export the table to CSV via the overflow menu.

### User Flows
* Admin — Create a new project (multi-step)
* Admin — Edit an existing project
* Admin — Manage Featured projects

### Acceptance Criteria
* Given row actions, when used, then provide Create Project (admin Create/Edit wizard) and Edit (open wizard to last step); preserve context on return.
* Given the list loads, when rendering rows, then show Featured (toggle), Project Title, Sub-type, Features (first 5 + “+N”), Year, Date Created with Title linking to public detail.
* Given the Featured toggle, when switched ON, then add to Home → Featured (respect limits); when OFF, then remove; disallow toggling for non-Live with an explanatory tooltip; optimistic UI reverts on error.

#### Create / Edit Project — Wizard (SCR-ADMIN-PROJS-WIZ-029)

**Component Path**: `components/admin/AdminProjectWizard.tsx` (admin project creation/edit wizard)

### Professionals (SCR-ADMIN-PROF-030)

**Component Path**: `app/admin/professionals/page.tsx` (admin professional management)

### Functional Requirements
* User can view professionals in a table with columns for Company Name, Status, Projects Linked, and Plan Tier.
* User can view professionals in a table with Company Name, Status (Active / Inactive), Projects Linked (#), Plan Tier.
* User can filter by Status, Plan Tier, or keyword search (name, domain).
* User can click Create Professional to open a modal with fields Company Name, Logo, Website, Contact Email, Services (multi-select).
* User can edit a professional in a side panel; system will reflect changes instantly on the public Company Page.
* User can deactivate/reactivate a profile; system will hide/show the Company Page and unlink it from Discover results.

### User Flows
* Admin — Manage professionals

### Acceptance Criteria
* Given row actions, when used, then allow Edit…, Deactivate/Reactivate, and View public page with confirmations and success toasts.

### Taxonomies (SCR-ADMIN-TAX-031)

### Functional Requirements
* User can view existing Project Types and Sub-types in a two-column list.
* User can click Add Type or Add Sub-type, entering Name and optional Parent Type.
* User can rename an item inline; system will update all linked projects’ tags.
* User can toggle Retire; system will prevent selection in new projects but keep historical tagging.

### User Flows
* Admin — Manage taxonomies

### Reviews & Abuse Reports (SCR-ADMIN-REVIEWS-032)

### User Flows
* Admin — Moderate reviews

### Submissions / Leads (SCR-ADMIN-LEADS-033)

### Functional Requirements
* User can view “List With Us” submissions table with Company, Email, Services, Submitted On, Status.
* User can open a submission side panel to read details and internal notes.
* User can click Approve → system will create a draft Professional profile and email onboarding instructions.
* User can click Reject / Archive with optional note; system will store note and email the submitter.

### User Flows
* Admin — Moderate “List with Us” submissions

### Users (SCR-ADMIN-USERS-034)

**Component Path**: `app/admin/users/page.tsx` (admin user management)

### Functional Requirements
* A user with Super Admin privileges can view all admin users in a table with columns for Name, Email, Role, Status, and Actions.
* User can invite a new admin by entering Email and choosing Role (Admin / Super Admin); system will send an invitation email with activation link.
* User can deactivate/reactivate admins via toggle; system will immediately revoke or restore portal access.
* User can filter by Role or Status; system will prevent deactivation of the last Super Admin.

### User Flows
* Admin — Invite and manage admin users

### Acceptance Criteria
* Given actions, when used, then allow Invite Admin, Change role, Deactivate/Reactivate, and optional Reset password with confirmations and toasts; deactivation blocks login/API but preserves ownership.

