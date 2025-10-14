# Arco full PRD (Niek)

# Functionality by Screen

## Landing

**Component Path**: `app/page.tsx` (landing page)

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image.png>)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516719958-afzrgyz.png?alt=media&token=2c2a8499-46d3-453a-9ba2-61a02d81c361)

Functional Requirements

- User can click through hero images using the nav buttons. Images in the hero transition every 5 seconds. Users can click the project title in the hero image to navigate to the project’s detail page.
- Users can click the ‘Projects’ link next to the Arco logo to navigate to the Project Discover Page and the ‘Professionals’ link next to ‘Projects’ to navigate to the Professional Discover Page
- User can click on a Category block (i.e. house, kitchen & living) to navigate to the Project Discover page with projects filtered for that Category.
- User can click on Popular Projects to navigate to the specific Project Detail page. Or users can click the button ‘All Projects’ below the carrousel to navigate to the Project Discover page.
- User can click on a Professional services block (i.e. architect, gardener) to navigate to the Professional Discover Page with the Professionals filtered for that Professional Service.
- Users can Featured professionals to navigate to the Professional Detail page. Or users can click the button ‘All Professionals’ below the carrousel to navigate to the Professional Discover page.
- User can click on a Professional category block (i.e. design & planning, construction) to navigate to the Professional Discover Page with the Professionals filtered for that Professional Category.
- User can click the ‘List with us’ link next to the hamburger menu to navigate to the List with us page. When a user with a company account is logged in the 'List with us' will be replaced by 'Switch to company’.
- Users can click the hamburger menu showing the drop down that includes the following links: Projects, Professionals, Login, Signup, List with us and Help center.
- User can type a search query through the search bar widget, navigating the user to the Discover Page.

Acceptance Criteria

- Given an unauthenticated visitor loads the site, when the header renders, then show nav items Projects, Professionals, Log In/Sign Up (and hide Saved projects/Saved professionals/Account/Sign out), List with Us (Switch to company when an authenticated professional visitor loads the side), Help center.
- Given the hero Search bar has non-empty input, when the user presses Enter or clicks the Search CTA, then navigate to Discover (Projects tab) with the query applied and visible in the Discover search field.
- User can navigate cards in a carrousel using the navigation buttons (left/right) to refresh all the cards in the carrousel. On mobile the carrousel can be navigated through a swipe.
- Professional categories and services
  | Professional Category | Professional Service |
  | --------------------- | ------------------------ |
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
  | Construction | Wellness |
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
- Project typescategories and sub-types
  | Project Type | Project Sub-type | Listing type | Building feature |
  | ---------------- | ---------------- | ------------ | ---------------- |
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

## Discover

**Component Path**: `app/discover/page.tsx` (discover page with tabs)

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%201.png>)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516725751-73nzm2k.png?alt=media&token=a89470bf-ff8e-44ce-becf-d20d4707529a)

Functional Requirements

- Visitors and Registered users can browse Projects and Professionals using a two-tab layout.

### Projects

**Component Path**: `app/discover/projects/page.tsx` (projects tab component)

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%201.png>)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516729138-12zzwl1.png?alt=media&token=83d0e1d8-48bc-4a75-9334-5e8bceea2143)

Functional Requirements

- User can type in the Keyword Search bar to match Project Title, Slug, Features, Materials, and other metadata. When a keyword is entered the user can use the Projects and Professionals tabs to search within these areas. Switching the tabs maintains the keyword search and filters via URL parameters.
- User can click a Project Card (image or title) to open the Project Detail Page.
- User can switch to the Professionals tab.
- User can click Filters to expand/collapse the filters pop-up (mobile: opens drawer).
- User can see active filter chips above results and click each chip’s “x” to remove it, or click Clear All to reset all filters. This includes Keyword filters in brackets (i.e. “Amsterdam”)
- User can scroll the Results Grid of project cards (Image, Title, number of likes).
- User can click a Project Card (image or title) to open the Project Detail Page in a new tab.
- User can click the Save/Favorite (heart) on a card (unauth → Login > Sign Up, then return to context).
- User can click Like (thumb up with number of likes below the image) on a card to like the project (unauth → Login > Sign Up, then return to context).
- System will lazy-load more results on scroll (infinite load) and show skeleton loaders while fetching.
- User can apply filters by Project Type or Project Sub-Type (single-select). The project sub-types that are qualified as 'Listing type' in the Project types and sub-types table will be displayed in he Type filter menu. Users can expand the project type to see underlying project sub-types.
- User can apply filters by Style (multi-select), e.g. Contemporary, Farmhouse, Modern, Scandinavian
- User can apply filters by Building Type (multi-select), e.g. Interior Designed, New built, Renovated
- User can apply filters by Location (multi-select), e.g., Waterfront, Mountain, Urban, Coastal.
- User can apply filters by Building Features (multi-select), e.g. Living room, Dining room, hall
- User can apply filters by Materials (multi-select).
- User can apply filters by Size (multi-select buckets), e.g. compact, medium, large, extensive.
- User can apply filters by Budget (multi-select buckets), e.g., Standard, Comfort, Premium, Luxury
- User can apply filters by Project Year (range: From / To).
- User can apply filters by Building Year (range: From / To).
- User can see results update immediately when a filter changes (no explicit “Apply” required).
- User can see a results count reflecting the current filter set.

Acceptance Criteria

- When search results are filtered by specific project types (e.g., Bathroom, Kitchen), the corresponding images will be displayed in the search results cards. For example, when filtering results by "Swimming Pool," images of swimming pools will be shown in the project cards. When filtering by a broader category (e.g., "Bed & Bath") rather than a specific type, the image of the first type within that category will be displayed in the search results.
- Given an unauthenticated visitor loads the site, when the header renders, then show nav items Discover, List with Us, Log In/Sign Up (and hide Saved/Account/Log out).
- Given the hero Search bar has non-empty input, when the user presses Enter or clicks the Search CTA, then navigate to Discover (Projects tab) with the query applied and visible in the Discover search field.
- Given the search input is non-empty, when the user submits, then filter results by keyword across Title, Slug, Features, Materials; when the field is cleared, then remove the keyword filter.
- Given sort controls are present, when the user selects Popularity or Newest, then reorder results without clearing search/filters.
- Given the page renders, when breadcrumbs are built, then show Projects > {Location} > {Type} > {Sub-type} > {Title} with ancestor crumbs linking to Discover pre-filtered; long labels truncate with tooltip.

### Professionals

**Component Path**: `app/discover/professionals/page.tsx` (professionals tab component)

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%202.png>)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516733048-5nmlrax.png?alt=media&token=0f1ae852-6d62-40de-a4bf-185cc8b763cf)

Functional Requirements

- Users can see a title above the cards with filters: [Category] in [location] (i.e. Architects in Amsterdam or All professionals in all locations)
- User can type in the Keyword Search bar to match Company Name, Description, Services and other metadata
- User can switch to the Projects tab
- User can click Filters to open the filters popup (mobile: drawer).
- User can click Sort (Rating, Location or Most Projects); system will re-order results accordingly.
- User can click a Professional Card (Image, Company name, rating, number of reviews, [Primary service] in [Location]) to open the Professional Detail Page in a new tab.
- User can click Save/Favorite (heart) Professional (bookmark) on a card (unauth → Login > Sign Up, then return).
- User can apply the 'Service' filters from the filter bar by Professional Category and Professional Service (multi-select)
- User can apply Location filters from the filter bar (Country and State/Region/City).
- User can apply Professional Service filters that are displayed in the filter bar, e.g. Architecture, Interior design, painting
- User can see active filters displayed as chips.
- User can clear all filters with a single action.

Acceptance Criteria

- Given the Professionals tab is selected, when the page renders, then provide keyword search over Company Name, Services with debounce.
- Only professionals with a Plus plan are displayed in the search results.

## Project Detail

**Component Path**: `app/projects/[id]/page.tsx` (project detail page)

**Gallery Component**: `components/project-gallery.tsx` (multi-image header with modal trigger)

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%203.png>)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516737335-h82lwoc.png?alt=media&token=b8daf627-e80b-44e1-b1b0-6e149e3cc5db)

Functional Requirements

- User can click the link 'Back to search' above the Multi-Image header to go back to the search results (previous page)
- User can navigate projects from the search results through previous and next project buttons. When the user didn't use a search to op the Project Detail page, the navigation buttons are hidden.
- User can view a Multi-Image Header (shows the first 5 uploaded images on desktop; swipeable on mobile).
- User can click View All Photos (button over the header) → system will open the Images Overview Modal
- User can click Like (thumb up with number of likes) to like the project (unauth → Login > Sign Up, then return to context).
- User can click Save/Favorite (heart) (unauth → Login > Sign Up, then return and complete the save).
- User can click Share to open the Share modal
- User can read Title, [Style] [sub-type] in [location], [Building type] in [Project Year], and the Overview rich-text.
- ## User can view the Professionals section on the right of the page with company name, professional type, # of projects (clickable) and 'Visit' button. The Visit button opens the Professional Detail Page
  -
- User can view the Highlights Section (Building Feature Image + Building Feature Name + Building Feature Description). Clicking a card will open the Image Overview Model and scroll to the respective building feature.
- User can view Features metadata block showing the building features with an icon. Clicking a feature will open the Image Overview Model and scroll to the respective building feature.
- User can view the Professionals Carrousel with company cards (professional image + company name + rating + number of reviews + professional type + number of projects); clicking a card navigates to the Professional Detail Page. The carrousel shows professionals with a paid subscription first.
- User can click the 'Show all professionals' button below the Professionals Carrousel opening the Professionals Popup
- User can view metadata blocks: Category (i.e. House), Type (i.e. Villa), Style (i.e. Modern), Project type (i.e. New Built), Size (i.e. expansive), Budget (i.e. Luxury), Project year, Building year, Materials (i.e. Exposed brick, natural stone), Location (i.e. Forrest, Countryside)
- User can scroll to Similar Projects (carousel) with Project Cards (Image, Title, number of likes) and click a card to open that Project Detail.
- System will lazy-load images, track views, and render structured data for SEO.

Acceptance Criteria

- Given the page renders, when breadcrumbs are built, then show Projects > {Location} > {Type} > {Sub-type} > {Title} with ancestor crumbs linking to Discover pre-filtered; long labels truncate with tooltip.
- Given the Images Header displays, when a user clicks any image or View all photos (N), then open Images Overview (modal).
- Given similar items exist, when loading Similar Projects, then show same Sub-type & Style sorted by likes; links open in new tab.
- Given professionals are attached, when rendered, then show Logo, Name, Role (and Plan Tier/Verified if applicable); Visit opens Company Page/external site; Show all opens a list popup; Report opens mailto.
- Given an unauthenticated user triggers a gated action (Save, Like, Write a review), when authentication is required, then show the Auth modal (or redirect to Auth page) and persist return context (tab, filters, sort, scroll, image index, and pending action).
- Given Saved Projects list, when loaded, then show cards with Thumb, Title, Sub-type, Year, heart; toggling the heart removes/adds; filters (Sub-type, Year) and keyword over Title work.

### Professionals Popup

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%204.png>)

Functional Requirements:

- User can view professionals that contributed to the project with company name, professional type, # of projects (clickable) and 'Visit' button. The Visit button opens the Professional Detail Page
- **With company page:** company name, professional type, # of projects (clickable) and 'Visit' button
  - The # of projects link takes the user to the Professionals Detail Page and scrolls to the 'Projects' section on the page
  - The Visit button opens the Professionals Detail Page
- **Without company page:** only company name and professional type are shown without links.

### Images Overview Modal

**Component Path**: `components/grouped-pictures-modal.tsx` (image gallery modal with lightbox)

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%205.png>)

Functional Requirements

- User opens image overview model when a photo on the top of the project detail page is clicked
- User can go back to the Project Detail Page by clicking the Back link at the top of the page.
- User can click Share to open the Share modal.
- User can click Save to save the project
- Images are grouped per building feature, showing feature name and description
  - When a building feature does not have any photos, the name and description are not shown
- When the user clicks a Highlighted feature on the project detail page, the image overview model is opened and scrolled to the respective building feature.
- When the user clicks an individual photo the image detail model is opened

### Image Detail Modal

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%206.png>)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516745110-5ruzrk1.png?alt=media&token=b649f02b-85c8-40a9-9fab-43ef58f4f8a0)

Functional Requirements

- User can navigate images via Next/Prev controls, keyboard arrows, or swipe on touch. On mobile the Next/Prev controls are not displayed
- User can toggle captions (if available).
- User can close the Lightbox (close icon, ESC key, or backdrop click) and return to the Project Detail Page.
- System will trap keyboard focus in the overlay and lock background scroll while open.

Acceptance Criteria

- Given the Images Header displays, when a user clicks any image or View all photos (N), then open Images Overview (modal).

Acceptance Criteria

- Given the Images Header displays, when a user clicks any image or View all photos (N), then open Images Overview (modal).

### Share

**Component Path**: `components/share-modal.tsx` (project share modal)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516748111-8859b43.png?alt=media&token=9a082b7a-1e04-4175-afb7-384a8c474094)

Functional Requirements

- User can click Share to open the Share modal.
- User can see project image, name and subtitel that consists of [Style] [Sub-Type] in [Location]
- User can click share buttons: copy link, e-mail, message, WhatsApp, Messenger, Facebook, Twitter and embed.

## Professional Detail (Company Page)

**Component Path**: `app/professionals/[id]/page.tsx` (professional detail page)

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%207.png>)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516749870-73duizp.png?alt=media&token=132f61d3-4e9b-48eb-9cf6-6e19b24471b7)

Functional Requirements

- User can view professional information on the company page.
- User can navigate using a breadcrumb with clickable links.
- User can use a Share button to share the page.
- User can use a Save button to save the professional to the professionals tab of their account.
- User can click on the rating and number of ratings to scroll to the reviews section.
- User can click social icons that are visible when links are added to the company account.
- User can click Show phone number link to reveal the phone number.
- User can click the website link to open the professional’s external site.
- User can click the Contact button to open an email to the professional.
- User can see the number of projects in the Projects section title.
- User can sort projects in the Projects section by Most Likes or Newest.
- User can navigate projects with pagination, which scrolls to the top of the Projects section when changed.
- User can view the Meet the professional section, including Services (i.e. Architect, Interior Design), Certificates, Languages, Joined (year), Address.
- User can see the rating and number of reviews in the Reviews section title.
- User can see a summary of sub-ratings in the Reviews section, including quality of work, reliability and communication.
- User can click Show more or Show all X reviews to open a Reviews pop-up.
- User can click Write a review to open a Write a Review pop-up.
- User can click 'Write a review' which requires authentication.
- User can only see reviews once they are approved in the admin account.

Acceptance Criteria

- Given professionals are attached, when rendered, then show Logo, Name, Role (and Plan Tier/Verified if applicable); Visit opens Company Page/external site; Show all opens a list popup; Report opens mailto.
- Given Saved Professionals, when loaded, then show Logo, Name, Location, bookmark; toggling removes/adds; Service Category filter and keyword over Name work.
- Given an unauthenticated user triggers a gated action (Save, Like, Write a review), when authentication is required, then show the Auth modal (or redirect to Auth page) and persist return context (tab, filters, sort, scroll, image index, and pending action).

### Contact Professional

Functional Requirements

- User can click 'Contact Professional' to open an email client or contact modal.

### Write Review

**Component Path**: `components/professional/WriteReviewModal.tsx` (review form modal)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516757604-ob6w568.png?alt=media&token=8a78a0eb-3512-4c5c-b1aa-41c331084138)

Functional Requirements

- User can rate overall experience with a professional using a star rating.
- User can enter a short text summary of their overall experience.
- User can indicate whether any work was carried out (Yes/No).
- User can rate specific areas including Quality of Work, Reliability, and Communication using star ratings.
- User can enter additional written feedback in a text box (up to 500 characters).
- User can cancel or submit the review.

Acceptance Criteria

- Given an unauthenticated user triggers a gated action (Save, Like, Write a review), when authentication is required, then show the Auth modal (or redirect to Auth page) and persist return context (tab, filters, sort, scroll, image index, and pending action).

### Reviews

- User can see total rating in the Reviews section title and sub-ratings, including quality of work, reliability and communication.
- User can see number of reviews in the Reviews sub-title.
- User can sort reviews by Most recent, Highest rated, Lowest rated

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%208.png>)

## Auth

**Component Path**: `components/auth/AuthModal.tsx` (authentication modal)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516760740-vr5rlrv.png?alt=media&token=67b217de-14a9-441f-b6f8-dc516d6bddf4)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516760744-7ayzb4u.png?alt=media&token=df472248-1657-4abd-ba45-87bdf15c7132)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516760748-0bx2r9e.png?alt=media&token=9416f9ca-fae6-41af-beb1-787d9ed1616e)

Acceptance Criteria

- Given an unauthenticated user triggers a gated action (Save, Like, Write a review), when authentication is required, then show the Auth modal (or redirect to Auth page) and persist return context (tab, filters, sort, scroll, image index, and pending action).

### Login

**Component Path**: `app/login/page.tsx` (login page) + `components/login1.tsx` (login form component)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516767016-9zhirlj.png?alt=media&token=086c2ff0-d9ac-4666-94b7-23be4301894e)

Acceptance Criteria

- Given an unauthenticated user triggers a gated action (Save, Like, Write a review), when authentication is required, then show the Auth modal (or redirect to Auth page) and persist return context (tab, filters, sort, scroll, image index, and pending action).
- Given valid credentials or a successful sign up, when auth completes, then return the user to the exact pre-auth context and complete the pending action automatically (e.g., the Like is applied, Save toggled, Review composer opens).

### Sign Up

**Component Path**: `app/signup/page.tsx` (signup page) + `components/signup1.tsx` (signup form component)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516769641-xrtl6rm.png?alt=media&token=60d41246-d3c2-43f0-b79a-49463a0e4b66)

Acceptance Criteria

- User can sign up entering First name, Last name, email and password
- Given the Sign Up form, when the user submits, then validate required fields (email format, password rules, ToS/Privacy consent if required) and surface inline errors without clearing inputs.

**Verification**

## Homeowner Portal

**Component Path**: `app/dashboard/page.tsx` (user dashboard layout)

Functional Requirements

- User that is logged-in as Homeowner user manage their projects, Saved professionals and Settings here. The sidebar order is: Saved Projects → Saved Professionals → Account Settings
- The header in the Homeowner Portal is the same as the homepage (Logo, Projects, Professionals, Search, List with us, hamburger menu).

### Saved Projects

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516799913-jkag2qz.png?alt=media&token=308c6bce-aa95-42b5-bbb9-17dad62e8b57)

Functional Requirements

- User can view saved projects as cards and unfavorite them via a heart icon.
- User can view saved projects as cards (image, title, [Style] [Sub-Type] in [Location], number of likes).
- User can click a card to open the public Project Detail page.
- User can unfavorite a project via the heart icon; system will remove the card with a fade animation.
-
- System will display an empty-state illustration if no items are saved.

Acceptance Criteria

- Given the Sign Up form, when the user submits, then validate required fields (email format, password rules, ToS/Privacy consent if required) and surface inline errors without clearing inputs.
- Given Saved Projects list, when loaded, then show cards with Thumb, Title, Sub-type, Year, heart; toggling the heart removes/adds; filters (Sub-type, Year) and keyword over Title work.

### Saved Professionals

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516802763-ovv1ebl.png?alt=media&token=787a7a2c-520d-44db-b031-73075d9123d2)

Functional Requirements

- User can view saved professionals in a card grid (Image, Company name, rating, number of reviews, [Primary service] in [Location])
- User can open a professional’s Company Page in a new tab by clicking the card.
- User can remove a professional from Saved via the heart icon; system will animate removal.
- User can filter by Service Category and search by Company Name.

Acceptance Criteria

- Given Saved Professionals, when loaded, then show Logo, Name, Location, bookmark; toggling removes/adds; Service Category filter and keyword over Name work.

### Account Settings

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516805679-xa0t5sg.png?alt=media&token=417e2818-79c5-47a2-8f04-3d185e672fbf)

Functional Requirements

- User can update First Name, Last Name, Display Name, Profile Photo, Phone.
- User can enter Current Password, New Password, Confirm New Password.
- User can click Save Password; system will enforce rules, log the user out of other sessions, and confirm change.

Acceptance Criteria

- Given Profile form, when saving, then require First/Last Name, validate Photo type, and toast success; photo upload supports replace.

## Create a company

- User that have a homeowner account can add a company account by clicking the 'Company Setup' on the List With Us Page
- User can if the user also has a Professional account, a Role Switcher appears in the header to toggle between Homeowner and Professional Dashboard modes (state persists across sessions).

### Company details

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%209.png>)

Functional Requirements

- User can register the company when the 'Company Setup' link is clicked on the List With Us Page
- User can add a logo
- User can add company name, phone number and select the primary professional service from a drop-down
- User can add the company domain and company email address, which has te be a company domain. The email address has te be verified by the user through clicking an verify email link in an email that the user will receive on the company email.
- When the user clicks 'Create company' the user will navigate to the Professional Portal

## Professional Portal

**Component Path**: `app/dashboard/professional/page.tsx` (professional dashboard layout)

- User that is logged-in and also has a Professional account, a Role Switcher appears in the header to toggle between Homeowner and Professional Dashboard modes (state persists across sessions).
- On the Professional Dashboard the header is updated, consisting of Logo, Listings, Company and Hamburger menu.
- The Hamburger menu on the Professional Dashboard contains these links: Listings, Company, Upgrade plan, Billing, Account, Help center, Switch to homeowner, Sign out.

### Listings

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2010.png>)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516771921-i714cox.png?alt=media&token=c8192cc4-369f-479b-bfdf-9ad5864e1b93)

Functional Requirements

- User can view a list a project card (Add your first project with 'Add project' button) when there are no projects under Listings
- User can view all personal projects in a through project cards with image, Title, Status (In Progress · In Review · Invited · Live on page · Listed · Unlisted · Rejected), Role (Project owner · Contributor), Actions.
- User can click Add Project to launch the List a Project Wizard.
- User can click a card or click the 'Edit listing' link in the Action menu to open the Listing Editor page if the Role is Project Owner and the Status is Live on Page, Listed or Unlisted; drafts still open the List a Project Wizard.
- User can filter by Status, Role, Year;
- User can search by Title or Sub-type via the keyword Search box under FIlter menu.
- User can click the Status label on the project card or the 'Update status' link in the Action menu to open the Listing Status Popup. When the status is In Progress user is navigated to the List a Project Wizard. When the status is Rejected the Listing Rejected popup is displayed.
- User can click the 'Edit cover image' link in the Action menu to open the Cover Photo Popup
- User can delete a listing through the Listing Status Popup (Delete action) after confirmation; system will soft-delete and refresh the table.
- System will color-code status chips and auto-refresh the list when a wizard save occurs.
- Listing statuses
  | Status | Description | Image click - listing owner | Image click - not listing owner |
  | -------------- | ------------------------------------------------------------------------------------- | --------------------------- | ------------------------------- |
  | ● In progress | Listing is in edit mode | List a project flow. | n/a |
  | ● In review | List a project flow is completed and has to be accepted by an admin. | List a project flow. | n/a |
  | ● Invited | Company is invited by project owner. | n/a | Status pop-up |
  | ● Live on page | Project is live on the company page | Edit listing | Status pop-up |
  | ● Listed | Professional is listed on project page. | Edit listing | Status pop-up |
  | ● Unlisted | Project is not listed on company page and professional is not listed on project page. | Edit listing | Status pop-up |
  | ● Rejected | The listing is rejected by an admin | Rejected pop-up | n/a |

Acceptance Criteria

- Given valid credentials or a successful sign up, when auth completes, then return the user to the exact pre-auth context and complete the pending action automatically (e.g., the Like is applied, Save toggled, Review composer opens).
- Given a user clicks on a project with status Live or Rejected on the Listings [Page], then the Listing Editor [Drawer] must open.

### Listing status

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2011.png>)

Functional Requirements

- User can see the image, title, [style] [sub-type] in [location]
- User can select the listing status (Live on page, Listed, Unlisted)
- User can delete a listing (Delete action) after confirmation; system will soft-delete and refresh the table.

### Listing rejected

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2012.png>)

Functional Requirements

- User can see the image, title, [style] [sub-type] in [location]
- Use can see rejection note
- User can click 'Edit Listing' taking the user to the List a Project Wizard
- User can delete a listing (Delete action) after confirmation; system will soft-delete and refresh the table.

### Cover photo

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2013.png>)

Functional Requirements

- User can select a photo from the project images that will be displayed in the your project section and as image on the company page when the project is added

## Listing Editor

- User can navigate Photo tour, Professionals, Details and Location tabs on a menu on the left. On Mobile users can navigate through a hamburger menu left of the page title.
- User can see Status label above the navigation links on the left. Clicking the Status label will open the Listing Status Popup
- User can click Save Changes; system will apply edits to the live listing immediately.
- User can click Request Re-Review on a Rejected listing; system will change status to In Review and notify admins.
- User can close the drawer; system will warn if there are unsaved changes.

Acceptance Criteria

- Given the list loads, when rendering rows, then show Featured (toggle), Project Title, Sub-type, Features (first 5 + “+N”), Year, Date Created with Title linking to public detail.
- Given a user is the Project Owner and clicks on a project with status In progress, In review or Rejected on the Listings [Page], then the Listing Editor [Drawer] must open.

### Photo tour

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516786951-p41ukg0.png?alt=media&token=39c359da-491b-4a3b-a666-287ef62064ab)

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2014.png>)

Functional Requirements:

- Users can see feature cards with the features that are created during the project listing flow. Clicking a feature card will take the user to the Room Editor Popup.
- Every feature shows the number of photos added or the text 'Add photos' when photos need to be added. Clicking the ‘Add Photo’ link will take the user to the Add Photo Popup.
- Only features with a minimum of 1 photo will be shown in the Highlights and Features section on the project detail page.
- User can click the ‘+’ link to open the Add Feature Popup. When a feature is added a feature card will be created on the Photo tour page.
- The first feature card is named ‘Building’ when the Project Tye is House. This card holds all building images that are not associated with a specific building feature.

### Add feature

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2015.png>)

- User can see selected features and add or remove a feature by checking or unchecking a feature card.

### Add photo

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2016.png>)

- User can see an overview of all uploaded photos and select one or multiple uploaded photos by checking the images
- User can browse or drag and drop more images to the uploaded photo section.

### Room editor

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2017.png>)

- User can see the feature cards on a panel on the left with image and feature
- User can see an overview of images that are located under the specific feature. The first image has the tag ‘Cover photo’
- User can click the ‘+’ button to open the Add Photo Popup
- User can click the Action button on the image to open a menu that includes ‘Move to other feature’ (opening a Popup similar to the Add Feature Popup to select a different feature), ‘Remove from [feature]’ (removing the image from the feature), ‘Delete from project’ (deleting the image from the project).
- User can add a tagline from the feature that will be displayed below the Feature title in the Highlights section on the Project Detail Page
- User can set a toggle to Highlight the feature in the Highlights section on the Project Detail Page
- User can delete the feature, showing a popup to confirm the action

### Professionals

**Component Path**: `app/discover/professionals/page.tsx` (professionals tab component)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516786956-xuo43pn.png?alt=media&token=7ab63e26-c819-458c-8e65-3c2f8f6727c1)

- Users can see the professionals that are added in the List a Project Wizard
- When no professional is invited the ‘Invite Professional’ button is displayed taking the user to the Add Professional Popup
- When a professional is added the user will see:
  - Email - when company domain is not used in a company account
  - Company name - when company domain is used in a company account
  - Status
    - Listing owner (grey) - always the first block. This is the company name and primary type of the company that created the listing
    - Invite sent (orange) - listing status is 'Invited'
    - Listed (green) - listing status of the company is 'Listed' or 'Live on page'
    - Unlisted (grey) - listing status of the company is 'Unlisted'
    - Removed (red) - company removed the listing
- Users can add a professional type by clicking the Add button (plus icon) taking the user to the Add Professional Service Popup

### Add professional

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2018.png>)

- User can add email for the selected professional service
- User can remove the professional service

### Add professional Service

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2019.png>)

- User can select and de-select professional service’s. The action will the professional cards on the professionals page

### Details

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2020.png>)

- User can update listing details

### Location

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516786965-1m75qjh.png?alt=media&token=a43a8f45-4137-445d-b647-f12b259b08be)

- User can update the address in an address bar, showing the selected address on a map
- User can set a toggle to share the exact location of the project.

## List a Project — Wizard

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516774379-vf2k6dw.png?alt=media&token=57241659-ed77-450e-af9c-5c266102a8ad)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516774383-pbxlh9l.png?alt=media&token=8148b632-b903-48af-95bf-7ea9cb8a9820)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516774387-0x1cffl.png?alt=media&token=fa3bc4a0-332e-4e02-bc1e-40853464a624)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516774391-yrb24e0.png?alt=media&token=c687d9a9-e385-4d4c-b6ec-81ee9d193eb2)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516774397-dx0g7y7.png?alt=media&token=02d0efdd-e7ff-4963-9133-160020dee880)

Functional Requirements

- User can click Add Project to launch the List a Project wizard.
- Wizard presents steps: Intro & Project Type → Location & Materials → Details → Photo Tour → Review & Submit.
- Wizard enforces per-step required fields and inline validation; Next is disabled until requirements are met.
- User can save progress as Draft at any step; progress persists when returning to the wizard.
- Photo Tour supports multi-file upload via click or drag-and-drop; user can reorder and remove photos.
- Review & Submit step shows a summary of entered data; on Submit, system creates a Listing and adds it to the admin approval queue.
- Wizard shows a stepper with step names; Back/Next navigation preserves inputs and supports returning to prior steps.
- System autosaves on step change and periodically while editing to prevent data loss.
- “Questions?” opens the external help page in a new tab/window.
- Save & Exit returns to Listings with status In progress; if no photos exist, show gray placeholder thumbnail.
- Every step shows a Back button to go to prior step without losing data.
- Stepper highlights current step and prevents skipping required fields.
- Autosave on step change and every 30 seconds when there are unsaved changes.

Acceptance Criteria

- Given row actions, when used, then provide Create Project (admin Create/Edit wizard) and Edit (open wizard to last step); preserve context on return.

### Wizard — Project Details: Project Type

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599133134-arco-projectWizard-1-v0.png?alt=media&token=815534ee-68c8-4ad3-aa30-9d44440c153a)

Functional Requirements

- All four selections (Category, Project type, Building type, Project style) are required before Next.
- User selects Project category, i.e. House, Bed & Bath (required).
- User selects Project type, i.e. Villa, Apartment, Kitchen (required). The results filter based on the Project category selected.
- User selects Building type, i.e. New built, Renovated, Interior designed (required).
- User selects Project style, i.e. Modern (required).

Acceptance Criteria

- Next is disabled until Project Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Project Details: Location & Materials

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599147157-arco-wizard-2-v0.png?alt=media&token=06c53f8e-3653-41c6-af0f-3ea237f28104)

Functional Requirements

- User selects Location features (checkbox group; at least one required).
- User selects Material features (checkbox group; at least one required).

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Project Details: Details

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599160906-arco-wizard-3-v0.png?alt=media&token=388dd18a-2aca-4d1d-9bea-5c2bd6bd9306)

Functional Requirements

- User selects Size (required; taxonomy or range list).
- User selects Budget (required; predefined ranges).
- User enters Year built (required, 4-digit).
- User enters Building year (required, 4-digit; original construction year if different).

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Project Details: Name & Description

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599185273-arco-wizard-4-v0.png?alt=media&token=e8d21269-585f-49d9-ae53-b1d71ed2c99b)

Functional Requirements

- Project title is required (max 120 characters) with live character meter.
- Project description is required ) with rich-text basics and word/character count.

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Project Details: Location (Confirm)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599202484-arco-wizard-5-v0.png?alt=media&token=e2dc097a-3bbb-41d2-a34e-4ed6f2dfe2cb)

Functional Requirements

- Address autocomplete (Google Places) and draggable map pin; store lat/lng plus formatted address.
- Share exact location toggle controls public masking (city/region only when off).

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Photo Tour: Add Photos

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599254856-arco-wizard-photos-2.png?alt=media&token=9f91c456-bfa6-489c-9d2a-e9484f5f6bd7)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599254858-arco-wizard-Photos-1-v0.png?alt=media&token=796097aa-6c23-4180-83ab-3ae8ebb7f363)

Functional Requirements

- Drag-and-drop or click to upload JPG/PNG; show each file as it uploads (no need to wait for all).
- Per-photo menu allows 'Set cover photo' and 'Delete'.
- User must upload at least 5 photos to proceed; show counter and disable Next until ≥5.

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Photo Tour: Choose Features

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599288526-arco-wizard-photos-3.png?alt=media&token=bab23a44-c7f2-4f8e-af7c-87fdd1c1a9cf)

Functional Requirements

- Show features sorted by .sort; default Building first; Additional photos last.
- Each feature shows Select photos; opens Select Photos popup.
- Add photos & Add features open their popups.
- Display available features (e.g., Bedroom, Bathroom) as selectable tiles with icons from taxonomy; multi-select allowed.
- Selections persist on Back/Save & Exit; Next navigates to Features List.

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Photo Tour: Features List

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599404569-arco-wizard-photos-4.png?alt=media&token=04c0a0e0-bb74-454c-a87b-9e6c838642d4)

Functional Requirements

- List selected features as cards; each shows 'Select photos' which opens the Select Photos modal.
- Floating action button '+' opens menu: 'Add photos' (global upload) and 'Add feature' (open Add Features popup).
- Only features with photos will be published; show this message above the grid.
- Complete button finishes the Photo Tour section; remain enabled when overall photo minimum is met.
- The first card in the photo tour is 'Building' when the project type is 'House'. This section is to add generic photos from the building that can't be associated with a specific feature in the project, like a Kitchen or Bathroom.

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Photo Tour: Select Photos

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599488422-arco-wizard-photos-4b.png?alt=media&token=8e1b595a-2a57-4cfb-9388-8d710fc701eb)

Functional Requirements

- Header shows current feature name.
- User can upload new photos in-place (drop zone + 'Browse files').
- Select from existing photos pool with check toggles; selected count shown in Save button (e.g., 'Save Selection (2)').
- Per-photo action: 'Set as cover' for the feature; only one cover per feature.
- Top-right 'Delete feature' removes the feature; its photos remain in the pool.

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Photo Tour: Add Photos (Popup)

Functional Requirements

- Upload additional photos to the global pool; same validations as the Add Photos step.

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Photo Tour: Add Features (Popup)

Functional Requirements

- List remaining features from taxonomy that are not yet selected; allow adding them to the project.

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Professionals: Add Professionals

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599576225-arco-wizard-professionals-2.png?alt=media&token=1b9b74d9-45d5-4d7e-8e4d-f6e3783ccf41)

Functional Requirements

- Display professional services from with icons, sorted by the 'sort' column.
- Users select one or more services via tiles (multi-select). Selection persists on Back/Save & Exit.
- Next navigates to Invite Professionals; no minimum selection required.

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Professionals: Invite Professionals

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599596208-arco-wizard-professionals-3.png?alt=media&token=b27d7d42-ca01-4e3a-9dc3-18a7bf5a1c51)

Functional Requirements

- Show each selected service as a card; card contains an 'Invite professional' button.
- Kebab menu per card opens Update Professional popup with actions: Edit email, Remove service, Cancel invite (if pending).
- Floating '+' opens menu to Add professionals (popup).
- Invites are queued and will be sent when the project is published and approved.

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Professionals: Add Professionals (Popup)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599612118-arco-wizard-professionals-3b.png?alt=media&token=82bc57f8-292f-4bea-8a97-90c849b374f5)

Functional Requirements

- Show service + icon; user adds a company email.
- Block common personal domains (e.g., gmail.com, hotmail.com) if enabled.
- Remove a previously added service.

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Professionals: Invite Professionals (Popup)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599699192-arco-wizard-professionals-3b.png?alt=media&token=ff629265-f884-43ca-9f5c-3f24c7491024)

Functional Requirements

- Invite Professional modal collects an email address; Send adds a pending invite to the selected service.

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Finalize

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599723491-arco-wizard-professionals-4.png?alt=media&token=0d7b47b3-98a8-484e-af34-63b8e99b0522)

Functional Requirements

- Clicking the project thumbnail opens listing preview in a new screen.
- Publish takes the user to Listings where the listing is shown with the status ● In review.
- On publish, run final validation and show a success toast.

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

### Wizard — Professionals: Update Professional (Popup)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756599709517-arco-wizard-professionals-3b.png?alt=media&token=838e9848-99c0-4af5-b7e5-d77231b7d22b)

Functional Requirements

- Update professional email.
- Remove service or cancel invite.

## Professional Dashboard

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516809971-q38p37w.png?alt=media&token=aed2ebd5-ac87-4fbb-9f7e-a6d25459ee53)

Acceptance Criteria

- Given a user is on the Company Profile / Settings [Page], when they modify profile data and click Save, then the system must persist the changes and display a success confirmation.
- Given a user drags an image thumbnail to a new position, then the new order must be persisted immediately and reflected on the public Company Page.
- Given a user clicks Deactivate and confirms the action, then the company status must be set to Deactivated and the public page must become inaccessible.

### Company Profile / Settings

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756598400425-arco-userPortal-company-settings.png?alt=media&token=1b03dcd1-8e17-4ea1-b7b4-731ed3d4940e)

Functional Requirements

- User can view and change company status by clicking the listing button opening the Company Status Popup
- User can open theunlisted links to the Plans page with an upgrade banner that is visible for users that are on the Basic plan.
- User can listed links to the company page in a new screen.
- User can deactivated links to the bottom of the Profile page where the company can be activated.
- System will display the correct status (Unlisted, Listed, Deactivated) based on the company’s subscription and account state.
- System will update the status immediately after a change (no refresh required).
- User can see an upgrade banner if their plan does is Basicnot include a company page.
- System will hide the upgrade banner once there is no option to upgrade.a plan with a company page is active.
- User can upload and update the company logo.
- System will validate logo file format (JPG, PNG, SVG) and size limits.
- User can update the company name.
- System will prevent duplicate company names if restricted by platform rules.
- User can update the company description.
- System will save and display the updated description on the public page.
- User can update contact information including domain, email, phone, and address.
- System will validate email and domain formats, and restrict domain changes if tied to account ownership.
- User can add social links (Facebook, Instagram, LinkedIn, Pinterest).
- System will validate social link formats and display only when a link is added.
- User can update services and features including primary service, other services, languages, and certificates.
- System will show multi-select options from a controlled list (services, languages, certificates).
- User can add and edit a custom domain for their company page.
- System will validate custom domain format and enforce character limits.
- User can deactivate their company account.
- User can reactivate their company account when deactivated.
- System will show “Deactivate” option only when the account is active, and “Activate” option only when the account is deactivated.

Acceptance Criteria

- Given a user is on the Company Profile / Settings [Page], when they modify profile data and click Save, then the system must persist the changes and display a success confirmation.
- Given a user drags an image thumbnail to a new position, then the new order must be persisted immediately and reflected on the public Company Page.
- Given a user clicks Deactivate and confirms the action, then the company status must be set to Deactivated and the public page must become inaccessible.

### Company status popup

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2021.png>)

Functional Requirements

- User can select Listed or Unlisted

### Company Listings

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756598375198-screencapture-v0-arco-git-preview-tinkso-vercel-app-dashboard-listings-2025-08-30-18_59_11.png?alt=media&token=1e718bc2-c0c0-4f61-b966-1cbef897cc4f)

### Company Photos

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756598020924-screencapture-v0-arco-git-preview-tinkso-vercel-app-dashboard-company-2025-08-30-18_53_09.png?alt=media&token=99c31415-c271-439f-9c85-a7a09287b83b)

Functional Requirements

- User can upload up to 5 photos via drag-and-drop or browse.
- System will enforce the maximum of 5 photos and show an error if the limit is exceeded.
- System will validate photo file types and size before upload.
- User can set any uploaded photo as the cover photo.
- System will display the selected cover photo prominently on the company page and in search results.
- User can delete uploaded photos.
- System will confirm deletion before removing a photo.
- User can view which photo is currently set as cover.
- System will visually indicate the cover photo with a label or marker.

## Plans

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2022.png>)

Functional Requiremnts

- Users can navigate to Plans from the hamburger menu or the banner on the Company page
- Users can toggle Monthly and Yearly pricing, which updates the price for the plan and adds the discount tag for yearly plans (20% off)
- When a user is not logged in with a company account the Basic plan table shows the button ‘Sign up’ (color button) and the Plus table shows the button ‘Get Started’ (outlined button). Both links that the user to the company signup page.
- When a company user is logged and the active plan is Basic, this plan has the tag ‘Active’ (outlined non-clickable button). The Plus plan has the button ‘Upgrade’ (color button)
- When a company user is logged and the active plan is Plus, this plan has the tag ‘Active’ (outlined non-clickable button). The Basic plan has no tag.
- Users can click 'Manage Subscription' opening the Stripe Subscription page. Downgrading is only possible through the Stripe Subscription page, not via the Plans table.
- The hamburger menu shows 'Upgrade plan' in red when the user is on a free plan and 'Plans' in black when the user is on a paid plan.

Acceptance Criteria

- When a user has a Basic plan the Professional is not displayed in search result on the Professional Discover page.
- Companies with a paid plan are placed above companies with a free plan on the Project Detail Page in the Professionals sections.
- When a user has a Basic plan up to 3 projects can be active, which is the total of the projects with the Status Live on page or Listed.
- Plans can be managed through Stripe

## List With Us

![image.png](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/image%2023.png>)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516818412-de5ylz8.png?alt=media&token=54154d17-1d6b-4587-ab66-cb9cea6eedb1)

Functional Requirements

- Users can scroll through a header text with main message
- Users can see a sticky header that only shows the Arco logo and a 'Company setup' button, navigating to Create a Company
- Users can scroll through of professionals
- Users can scroll through 4 benefits with a visual
- Users can click through testimonials
- Users can scroll through how to list your project

Acceptance Criteria

- Given a user clicks Company Setup, when activated, then open the Professional Signup popup and set focus to the first field; closing the popup returns focus to the CTA.

## Admin Portal

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516828917-psf7pev.png?alt=media&token=96ecef49-2812-4aac-84ce-aa575fba7b82)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516828919-35muka3.png?alt=media&token=7580a751-8e0c-4c9c-8e98-5eb271654761)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516828921-31uqfva.png?alt=media&token=0241e7a7-c83b-4261-b827-2509caf63218)

### Project Approval

Functional Requirements

- User can view a “Pending Projects” table with columns Project Title, Sub-type, Owner, Submitted On, Status.
- User can view a “Pending Projects” table with columns Project Title, Sub-type, Owner (email), Submitted On, Status (Pending / Rejected).
- User can click a row to open the full Project Detail page in a new tab.
- User can click Approve (button in row) → system will set status to Live, publish instantly, remove the row, and notify the owner by email.
- User can click Reject → system will open a Reject Modal with a required Reason textarea; on confirm the project status becomes Rejected, row disappears, owner receives the reason.
- User can multi-select rows and use the Bulk Approve / Bulk Reject buttons (top bar).
- User can filter the queue by Status, Date Range, Sub-type, and Owner email (dropdown + date picker + text input).
- User can type in a keyword search field (top right) to match project title or owner.
- System will paginate 25 rows per page, remember the admin’s last-used filters in local storage, and auto-refresh the table every 60 s.

### Projects

**Component Path**: `app/discover/projects/page.tsx` (projects tab component)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516835731-mdrvp2w.png?alt=media&token=a15a2dc4-8c9a-4085-8290-47abd22eeeb5)

Functional Requirements

- User can view a table of all projects with columns Featured (toggle), Project Title, Sub-type, Status (i.e. In Progress, In review, Live), Images (displaying the number of images), , Project location, Created On.
- User can click the Featured toggle in any row; system will immediately add/remove that project from the Home/Discover “Featured Projects” carousel, update the toggle icon, and persist the change.
- User can filter results by the columns Project Title, Images, Project location, Created On
- User can click the SEO View toggle (top right) to switch the table to columns Slug, Meta Title, Meta Description, SEO Status; clicking again returns to the main view.
- User can filter projects by Location (multi-select country/state), Feature tags, Style, Project Type, Project Sub-Type, Date Created (range picker).
- User can type in a search box to search project Title, Slug, or Features (debounced, case-insensitive).
- User can click any project row (title link) to open the Project Detail Page a new tab.
- User can click Create Project (primary button above table) to open the Create/Edit Project wizard on Step 1.
- User can click the kebab menu to access the links 'Edit', 'Change owner', 'Delete'.
- User can click the Edit link in the kebab menu to open that project in the Listing Editor or List a project Wizard when the project status is In Progress.
- User can click the Change owner link in the kebab menu to change the owner of a project by selecting a different professional user.
- User can click the Delete in the kebab menu to delete a project.
- System will show a badge count of projects currently filtered, remember column widths, and export the table to CSV via the overflow menu.

Acceptance Criteria

- Given row actions, when used, then provide Create Project (admin Create/Edit wizard) and Edit (open wizard to last step); preserve context on return.
- Given the list loads, when rendering rows, then show Featured (toggle), Project Title, Sub-type, Features (first 5 + “+N”), Year, Date Created with Title linking to public detail.
- Given the Featured toggle, when switched ON, then add to Home → Featured (respect limits); when OFF, then remove; disallow toggling for non-Live with an explanatory tooltip; optimistic UI reverts on error.

### Create / Edit Project — Wizard

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516838846-gyfsped.png?alt=media&token=7f8663bf-5f03-42b5-8f61-467bf004950b)

### Professionals

**Component Path**: `app/discover/professionals/page.tsx` (professionals tab component)

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516840967-iitgfht.png?alt=media&token=740d6df9-3a67-4473-a34e-0c6d8f7675fc)

Functional Requirements

- User can view professionals in a table with columns for Company Name, Rating, Location, Status (Listed, Unlisted, Not claimed, Deactivated), Projects Linked, and Plan Tier.
- When a Company has the status Not Claimed the Professional is invited to a project by another professional, but not yet linked to a user. The name displays the domain (example.com) that is invited.
- User can view professionals in a table with Company Name, Status (Active / Inactive), Projects Linked (#), Plan Tier.
- User can filter by Status, Plan Tier, Location, Professional Services or keyword search (name, domain).
- User can click Create Professional to open a modal with fields Company Name, Logo, Website, Contact Email, Services (multi-select).
- User can edit a professional in a side panel; system will reflect changes instantly on the public Company Page.
- User can deactivate/reactivate a profile; system will hide/show the Company Page and unlink it from Discover results.

Acceptance Criteria

- Given row actions, when used, then allow Edit…, Deactivate/Reactivate, and View public page with confirmations and success toasts.

### Taxonomies

Functional Requirements

- User can view existing Project Types and Sub-types in a two-column list.
- User can click Add Type or Add Sub-type, entering Name and optional Parent Type.
- User can rename an item inline; system will update all linked projects’ tags.
- User can toggle Retire; system will prevent selection in new projects but keep historical tagging.

**Reviews & Abuse Reports**

### Submissions / Leads

Functional Requirements

- User can view “List With Us” submissions table with Company, Email, Services, Submitted On, Status.
- User can open a submission side panel to read details and internal notes.
- User can click Approve → system will create a draft Professional profile and email onboarding instructions.
- User can click Reject / Archive with optional note; system will store note and email the submitter.

### Users

![Mockup](https://firebasestorage.googleapis.com/v0/b/prd-explorer.firebasestorage.app/o/mockups%2F1756516844227-nc0f99s.png?alt=media&token=410c8ac3-cec3-4d02-b23d-388db54648b3)

Functional Requirements

- A user with Super Admin privileges can view all admin users in a table with columns for Name, Email, Role, Status, and Actions.
- User can invite a new admin by entering Email and choosing Role (Admin / Super Admin); system will send an invitation email with activation link.
- User can deactivate/reactivate admins via toggle; system will immediately revoke or restore portal access.
- User can filter by Role or Status; system will prevent deactivation of the last Super Admin.

Acceptance Criteria

- Given actions, when used, then allow Invite Admin, Change role, Deactivate/Reactivate, and optional Reset password with confirmations and toasts; deactivation blocks login/API but preserves ownership.

# User Flows

## Discover projects from the Landing page (F-01)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480528f0be721370f2c17.csv>)

Acceptance Criteria

- Given an unauthenticated visitor loads the site, when the header renders, then show nav items Discover, List with Us, Log In/Sign Up (and hide Saved/Account/Log out).
- Given the hero Search bar has non-empty input, when the user presses Enter or clicks the Search CTA, then navigate to Discover (Projects tab) with the query applied and visible in the Discover search field.

## Search & filter projects (keyword + facets) (F-02)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480f08b03e8175cc2f7d9.csv>)

Acceptance Criteria

- Given the search input is non-empty, when the user submits, then filter results by keyword across Title, Slug, Features, Materials; when the field is cleared, then remove the keyword filter.

## Sort project results (popularity/newest) (F-03)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480be8aa7c85ec36349fe.csv>)

Acceptance Criteria

- Given sort controls are present, when the user selects Popularity or Newest, then reorder results without clearing search/filters.

## Open a project detail (F-04)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480dbb2aee64821d87225.csv>)

Acceptance Criteria

- Given the page renders, when breadcrumbs are built, then show Projects > {Location} > {Type} > {Sub-type} > {Title} with ancestor crumbs linking to Discover pre-filtered; long labels truncate with tooltip.

## View project image gallery (lightbox) (F-05)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480e48531ea2f5534af62.csv>)

Acceptance Criteria

- Given the Images Header displays, when a user clicks any image or View all photos (N), then open Images Overview (modal).

## Navigate to related projects (F-06)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e4803192b3d666c040a2ee.csv>)

Acceptance Criteria

- Given similar items exist, when loading Similar Projects, then show same Sub-type & Style sorted by likes; links open in new tab.

## Jump to professionals from a project (F-07)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480dea7ddc46c6a6d3b0d.csv>)

Acceptance Criteria

- Given professionals are attached, when rendered, then show Logo, Name, Role (and Plan Tier/Verified if applicable); Visit opens Company Page/external site; Show all opens a list popup; Report opens mailto.

## Browse the professionals directory (F-08)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e4801393e4c610ecee33cb.csv>)

Acceptance Criteria

- Given the Professionals tab is selected, when the page renders, then provide keyword search over Company Name, Services with debounce.

## Share a project (F-09)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480a882f5efd2c028d2be.csv>)

## Save/Like prompts sign-up (from anonymous) (F-10)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e4808e9db0d29550648ed2.csv>)

Acceptance Criteria

- Given an unauthenticated user triggers a gated action (Save, Like, Write a review), when authentication is required, then show the Auth modal (or redirect to Auth page) and persist return context (tab, filters, sort, scroll, image index, and pending action).

## Create an account (sign up) (F-11)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e48091a007e4a3ffcb7d11.csv>)

Acceptance Criteria

- Given the Sign Up form, when the user submits, then validate required fields (email format, password rules, ToS/Privacy consent if required) and surface inline errors without clearing inputs.

## Log in / Log out (F-12)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480db92b4e6b5214da78f.csv>)

Acceptance Criteria

- Given valid credentials or a successful sign up, when auth completes, then return the user to the exact pre-auth context and complete the pending action automatically (e.g., the Like is applied, Save toggled, Review composer opens).

## Save (favorite) a project (F-13)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480859563c4f36e3ebde4.csv>)

Acceptance Criteria

- Given Saved Projects list, when loaded, then show cards with Thumb, Title, Sub-type, Year, heart; toggling the heart removes/adds; filters (Sub-type, Year) and keyword over Title work.

## Save (favorite) a professional (F-14)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e48036bf63f1388628424a.csv>)

Acceptance Criteria

- Given Saved Professionals, when loaded, then show Logo, Name, Location, bookmark; toggling removes/adds; Service Category filter and keyword over Name work.

## View & manage Saved Projects (F-15)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e48091b8d1f67684619f06.csv>)

Acceptance Criteria

- Given Saved Projects list, when loaded, then show cards with Thumb, Title, Sub-type, Year, heart; toggling the heart removes/adds; filters (Sub-type, Year) and keyword over Title work.

## View & manage Saved Professionals (F-16)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480e6bb8fc0a39ac1556e.csv>)

Acceptance Criteria

- Given Saved Professionals, when loaded, then show Logo, Name, Location, bookmark; toggling removes/adds; Service Category filter and keyword over Name work.

## Edit profile & change password (F-17)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e48016bc77f505b2bd85fd.csv>)

Acceptance Criteria

- Given Profile form, when saving, then require First/Last Name, validate Photo type, and toast success; photo upload supports replace.

## Start “List with Us” (F-18)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480ab8fa6e44ccb5cf10b.csv>)

Acceptance Criteria

- Given a user clicks Get Started, when activated, then open the Professional Signup popup and set focus to the first field; closing the popup returns focus to the CTA.

## Admin — Create a new project (multi-step) (F-19)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480f6a54af41c673eb1a8.csv>)

Acceptance Criteria

- Given row actions, when used, then provide Create Project (admin Create/Edit wizard) and Edit (open wizard to last step); preserve context on return.

## Admin — Edit an existing project (F-20)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480f7889cd847e6bffb09.csv>)

Acceptance Criteria

- Given the list loads, when rendering rows, then show Featured (toggle), Project Title, Sub-type, Features (first 5 + “+N”), Year, Date Created with Title linking to public detail.

## Admin — Manage Featured projects (F-21)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e4807babe5e64aababb352.csv>)

Acceptance Criteria

- Given the Featured toggle, when switched ON, then add to Home → Featured (respect limits); when OFF, then remove; disallow toggling for non-Live with an explanatory tooltip; optimistic UI reverts on error.

## Admin — Manage professionals (F-22)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480458a84d0e5503b9015.csv>)

Acceptance Criteria

- Given row actions, when used, then allow Edit…, Deactivate/Reactivate, and View public page with confirmations and success toasts.

## Admin — Manage taxonomies (F-23)

| Step | Description                                             | Mockup     |
| ---- | ------------------------------------------------------- | ---------- |
| 1    | Admin opens Taxonomies.                                 | Taxonomies |
| 2    | Admin adds a Type/Sub-type or renames an existing item. | Taxonomies |

## Admin — Moderate “List with Us” submissions (F-24)

| Step | Description                                                | Mockup              |
| ---- | ---------------------------------------------------------- | ------------------- |
| 1    | Admin opens Submissions/Leads.                             | Submissions / Leads |
| 2    | Admin clicks Approve or Reject/Archive with optional note. | Submissions / Leads |

## Admin — Invite and manage admin users (F-25)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480288e81fc35663deaff.csv>)

Acceptance Criteria

- Given actions, when used, then allow Invite Admin, Change role, Deactivate/Reactivate, and optional Reset password with confirmations and toasts; deactivation blocks login/API but preserves ownership.

## Homeowner — List a new project (multi-step wizard) (F-26)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e48095a826f51d00353ea6.csv>)

Acceptance Criteria

- Next is disabled until Category, Project type, Building type, and Project style are selected.
- All dropdown options are sourced from Taxonomies (sorted) and allow searching/filtering.
- Feature groups populate from Taxonomies with icons and are sorted by 'sort'.
- At least one selection is required in each group; show inline error if none selected.
- Year fields must be 4 digits and within configurable bounds (e.g., 1800–current year).
- Building year must be less than or equal to Year built; show inline error otherwise.
- Next is disabled until Size, Budget, Year built, and Building year are all valid.
- Next is disabled until both Title and Description meet validation constraints.
- Character counters update live; invalid states show inline messages.
- Complete is disabled until a valid address is selected on the map/autocomplete.
- Next is disabled on Add Photos until at least 5 photos are uploaded; show '5 needed' affordance.
- Complete is disabled until the overall photo minimum is met; at least one feature with ≥1 photo is recommended (but not required).
- When publishing, only features that have one or more photos are visible on PDP; empty features are hidden by default.
- Next is enabled even if zero services are selected.
- If the domain matches a company account, show company name + primary service; otherwise display the email.
- Email must be valid; optionally block configured personal domains (e.g., gmail.com).
- Selections persist when navigating Back or using Save & Exit.
- Selections persist on Back and Save & Exit.
- Map and toggle state persist on Back and Save & Exit.
- Tile selection state persists across navigation and Save & Exit.

## Homeowner — Manage an existing project listing (F-27)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e48032a4aecbf07103980a.csv>)

Acceptance Criteria

- Given a user clicks on a project with status Live or Rejected on the Listings [Page], then the Listing Editor [Drawer] must open.

## Professional — Edit company profile & settings (F-28)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e48071a271df9c4c758534.csv>)

Acceptance Criteria

- Given a user is on the Company Profile / Settings [Page], when they modify profile data and click Save, then the system must persist the changes and display a success confirmation.

## Professional — Manage company photos (F-29)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480c29198cf9f6434ef1f.csv>)

Acceptance Criteria

- Given a user drags an image thumbnail to a new position, then the new order must be persisted immediately and reflected on the public Company Page.

## Professional — Manage company status (F-30)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480648610cfa9f53ee22d.csv>)

Acceptance Criteria

- Given a user clicks Deactivate and confirms the action, then the company status must be set to Deactivated and the public page must become inaccessible.

## User — Write a review for a professional (F-31)

[Untitled](<Arco%20full%20PRD%20(Niek)%2027af3c0385e480b793b9f3de996d4838/Untitled%2027af3c0385e480b78435cb77c22e247d.csv>)

Acceptance Criteria

- Given an unauthenticated user triggers a gated action (Save, Like, Write a review), when authentication is required, then show the Auth modal (or redirect to Auth page) and persist return context (tab, filters, sort, scroll, image index, and pending action).

## Admin — Moderate reviews (F-32)

| Step | Description                                           | Mockup                  |
| ---- | ----------------------------------------------------- | ----------------------- |
| 1    | Admin navigates to the Reviews & Abuse Reports page.  | Reviews & Abuse Reports |
| 2    | Admin clicks Approve/Reject on a review in the queue. | Reviews & Abuse Reports |

share or save the project

- User can see project image, name and subtitel that consists of [Style] [Type] in [Location]
- User can click share buttons: copy link, e-mail, message, WhatsApp, Messenger, Facebook, Twitter and embed.
