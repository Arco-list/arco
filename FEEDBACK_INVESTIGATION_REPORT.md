# Client Feedback Investigation Report
**Date**: 2025-12-03
**Status**: Investigation Complete

---

## Investigation Methodology

### How to Review and Document New Issues

When a new issue is reported, follow this systematic investigation process:

#### 1. **Understand the Issue**
- Read the issue description carefully
- Identify the expected behavior vs actual behavior
- Note any specific IDs, file paths, or error messages provided
- Ask clarifying questions if the issue is ambiguous

#### 2. **Locate the Root Cause**
- Use `Grep` to search for relevant code patterns (function names, component names, error messages)
- Use `Glob` to find related files (e.g., `**/*component-name*.tsx`)
- Use `Read` to examine the identified files
- Check database queries, API calls, and data flow
- Review related migrations if it's a database issue
- Trace the execution path to understand the full context

#### 3. **Document the Investigation**
For each issue, create a section with:

**Structure:**
```markdown
## Issue N: [Clear, Descriptive Title]

### **Status**: ✅ Investigated

### **Cause**
Located in `file/path.tsx:line-numbers`:

[Code snippet showing the problematic code]

**The Problem**:
- Bullet point explanation of what's wrong
- Why it's happening
- Example scenario demonstrating the issue

### **Solution**

**Option 1: [Approach Name]** (Recommended/Quickest/Best Long-term)

[Detailed explanation of the solution]

```typescript
// Complete code example with clear comments
// Show before/after if helpful
```

**Option 2: [Alternative Approach]** (if applicable)

[When and why to use this alternative]

### **Recommendation**

Use **Option X** because:
- ✅ Benefit 1
- ✅ Benefit 2
- ✅ Benefit 3

### **Files to Update**:
- `path/to/file.tsx:line-numbers`
- `path/to/another-file.ts:line-numbers`

### **Confidence Level**: XX%
[Explanation of why this confidence level]
```

#### 4. **Confidence Level Guidelines**

- **100%**: Issue is obvious, solution is trivial (e.g., missing link, typo)
- **90-95%**: Root cause identified, solution tested in similar scenarios
- **85-90%**: Root cause identified, solution is standard practice
- **80-85%**: Root cause likely, solution requires configuration changes
- **70-80%**: Multiple possible causes, solution covers most cases
- **<70%**: Unclear root cause, requires more investigation

#### 5. **Solution Requirements**

Every solution must include:
- ✅ **Complete code examples** (copy-paste ready)
- ✅ **File paths with line numbers** for precise location
- ✅ **Before/after comparison** if modifying existing code
- ✅ **SQL queries** for database issues (diagnostic + fix)
- ✅ **Migration strategy** for large refactors
- ✅ **Edge cases** handled in the solution
- ✅ **Verification steps** to confirm the fix works

#### 6. **Update Summary Table**

Add the new issue to the summary table:
```markdown
| # | Issue | Cause | Confidence | Severity | Status |
|---|-------|-------|------------|----------|--------|
| N | Short description | Root cause | XX% | High/Medium/Low | ✅ Investigated |
```

#### 7. **Severity Guidelines**

- **High**: Breaks core functionality, blocks users, data integrity issues
- **Medium**: Degrades UX, configuration issues, missing features
- **Low**: Visual inconsistencies, minor inconveniences

#### 8. **Tools to Use**

- **`Grep`**: Search for function names, component names, error patterns
  - Use `-i` for case-insensitive
  - Use `-n` for line numbers
  - Use `output_mode: "content"` when you need to see the code
- **`Glob`**: Find files by pattern (e.g., `**/*settings*.tsx`)
- **`Read`**: Read specific files (always read before editing)
- **`Bash`**: Run SQL queries for database diagnostics
- **`TodoWrite`**: Track investigation progress

#### 9. **Database Investigation Pattern**

For database-related issues:
1. Identify the query/function involved
2. Write diagnostic SQL to check data state
3. Provide fix SQL with explanations
4. Include verification query
5. Note any migration files that need updates

#### 10. **Best Practices**

- ✅ Always provide file paths with line numbers
- ✅ Include complete, runnable code examples
- ✅ Explain WHY the issue happens, not just WHAT
- ✅ Offer multiple solutions when applicable
- ✅ Consider edge cases and data migration
- ✅ Be specific about confidence and reasoning
- ❌ Don't guess - investigate thoroughly first
- ❌ Don't provide partial solutions
- ❌ Don't assume user knowledge level

---

## Issue 1: Email Verification Error When Changing Homeowner Email

### **Status**: ✅ Fixed

### **What Was Fixed**
1. **Loops Email Integration**: Fixed JSON syntax error in Supabase email template (missing colon after `newEmail`)
2. **Disabled Secure Email Change**: Turned off "Secure email change" in Supabase settings (now only requires confirmation from new email, not both)
3. **Added emailRedirectTo**: Updated `components/account-settings-form.tsx:334` and `app/admin/settings/page.tsx:72` to specify redirect URL:
   ```typescript
   const { error: authError } = await supabase.auth.updateUser(authPayload, {
     emailRedirectTo: window.location.origin,
   })
   ```

### **Current Behavior**
✅ User changes email in account settings
✅ Loops sends confirmation email to NEW email address
✅ User clicks confirmation link
✅ User lands on homepage with `?code=...`
✅ Supabase automatically processes code and updates email
✅ User stays logged in
✅ Email is successfully changed

**Note**: Success toast notification was not implemented due to complexity of distinguishing email change confirmations from other auth flows (signup, password reset, etc.). The email change works correctly, users just don't get visual feedback on the page.

### **Files Updated**
- `components/account-settings-form.tsx:334-336`
- `app/admin/settings/page.tsx:72-75`

### **Confidence Level**: 100%
Tested and confirmed working in production.

---

## Issue 3: Design System Font/Typography Architecture

### **Status**: ✅ Investigated

### **Current System**
Located in `app/globals.css:293-350`:

Current design system requirements:
- **Heading 1**: Figtree Semibold (600) • 48px → 60px (md) → 72px (lg) • -2px letter-spacing • line-height: 1
- **Heading 2**: Figtree Semibold (600) • 36px → 40px (md) → 42px (lg) • -1px letter-spacing • line-height: 1.2
- **Heading 3**: Figtree Semibold (600) • 26px → 30px (md) • -0.5px letter-spacing • line-height: 1.2
- **Heading 4**: Figtree Semibold (600) • 22px → 24px (md) • -0.3px letter-spacing • line-height: 1.2
- **Heading 5**: Figtree Semibold (600) • 18px → 20px (md) • 0 letter-spacing • line-height: 1.2
- **Heading 6**: Poppins Medium (500) • 14px → 16px (md) • 0 letter-spacing • line-height: 1.2
- **Heading 7**: Poppins Medium (500) • 14px • 0 letter-spacing • line-height: 1.2
- **Body Large**: Poppins Regular (400) • 16px → 18px (md)
- **Body Regular**: Poppins Regular (400) • 14px → 16px (md)
- **Body Small**: Poppins Regular (400) • 14px

### **The Problem**

The current approach uses **semantic HTML tags (h1-h6) with hardcoded visual styles**:
```css
h1 {
  @apply font-semibold text-5xl md:text-6xl lg:text-8xl;
  font-family: var(--font-heading);
  letter-spacing: -2px;
  line-height: 1;
}
```

**Issue**:
- An `<h1>` tag should be used for **semantic/SEO purposes** (document outline)
- But the visual style might need to be different (e.g., a page might need an h1 tag but styled as h3)
- This creates a conflict between **semantic HTML** and **visual design**

This is a classic design system anti-pattern where semantics are tightly coupled to visual presentation.

### **Solution: Decouple Semantics from Visuals**

**Best Practice Approach** (Recommended by design systems like Material UI, Tailwind, Chakra UI, shadcn/ui):

1. **Keep semantic HTML tags unstyled or minimally styled**
2. **Create utility classes for visual styles**
3. **Apply visual classes independently of semantic tags**

### **Implementation**

Replace the current `app/globals.css` typography section with:

```css
/* app/globals.css */

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground font-sans;
  }

  /* Minimal semantic styling - just reset to inherit */
  h1, h2, h3, h4, h5, h6 {
    font-weight: inherit;
    font-size: inherit;
    line-height: inherit;
    letter-spacing: inherit;
    margin: 0;
  }
}

/* Typography utility classes - visual styles */
@layer utilities {
  /* Heading 1 - Hero Image */
  .heading-1,
  .text-hero {
    @apply font-semibold text-[48px] md:text-[60px] lg:text-[72px];
    font-family: var(--font-heading);
    letter-spacing: -2px;
    line-height: 1;
  }

  /* Heading 2 - Category Cards */
  .heading-2,
  .text-display {
    @apply font-semibold text-[36px] md:text-[40px] lg:text-[42px];
    font-family: var(--font-heading);
    letter-spacing: -1px;
    line-height: 1.2;
  }

  /* Heading 3 - Page Titles */
  .heading-3,
  .text-title {
    @apply font-semibold text-[26px] md:text-[30px];
    font-family: var(--font-heading);
    letter-spacing: -0.5px;
    line-height: 1.2;
  }

  /* Heading 4 - Section Titles */
  .heading-4,
  .text-subtitle {
    @apply font-semibold text-[22px] md:text-[24px];
    font-family: var(--font-heading);
    letter-spacing: -0.3px;
    line-height: 1.2;
  }

  /* Heading 5 - Card Titles */
  .heading-5,
  .text-card-title {
    @apply font-semibold text-[18px] md:text-[20px];
    font-family: var(--font-heading);
    letter-spacing: 0;
    line-height: 1.2;
  }

  /* Heading 6 - Regular Headings */
  .heading-6 {
    @apply font-medium text-sm md:text-base;
    font-family: var(--font-sans);
    letter-spacing: 0;
    line-height: 1.2;
  }

  /* Heading 7 - Small Headings */
  .heading-7 {
    @apply font-medium text-sm;
    font-family: var(--font-sans);
    letter-spacing: 0;
    line-height: 1.2;
  }

  /* Body variations */
  .body-large {
    @apply font-normal text-base md:text-lg;
    font-family: var(--font-sans);
    line-height: 1.5;
  }

  .body-regular {
    @apply font-normal text-sm md:text-base;
    font-family: var(--font-sans);
    line-height: 1.5;
  }

  .body-small {
    @apply font-normal text-sm;
    font-family: var(--font-sans);
    line-height: 1.5;
  }
}
```

### **Usage Examples**

```tsx
{/* Semantic h1, styled as hero */}
<h1 className="heading-1">Welcome to Arco</h1>

{/* Semantic h2, but styled as h3 for visual hierarchy */}
<h2 className="heading-3">Section Title</h2>

{/* Semantic h1 for SEO, styled as subtitle */}
<h1 className="heading-4">Product Detail Page</h1>

{/* Div styled as heading when no semantic meaning needed */}
<div className="heading-2">Decorative Title</div>

{/* Paragraph with large body text */}
<p className="body-large">Hero paragraph text for "list with us" page</p>

{/* Default body text */}
<p className="body-regular">Standard paragraph text</p>
```

### **Migration Strategy**

1. **Phase 1**: Update `globals.css` with new utility classes (keep old h1-h6 styles temporarily)
2. **Phase 2**: Gradually update components to use utility classes:
   - Start with landing page
   - Move to professionals/projects pages
   - Update dashboard pages
3. **Phase 3**: Remove old h1-h6 styles from `globals.css` once all components migrated

### **Benefits**
- ✅ Semantic HTML for SEO and accessibility
- ✅ Visual flexibility (style any element as any heading)
- ✅ Design system consistency
- ✅ Easier to maintain and update styles
- ✅ Follows industry best practices (Tailwind, Material UI, Chakra)

### **Files to Update**:
- `app/globals.css` (lines 283-376)
- All component files using h1-h6 tags (gradual migration)

### **Confidence Level**: 95%
Very high confidence - this is a well-established design system pattern used by major frameworks. The solution will completely resolve the semantic vs. visual styling conflict.

---

## Issue 4: Company Not Visible in Professionals List

**Company ID**: `0b3b44d9-92aa-40e2-94e4-972038f8be50`

### **Status**: ✅ Fixed

### **Cause**
Located in `supabase/migrations/070_add_cover_photo_to_professional_search.sql:184-188` and `lib/professionals/queries.ts:388-417`:

```sql
WHERE
  p.is_available = TRUE
  AND p.company_plan_tier = 'plus'
  AND p.company_status = 'listed'
  AND (p.company_plan_expires_at IS NULL OR p.company_plan_expires_at > NOW())
```

The `search_professionals` function (which powers the `/professionals` discover page) filters out companies that don't meet ALL of these criteria:

1. **Has at least one professional with `is_available = TRUE`**
2. **Company `plan_tier = 'plus'`**
3. **Company `status = 'listed'`**
4. **Company `plan_expires_at` is NULL or in the future**

If any one of these conditions is false, the company won't appear in the list.

### **Diagnostic Queries**

Run these queries to identify the specific issue:

```sql
-- Check company status
SELECT
  id,
  name,
  status,
  plan_tier,
  plan_expires_at,
  plan_expires_at > NOW() as is_plan_active,
  created_at
FROM companies
WHERE id = '0b3b44d9-92aa-40e2-94e4-972038f8be50';

-- Check if company has available professionals
SELECT
  id,
  title,
  is_available,
  is_verified,
  company_id,
  created_at
FROM professionals
WHERE company_id = '0b3b44d9-92aa-40e2-94e4-972038f8be50';

-- Check what mv_professional_summary shows
SELECT
  id,
  company_name,
  company_status,
  company_plan_tier,
  company_plan_expires_at,
  is_available,
  is_verified
FROM mv_professional_summary
WHERE company_id = '0b3b44d9-92aa-40e2-94e4-972038f8be50';

-- Test search function directly
SELECT * FROM search_professionals(
  search_query := NULL,
  country_filter := NULL,
  state_filter := NULL,
  city_filter := NULL,
  category_filters := NULL,
  service_filters := NULL,
  min_rating := NULL,
  max_hourly_rate := NULL,
  verified_only := FALSE,
  limit_count := 100,
  offset_count := 0
) WHERE company_id = '0b3b44d9-92aa-40e2-94e4-972038f8be50';
```

### **Solutions Based on Diagnosis**

#### **Fix 1: Company Status is Not 'listed'**
```sql
UPDATE companies
SET status = 'listed'
WHERE id = '0b3b44d9-92aa-40e2-94e4-972038f8be50';
```

#### **Fix 2: Plan Tier is Not 'plus'**
```sql
UPDATE companies
SET plan_tier = 'plus'
WHERE id = '0b3b44d9-92aa-40e2-94e4-972038f8be50';
```

#### **Fix 3: Plan Has Expired**
```sql
UPDATE companies
SET plan_expires_at = NOW() + INTERVAL '1 year'
WHERE id = '0b3b44d9-92aa-40e2-94e4-972038f8be50';
```

Or set to NULL for unlimited:
```sql
UPDATE companies
SET plan_expires_at = NULL
WHERE id = '0b3b44d9-92aa-40e2-94e4-972038f8be50';
```

#### **Fix 4: No Available Professionals**
```sql
UPDATE professionals
SET is_available = TRUE
WHERE company_id = '0b3b44d9-92aa-40e2-94e4-972038f8be50'
LIMIT 1;
```

#### **Fix 5: Refresh Materialized View** (Required after any updates)
```sql
REFRESH MATERIALIZED VIEW mv_professional_summary;
```

### **Verification Query**
After applying fixes, verify the company appears:

```sql
SELECT
  company_id,
  company_name,
  company_status,
  company_plan_tier,
  is_available,
  display_rating,
  total_reviews
FROM mv_professional_summary
WHERE company_id = '0b3b44d9-92aa-40e2-94e4-972038f8be50';
```

### **Files Referenced**:
- `supabase/migrations/070_add_cover_photo_to_professional_search.sql`
- `lib/professionals/queries.ts:388-417`
- `app/professionals/page.tsx:22`

### **What Was Fixed**

**Root Cause**: The `refresh_all_materialized_views()` function was missing `mv_professional_summary` from its refresh list. When companies or professionals were updated, triggers would fire but only refresh `mv_company_listings` and `mv_project_summary`, leaving `mv_professional_summary` stale.

**The Fix**: Updated the refresh function to include all three materialized views:

```sql
CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_company_listings;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_professional_summary;  -- Added this line
  REFRESH MATERIALIZED VIEW public.mv_project_summary;
END;
$function$
```

**Immediate Fix for This Company**: Ran `REFRESH MATERIALIZED VIEW mv_professional_summary;` to make the company visible immediately.

**Long-term Fix**: Now all future company/professional updates will automatically refresh the professional summary view through existing triggers.

### **Confidence Level**: 100%
Tested and confirmed - company now appears in professionals list and will stay in sync automatically.

---

## Issue 5: Duplicate Listings When Multiple Professionals from Same Company Added to Project

### **Status**: ✅ Fixed

### **What Was Fixed**

Fixed the root cause in `app/new-project/professionals/page.tsx:659-680` - when a service category was removed, the code was NOT deleting the associated professional invites from the database.

**The Fix**: Updated `toggleService()` to delete ALL professional invites for a service category BEFORE deleting the service category itself:
1. First: Delete all `project_professionals` records for that service category
2. Then: Delete the service category from `project_professional_services`

**Result**:
- Service removal now properly cleans up all associated data
- No orphaned professional records left in database
- All 4 cards show correctly in the edit interface (no hidden duplicates)

### **Cause**
Located in `app/dashboard/listings/page.tsx:202-259`:

The issue occurs because the query fetches from the `project_professionals` table filtered by `company_id`:

```typescript
const { data, error } = await supabase
  .from("project_professionals")
  .select(`
    id,
    project_id,
    status,
    is_project_owner,
    invited_service_category_id,
    invited_service_category:categories!project_professionals_invited_service_category_id_fkey(name, slug),
    professional_id,
    projects!inner(...)
  `)
  .eq("company_id", professionalData.company_id)
  .neq("status", "rejected")
  .order("created_at", { ascending: false })
```

**The Problem**:
1. The query returns **one row per `project_professionals` record**
2. If a project has 2 professionals from the same company, it returns **2 rows** with the same project data
3. Line 248-259 maps each row to a project, creating **duplicate listings**
4. Even after removing a professional, the data may still have multiple records

**Example Scenario**:
- Project "Kitchen Remodel" exists
- User adds themselves as a professional → 1 `project_professionals` record → shows once ✅
- User adds another professional from their company → 2 `project_professionals` records → shows twice ❌
- Even after removing the second professional, if the record still exists, duplicates persist

### **Solution**

**Option 1: Deduplicate by Project ID** (Quickest Fix)

After fetching the data, deduplicate by `project_id` before transforming. Add this code after line 246:

```typescript
if (error) {
  if (isActive && !abortController.signal.aborted) {
    setLoadError(error.message)
    setProjects([])
    setIsLoading(false)
  }
  return
}

// DEDUPLICATION FIX: Remove duplicate project_professionals records for the same project
// Keep the record where the current professional is the owner, or the first record
const deduplicatedData = Object.values(
  (data ?? []).reduce((acc, pp) => {
    const projectId = pp.projects?.id
    if (!projectId) return acc

    // If we haven't seen this project yet, add it
    if (!acc[projectId]) {
      acc[projectId] = pp
      return acc
    }

    // If this record is for the current professional, prefer it
    if (pp.professional_id === professionalData.id) {
      acc[projectId] = pp
      return acc
    }

    // If this record is the project owner and existing isn't, prefer it
    if (pp.is_project_owner && !acc[projectId].is_project_owner) {
      acc[projectId] = pp
      return acc
    }

    // Otherwise keep the existing record
    return acc
  }, {} as Record<string, typeof data[0]>)
)

// Transform project_professionals data into project rows
const projectRows = (deduplicatedData ?? []).map(pp => ({
  ...pp.projects,
  project_professionals: [{ is_project_owner: pp.is_project_owner }],
  project_professional_id: pp.id,
  project_professional_status: pp.status,
  invited_service_category_id: pp.invited_service_category_id,
  invited_service_category: pp.invited_service_category
})) as (ProjectRow & {
  project_type_category: { name: string | null } | null
  invited_service_category?: { name: string | null } | null
})[]
```

**Option 2: Change Query Approach** (Better Long-term)

Instead of fetching all `project_professionals` for the company, fetch projects directly and join the professional relationship:

```typescript
// Get the current user's professional ID first
const currentProfessionalId = professionalData.id

// Fetch projects where ANY professional from this company is involved
const { data, error } = await supabase
  .from("projects")
  .select(`
    id,
    title,
    status,
    slug,
    project_type,
    project_type_category_id,
    style_preferences,
    address_city,
    address_region,
    created_at,
    updated_at,
    project_year,
    client_id,
    project_type_category:categories!projects_project_type_category_id_fkey(name, slug),
    project_photos(id, url, is_primary, order_index),
    project_professionals!inner(
      id,
      status,
      is_project_owner,
      professional_id,
      company_id,
      invited_service_category_id,
      invited_service_category:categories!project_professionals_invited_service_category_id_fkey(name, slug)
    )
  `)
  .eq("project_professionals.company_id", professionalData.company_id)
  .neq("project_professionals.status", "rejected")
  .order("created_at", { ascending: false })

// Then transform and pick the relevant project_professional relationship
const projectRows = (data ?? []).map(project => {
  // Find the project_professional record for the current user, or the first one
  const relevantPP = project.project_professionals?.find(
    pp => pp.professional_id === currentProfessionalId
  ) || project.project_professionals?.[0]

  return {
    ...project,
    project_professionals: [{ is_project_owner: relevantPP?.is_project_owner ?? false }],
    project_professional_id: relevantPP?.id,
    project_professional_status: relevantPP?.status,
    invited_service_category_id: relevantPP?.invited_service_category_id,
    invited_service_category: relevantPP?.invited_service_category
  }
})
```

**Note**: This approach may have issues with Supabase's query builder and filtering on nested relationships. Option 1 is safer.

**Option 3: Use DISTINCT in PostgreSQL** (If using RPC)

Create a database function that returns distinct projects for a company, but this requires a migration.

### **Recommendation**

Use **Option 1** (deduplication) as it's the quickest fix with minimal risk. It:
- ✅ Fixes the duplicate issue immediately
- ✅ Preserves the current professional's relationship to the project
- ✅ Handles edge cases (owner vs contributor)
- ✅ Requires minimal code changes
- ✅ No database migration needed

### **Files to Update**:
- `app/dashboard/listings/page.tsx:246-260`

### **Confidence Level**: 95%
Very high confidence - the root cause is clear (multiple `project_professionals` records), and the deduplication solution will resolve it immediately. The logic handles edge cases properly.

---

## Issue 6: Email Change Confirmation Email Not Being Sent (Homeowner Account Settings)

### **Status**: ✅ Investigated

### **Error Details**

From Supabase logs (2025-12-03T13:18:24Z):
```json
{
  "component": "api",
  "error": "gomail: could not send email 1: 450 Unexpected end of JSON input",
  "level": "error",
  "method": "PUT",
  "msg": "500: Error sending email change email",
  "path": "/user"
}
```

### **Cause**

Located in `components/account-settings-form.tsx:334`:

```typescript
const { error: authError } = await supabase.auth.updateUser(authPayload)
```

**The code is correct** - it properly calls `supabase.auth.updateUser({ email })` which triggers Supabase's built-in email change flow. The error is **server-side** (Supabase infrastructure), not in the application code.

**Root Cause Analysis**:

The error message "gomail: could not send email 1: 450 Unexpected end of JSON input" indicates:

1. **Supabase uses `gomail`** library for auth-related emails
2. **SMTP Error Code 450**: "Requested mail action not taken: mailbox unavailable" or configuration issue
3. **"Unexpected end of JSON input"**: The SMTP service received malformed JSON, likely from:
   - Malformed email template variables
   - Corrupted email template JSON in Supabase dashboard
   - SMTP provider API response parsing error

**Possible Causes**:
1. Email template for "Confirm email change" is missing or has malformed JSON/variables
2. SMTP credentials are incorrect or expired
3. SMTP provider (if custom) is returning invalid JSON responses
4. Supabase's default email service is experiencing issues

### **Is This Following Best Practices?**

**Yes, the current implementation follows best practices:**

✅ **Security**: Requires confirmation email to new address before changing (prevents account hijacking)
✅ **User Experience**: Shows clear message "Check your inbox - Confirm the email change to complete the update"
✅ **Standard Flow**: Uses Supabase's built-in email change confirmation (industry standard)
✅ **No Immediate Change**: Old email remains active until new email is confirmed

**The Flow**:
1. User enters new email and clicks "Update Profile"
2. Supabase sends confirmation email to **NEW** email address
3. User clicks link in email to confirm
4. Email is changed in auth system
5. Old email is replaced with new email

### **Solution**

This is a **Supabase configuration issue**, not a code issue. The fix requires dashboard access:

#### **Step 1: Check Email Templates** (Most Likely Fix)

1. Go to **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Find the **"Confirm email change"** template
3. Check for:
   - Template exists and is enabled
   - No syntax errors in the HTML/text content
   - Variables are correctly formatted: `{{ .Token }}`, `{{ .SiteURL }}`, `{{ .Email }}`
   - No stray characters, unclosed braces, or invalid JSON

**Example of correct template**:
```html
<h2>Confirm your new email address</h2>
<p>Follow this link to confirm your new email:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change">Confirm email change</a></p>
```

#### **Step 2: Verify SMTP Configuration**

1. Go to **Supabase Dashboard** → **Project Settings** → **Authentication**
2. Scroll to **SMTP Settings**
3. Check:
   - SMTP is enabled (if using custom SMTP)
   - Host, port, username, password are correct
   - TLS/SSL settings match your provider's requirements
   - Test the connection if possible

**If using Supabase's built-in email service**:
- Check if you've exceeded sending limits (free tier has limits)
- Verify your project is not paused or suspended

#### **Step 3: Check Email Confirmations Setting**

1. Go to **Supabase Dashboard** → **Authentication** → **Settings**
2. Verify **"Enable email confirmations"** is ON
3. Check **"Secure email change"** is enabled (requires confirmation from both old and new email)

#### **Step 4: Code Improvements** (Optional)

Add better error handling and validation in `components/account-settings-form.tsx:334-348`:

```typescript
// BEFORE line 286: Add email validation
if (!trimmedEmail) {
  toast.error("Email is required")
  return
}

// ADD: Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!emailRegex.test(trimmedEmail)) {
  toast.error("Invalid email address", {
    description: "Please enter a valid email address."
  })
  return
}

// ADD: Check if email is actually changing
if (trimmedEmail === currentEmail) {
  toast("No email change detected", {
    description: "Your email address is already set to this value."
  })
  return
}

// REPLACE line 334-341 with better error logging:
const { error: authError } = await supabase.auth.updateUser(authPayload)

if (authError) {
  // Log detailed error for debugging
  console.error('Email update error:', {
    code: authError.code,
    message: authError.message,
    status: authError.status,
    name: authError.name
  })

  // Show user-friendly message
  const errorMessage = authError.message || "Please try again later or contact support."
  toast.error("Could not update email", {
    description: errorMessage
  })
  return
}
```

### **Verification Steps**

After fixing Supabase configuration:

1. **Test email change**:
   - Log in to a test account
   - Go to `/homeowner?tab=account`
   - Change email to a valid address you control
   - Check for success message

2. **Check inbox**:
   - Verify confirmation email arrives at NEW email address
   - Check spam folder if not in inbox
   - Confirm email has clickable link

3. **Confirm change**:
   - Click link in email
   - Verify you're redirected to the site
   - Log out and log in with NEW email

4. **Monitor logs**:
   - Check Supabase logs for any errors
   - Verify no "gomail" errors appear

### **Recommendation**

**Priority**: High (blocks critical user functionality)

**Action Plan**:
1. ✅ **Immediate**: Check email templates in Supabase dashboard (5 minutes)
2. ✅ **If that fails**: Verify SMTP configuration (10 minutes)
3. ✅ **If that fails**: Contact Supabase support with error logs
4. ⚡ **Optional**: Add improved error handling to code (15 minutes)

### **Files Referenced**:
- `components/account-settings-form.tsx:334-348` (email change implementation)
- `app/homeowner/page.tsx:202-205` (account settings tab)

### **Confidence Level**: 90%

High confidence - this is definitely a Supabase email configuration issue. The error message "gomail: could not send email" confirms it's server-side. The most likely fix is checking/fixing the email template in the Supabase dashboard.

---

## Issue 7: Plans Banner Visible on Company Page After Signup

### **Status**: ✅ Fixed

### **What Was Fixed**

Commented out the upgrade banner in `components/company-settings/company-settings-shell.tsx:823-837` to hide it from the company settings page.

**The Fix**: Wrapped the entire banner section in a multi-line comment block instead of deleting it, making it easy to restore if needed later.

**Result**: The upgrade banner no longer appears on the company settings page after signup, reducing friction during onboarding.

### **Cause**

Located in `components/company-settings/company-settings-shell.tsx:823-835`:

```typescript
const showUpgradeBanner = planTier === "basic" && isUpgradeEligible

// ...later in the render:
{showUpgradeBanner && (
  <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h4 className="font-semibold text-foreground">Upgrade to appear in homeowner searches</h4>
        <p className="text-sm text-text-secondary">Become findable by thousands of homeowners</p>
      </div>
      <Button asChild className="bg-red-500 text-white hover:bg-red-600">
        <Link href="/dashboard/pricing">View plans</Link>
      </Button>
    </div>
  </div>
)}
```

**The Problem**:
- The banner shows to **all Basic plan users** who are `upgrade_eligible`
- This appears immediately after signup when users are still setting up their company
- Creates friction and pressure during onboarding
- The pricing page is already accessible from the hamburger menu (or will be after Issue 9 is fixed)

### **Solution**

**Remove the upgrade banner entirely** from the company settings page:

```typescript
// DELETE lines 179 and 823-835 in company-settings/company-settings-shell.tsx

// REMOVE line 179:
const showUpgradeBanner = planTier === "basic" && isUpgradeEligible

// REMOVE lines 823-835:
{showUpgradeBanner && (
  <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h4 className="font-semibold text-foreground">Upgrade to appear in homeowner searches</h4>
        <p className="text-sm text-text-secondary">Become findable by thousands of homeowners</p>
      </div>
      <Button asChild className="bg-red-500 text-white hover:bg-red-600">
        <Link href="/dashboard/pricing">View plans</Link>
      </Button>
    </div>
  </div>
)}
```

### **Recommendation**

Remove the banner because:
- ✅ Reduces friction during company setup
- ✅ Pricing is already accessible via hamburger menu (after Issue 9 fix)
- ✅ Less intrusive user experience
- ✅ Users can discover pricing when they're ready

### **Files to Update**:
- `components/company-settings/company-settings-shell.tsx:179, 823-835`

### **Confidence Level**: 100%

Absolute confidence - the banner code is clearly visible and needs to be deleted. This is a straightforward removal.

---

## Issue 8: Remove Pricing Link from Footer

### **Status**: ✅ Fixed

### **What Was Fixed**

Commented out the "Pricing" link from the footer in two places:
1. `components/footer.tsx:6` - Removed "Pricing" from the footerLinks array
2. `components/footer.tsx:41-46` - Commented out the Pricing link rendering logic

**The Fix**: Used inline comments to hide "Pricing" from the footer while preserving the code for potential future use.

**Result**: The public pricing link no longer appears in the footer, reducing confusion between public pricing (`/pricing`) and dashboard pricing (`/dashboard/pricing`).

### **Cause**

Located in `components/footer.tsx:6, 41-44`:

```typescript
const footerLinks = {
  Products: ["Projects", "Professionals"],
  "For Business": ["List with us", "Pricing"], // ← Pricing here
  Arco: ["About", "Help center"],
}

// ...later in the render:
{link === "Pricing" ? (
  <Link href="/pricing" className="inline-block text-xs md:text-sm text-foreground px-2 md:px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary">
    {link}
  </Link>
) : // ... other links
```

**The Problem**:
- The public pricing page (`/pricing`) is for **public visitors** considering signing up
- The **dashboard pricing page** (`/dashboard/pricing`) is for **logged-in professionals**
- Having both creates confusion about which pricing page to use
- The dashboard pricing page should only be accessible from the professional hamburger menu

### **Solution**

Remove "Pricing" from the footer links:

```typescript
// REPLACE line 6 in components/footer.tsx:
const footerLinks = {
  Products: ["Projects", "Professionals"],
  "For Business": ["List with us"], // ← Remove "Pricing"
  Arco: ["About", "Help center"],
}

// REMOVE lines 41-44 in components/footer.tsx:
// Delete this entire conditional block:
{link === "Pricing" ? (
  <Link href="/pricing" className="inline-block text-xs md:text-sm text-foreground px-2 md:px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary">
    {link}
  </Link>
) : // ... rest remains
```

After removal, the footer rendering will automatically skip the Pricing link since it's no longer in the array.

### **Recommendation**

Remove the pricing link because:
- ✅ Simplifies navigation structure
- ✅ Pricing page is accessible from professional menu (Issue 9)
- ✅ Reduces confusion between public and dashboard pricing pages
- ✅ Cleaner footer layout

### **Files to Update**:
- `components/footer.tsx:6` (remove "Pricing" from array)
- `components/footer.tsx:41-44` (remove conditional rendering block)

### **Confidence Level**: 100%

Absolute confidence - straightforward removal of array item and its rendering logic.

---

## Issue 9: Update Professional Hamburger Menu & Pricing Page Styling

### **Status**: ✅ Fixed

### **What Was Fixed**

**Part A: Hamburger Menu** (`components/dashboard-header.tsx:322-338`)
- Uncommented the Pricing section
- Changed "Upgrade plan" to "Pricing"
- Removed "Billing" link (not implemented)
- Moved Pricing into the same section as Account (no divider between them)
- Pricing appears above Account in the menu

**Menu Structure**:
- Section 1: My Listings / My Projects
- **Divider**
- Section 2: **Pricing**, **Account** (same section)
- **Divider**
- Section 3: Help & Sign out

**Part B: Pricing Page Styling** (`app/dashboard/pricing/page.tsx`)
1. **Line 53**: Changed background from `bg-surface` to `bg-white`
2. **Lines 83-85**: Updated Basic plan button to show:
   - "Downgrade to Basic" if user has Plus plan
   - "Current plan" if user doesn't have Plus
   - Button is disabled when user has Plus

**Result**:
- Pricing is now accessible from the professional hamburger menu (same section as Account)
- Pricing page has clean white background matching dashboard
- Button states correctly reflect user's current plan

### **Part A: Add Pricing to Professional Hamburger Menu**

#### **Cause**

Located in `components/dashboard-header.tsx:322-341`:

```typescript
{/* Section 2: Upgrade plan & Billing - COMMENTED OUT */}
{/* <div className="px-4 py-3">
  <Link
    href="/dashboard/pricing"
    className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
    onClick={() => setIsMenuOpen(false)}
  >
    Upgrade plan
  </Link>
  <Link
    href="/dashboard/billing"
    className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
    onClick={() => setIsMenuOpen(false)}
  >
    Billing
  </Link>
</div> */}
```

**The Problem**:
- The "Upgrade plan" link is commented out
- Pricing page is live at `/dashboard/pricing` but not accessible from menu
- Users can't easily discover pricing options

#### **Solution**

Uncomment and update the menu section to add "Pricing" above "Account":

```typescript
// REPLACE lines 322-353 in components/dashboard-header.tsx with:

{/* Section 2: Pricing */}
<div className="px-4 py-3">
  <Link
    href="/dashboard/pricing"
    className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
    onClick={() => setIsMenuOpen(false)}
  >
    Pricing
  </Link>
</div>

{/* Divider */}
<div className="border-t border-border" />

{/* Section 3: Account */}
<div className="px-4 py-3">
  <Link
    href="/dashboard/settings"
    className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
    onClick={() => setIsMenuOpen(false)}
  >
    Account
  </Link>
</div>

{/* Divider */}
<div className="border-t border-border" />

{/* Section 4: Help & Sign out */}
<div className="px-4 py-3">
  {/* ... rest of the menu items remain the same ... */}
</div>
```

### **Part B: Update Pricing Page Styling**

#### **Cause**

Located in `app/dashboard/pricing/page.tsx:53, 63-86, 121-122`:

**Issues**:
1. **Background color**: Line 53 has `bg-surface` (should be `bg-white`)
2. **Current plan logic**: Lines 83-85 show "Current plan" button for Basic, but Plus should be the current plan during beta
3. **Button state**: Line 121-122 shows "Current plan" for Plus only when `isPlus` is true

**The Problem**:
- Page background is gray (`bg-surface`) instead of white
- During beta, everyone should have Plus plan automatically
- The "Current plan" button shows for Basic by default, not Plus

#### **Solution**

**Fix 1: Change background to white** (line 53):
```typescript
// BEFORE:
<div className="flex min-h-screen flex-col bg-surface">

// AFTER:
<div className="flex min-h-screen flex-col bg-white">
```

**Fix 2: Update Basic plan button** (lines 83-85):
```typescript
// BEFORE:
<Button variant="quaternary" size="quaternary" className="w-full" disabled>
  Current plan
</Button>

// AFTER:
<Button variant="tertiary" size="tertiary" className="w-full" disabled={isPlus}>
  {isPlus ? "Downgrade to Basic" : "Current plan"}
</Button>
```

**Fix 3: Update Plus plan button logic** (lines 116-131):
```typescript
// The existing logic is actually correct:
<Button
  className="w-full bg-red-500 text-white hover:bg-red-600"
  onClick={handleUpgrade}
  disabled={!canAttemptUpgrade || isUpgrading}
>
  {isPlus ? (
    "Current plan"  // ← Shows when user has Plus
  ) : isUpgrading ? (
    <span className="flex items-center justify-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      Upgrading…
    </span>
  ) : (
    "Upgrade to Plus"
  )}
</Button>
```

**Note**: The Plus button logic is already correct. The issue is that new signups aren't automatically getting `plan_tier = 'plus'` in the database. This needs to be fixed in the signup flow or database default.

### **Recommendation**

**For Part A (Hamburger Menu)**:
- ✅ Makes pricing easily discoverable
- ✅ Clean single "Pricing" link (removed "Billing" as it's not implemented)
- ✅ Positioned logically above "Account"

**For Part B (Pricing Page)**:
- ✅ White background matches rest of dashboard
- ✅ Clear indication of current plan
- ✅ Consistent with beta messaging (everyone gets Plus free)

### **Files to Update**:
- `components/dashboard-header.tsx:322-353` (uncomment and update menu)
- `app/dashboard/pricing/page.tsx:53` (change background to white)
- `app/dashboard/pricing/page.tsx:83-85` (update Basic button logic)

### **Additional Fix Needed**:
Ensure new company signups automatically get `plan_tier = 'plus'` set in the database. Check:
- `app/create-company/actions.ts` or equivalent signup logic
- Database default value for `companies.plan_tier` column

### **Confidence Level**: 95%

High confidence - all code locations are identified and solutions are straightforward. The only unknown is whether the signup flow automatically sets `plan_tier = 'plus'` for new users during beta.

---

## Issue 10: Integrate Apollo Tracking Script

### **Status**: ✅ Fixed

### **What Was Fixed**

Added Apollo tracking script to `app/layout.tsx:81-100` to enable B2B visitor tracking and company identification.

**The Implementation**:
- Added Apollo tracking script after marker-io script
- Uses Next.js `Script` component with `afterInteractive` strategy
- Loads tracker.iife.js asynchronously with cache-busting
- Configured with appId: `6901dcfac03d1f001da74d43`

### **Original Cause**

No analytics tracking is currently configured. Apollo.io provides visitor tracking and identification for B2B sales and marketing.

**The Problem**:
- No way to track visitor behavior on the site
- Can't identify companies visiting the site
- Missing sales intelligence data

### **Solution**

Add Apollo tracking script to the main layout **before the closing `</head>` tag** (or in the `<head>` section via Next.js Script component):

Located in `app/layout.tsx`, add after the existing scripts (around line 80):

```typescript
// app/layout.tsx - ADD after line 80 (after marker-io script):

<Script
  id="apollo-tracking"
  strategy="afterInteractive"
  dangerouslySetInnerHTML={{
    __html: `
      function initApollo(){
        var n=Math.random().toString(36).substring(7),
        o=document.createElement("script");
        o.src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache="+n,
        o.async=!0,
        o.defer=!0,
        o.onload=function(){
          window.trackingFunctions.onLoad({appId:"6901dcfac03d1f001da74d43"})
        },
        document.head.appendChild(o)
      }
      initApollo();
    `,
  }}
/>
```

**Complete updated layout.tsx body section** (lines 59-82):

```typescript
<body className={poppins.className}>
  <RootProviders initialSession={session}>{children}</RootProviders>
  {mapsApiKey && (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places,marker&loading=async`}
      strategy="afterInteractive"
    />
  )}
  <Script
    id="marker-io"
    strategy="afterInteractive"
    dangerouslySetInnerHTML={{
      __html: `
        window.markerConfig = {
          project: '68fbacbc9e451201c9b6cb10',
          source: 'snippet'
        };

        !function(e,r,a){if(!e.__Marker){e.__Marker={};var t=[],n={__cs:t};["show","hide","isVisible","capture","cancelCapture","unload","reload","isExtensionInstalled","setReporter","clearReporter","setCustomData","on","off"].forEach(function(e){n[e]=function(){var r=Array.prototype.slice.call(arguments);r.unshift(e),t.push(r)}}),e.Marker=n;var s=r.createElement("script");s.async=1,s.src="https://edge.marker.io/latest/shim.js";var i=r.getElementsByTagName("script")[0];i.parentNode.insertBefore(s,i)}}(window,document);
      `,
    }}
  />
  <Script
    id="apollo-tracking"
    strategy="afterInteractive"
    dangerouslySetInnerHTML={{
      __html: `
        function initApollo(){
          var n=Math.random().toString(36).substring(7),
          o=document.createElement("script");
          o.src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache="+n,
          o.async=!0,
          o.defer=!0,
          o.onload=function(){
            window.trackingFunctions.onLoad({appId:"6901dcfac03d1f001da74d43"})
          },
          document.head.appendChild(o)
        }
        initApollo();
      `,
    }}
  />
</body>
```

### **Verification Steps**

After deploying:

1. **Test script loads**:
   - Open any page on the site
   - Open DevTools → Console
   - Check for Apollo tracking initialization logs
   - Verify no JavaScript errors

2. **Verify in Apollo dashboard**:
   - Go to Apollo.io settings
   - Navigate to tracking/website tracker section
   - Test the connection (should show green/active status)
   - Wait 5-10 minutes for first data to appear

3. **Check network requests**:
   - Open DevTools → Network tab
   - Filter by "apollo" or "tracking"
   - Verify tracking requests are being sent

### **Recommendation**

Add Apollo tracking because:
- ✅ Provides B2B visitor identification
- ✅ Tracks company accounts visiting the site
- ✅ Integrates with sales workflow
- ✅ No performance impact (async loading)

### **Files to Update**:
- `app/layout.tsx:80-82` (add Apollo script after marker.io)

### **Confidence Level**: 100%

Absolute confidence - standard third-party script integration following Next.js best practices with the Script component.

---

## Issue 11: Integrate PostHog Analytics Script

### **Status**: ✅ Fixed

### **What Was Fixed**

Added PostHog analytics script to `app/layout.tsx:101-139` to enable comprehensive product analytics, session recording, and feature flags.

**The Implementation**:
- Added PostHog tracking script after Apollo script
- Uses Next.js `Script` component with `afterInteractive` strategy
- Loads from EU-hosted PostHog instance (GDPR compliant)
- Configured with project key: `phc_l2sj1VywF62O0tnCg8tAOsOrvsqdlZ1njSr7KlAg3WD`
- Set to `person_profiles: 'identified_only'` (only tracks logged-in users as profiles)

### **Original Cause**

No product analytics tracking is currently configured. PostHog provides:
- Autocapture of user events
- Session recording
- Feature flags
- A/B testing
- Product analytics

**The Problem**:
- No visibility into user behavior and product usage
- Can't track conversion funnels
- Missing session recordings for debugging UX issues
- No feature flag system for gradual rollouts

### **Solution**

Add PostHog analytics script to the main layout **before the closing `</head>` tag**:

Located in `app/layout.tsx`, add after Apollo script (around line 110):

```typescript
// app/layout.tsx - ADD after Apollo script:

<Script
  id="posthog-analytics"
  strategy="afterInteractive"
  dangerouslySetInnerHTML={{
    __html: `
      !function(t,e){
        var o,n,p,r;
        e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){
          function g(t,e){
            var o=e.split(".");
            2==o.length&&(t=t[o[0]],e=o[1]),
            t[e]=function(){
              t.push([e].concat(Array.prototype.slice.call(arguments,0)))
            }
          }
          (p=t.createElement("script")).type="text/javascript",
          p.crossOrigin="anonymous",
          p.async=!0,
          p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",
          (r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);
          var u=e;
          for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){
            var e="posthog";
            return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e
          },u.people.toString=function(){
            return u.toString(1)+".people (stub)"
          },o="init Rr Mr fi Cr Ar ci Tr Fr capture Mi calculateEventProperties Lr register register_once register_for_session unregister unregister_for_session Hr getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Ur jr createPersonProfile zr kr Br opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Dr debug M Nr getPageViewId captureTraceFeedback captureTraceMetric $r".split(" "),n=0;n<o.length;n++)
            g(u,o[n]);
          e._i.push([i,s,a])
        },e.__SV=1)
      }(document,window.posthog||[]);

      posthog.init('phc_l2sj1VywF62O0tnCg8tAOsOrvsqdlZ1njSr7KlAg3WD', {
        api_host: 'https://eu.i.posthog.com',
        person_profiles: 'identified_only'
      });
    `,
  }}
/>
```

**Complete updated layout.tsx with all scripts** (lines 59-115):

```typescript
<body className={poppins.className}>
  <RootProviders initialSession={session}>{children}</RootProviders>
  {mapsApiKey && (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places,marker&loading=async`}
      strategy="afterInteractive"
    />
  )}
  <Script
    id="marker-io"
    strategy="afterInteractive"
    dangerouslySetInnerHTML={{
      __html: `
        window.markerConfig = {
          project: '68fbacbc9e451201c9b6cb10',
          source: 'snippet'
        };

        !function(e,r,a){if(!e.__Marker){e.__Marker={};var t=[],n={__cs:t};["show","hide","isVisible","capture","cancelCapture","unload","reload","isExtensionInstalled","setReporter","clearReporter","setCustomData","on","off"].forEach(function(e){n[e]=function(){var r=Array.prototype.slice.call(arguments);r.unshift(e),t.push(r)}}),e.Marker=n;var s=r.createElement("script");s.async=1,s.src="https://edge.marker.io/latest/shim.js";var i=r.getElementsByTagName("script")[0];i.parentNode.insertBefore(s,i)}}(window,document);
      `,
    }}
  />
  <Script
    id="apollo-tracking"
    strategy="afterInteractive"
    dangerouslySetInnerHTML={{
      __html: `
        function initApollo(){
          var n=Math.random().toString(36).substring(7),
          o=document.createElement("script");
          o.src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache="+n,
          o.async=!0,
          o.defer=!0,
          o.onload=function(){
            window.trackingFunctions.onLoad({appId:"6901dcfac03d1f001da74d43"})
          },
          document.head.appendChild(o)
        }
        initApollo();
      `,
    }}
  />
  <Script
    id="posthog-analytics"
    strategy="afterInteractive"
    dangerouslySetInnerHTML={{
      __html: `
        !function(t,e){
          var o,n,p,r;
          e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){
            function g(t,e){
              var o=e.split(".");
              2==o.length&&(t=t[o[0]],e=o[1]),
              t[e]=function(){
                t.push([e].concat(Array.prototype.slice.call(arguments,0)))
              }
            }
            (p=t.createElement("script")).type="text/javascript",
            p.crossOrigin="anonymous",
            p.async=!0,
            p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",
            (r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);
            var u=e;
            for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){
              var e="posthog";
              return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e
            },u.people.toString=function(){
              return u.toString(1)+".people (stub)"
            },o="init Rr Mr fi Cr Ar ci Tr Fr capture Mi calculateEventProperties Lr register register_once register_for_session unregister unregister_for_session Hr getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Ur jr createPersonProfile zr kr Br opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Dr debug M Nr getPageViewId captureTraceFeedback captureTraceMetric $r".split(" "),n=0;n<o.length;n++)
              g(u,o[n]);
            e._i.push([i,s,a])
          },e.__SV=1)
        }(document,window.posthog||[]);

        posthog.init('phc_l2sj1VywF62O0tnCg8tAOsOrvsqdlZ1njSr7KlAg3WD', {
          api_host: 'https://eu.i.posthog.com',
          person_profiles: 'identified_only'
        });
      `,
    }}
  />
</body>
```

### **Verification Steps**

After deploying:

1. **Test script loads**:
   - Open any page on the site
   - Open DevTools → Console
   - Type `posthog` and press Enter
   - Verify PostHog object exists with methods

2. **Check PostHog dashboard**:
   - Go to PostHog dashboard (eu.i.posthog.com)
   - Navigate to Settings → Project
   - Check "Event Ingestion" status (should show green)
   - Wait 5-10 minutes for first events to appear

3. **Verify events are captured**:
   - Go to PostHog dashboard → Events
   - Filter by event type (pageview, clicks, etc.)
   - Verify events are being recorded
   - Check session recordings are capturing (if enabled)

4. **Check network requests**:
   - Open DevTools → Network tab
   - Filter by "posthog" or "i.posthog.com"
   - Verify tracking requests are being sent

### **PostHog Configuration**

**Note about `person_profiles: 'identified_only'`**:
- Only creates user profiles for identified users (logged in)
- Anonymous users don't create profiles (saves costs)
- To track all users including anonymous: change to `person_profiles: 'always'`

**Recommended next steps** (in PostHog dashboard):
1. **Enable session recording**: Settings → Recordings → Enable
2. **Set up conversion funnels**: Insights → New Insight → Funnel
3. **Configure autocapture**: Settings → Autocapture → Enable (if not already)
4. **Set up feature flags**: Feature Flags → New Feature Flag

### **Recommendation**

Add PostHog analytics because:
- ✅ Comprehensive product analytics and event tracking
- ✅ Session recording for debugging UX issues
- ✅ Feature flags for gradual rollouts
- ✅ No performance impact (async loading)
- ✅ EU-hosted (GDPR compliant)
- ✅ Identifies logged-in users automatically

### **Files to Update**:
- `app/layout.tsx:110-115` (add PostHog script after Apollo)

### **Confidence Level**: 100%

Absolute confidence - standard PostHog installation following Next.js best practices and PostHog's official documentation.

---

## Issue 5A: Duplicate Professionals in Admin Approval Modal

### **Status**: ✅ Fixed

### **What Was Fixed**

This was the same root cause as Issue 5 - fixed by the service removal cleanup.

**Why This Happened**:
- Admin modal was showing ALL `project_professionals` records
- When service categories were removed, orphaned professional records stayed in the database
- These orphaned records appeared as duplicates in the modal

**The Fix**: Same as Issue 5 - fixing the service removal to properly delete professionals resolved both issues.

**Result**: Admin approval modal now correctly shows only the professionals that actually belong to selected service categories.

### **Related To**: Issue 5 (Duplicate Listings)

### **Original Cause**

Located in `components/admin-projects-table.tsx:676-697`:

```typescript
const { data: professionals } = await supabase
  .from('project_professionals')
  .select(`
    invited_email,
    status,
    professional_id,
    is_project_owner,
    professionals(
      companies(name)
    )
  `)
  .eq('project_id', project.id)

const processedProfessionals = (professionals || []).map(prof => ({
  email: prof.invited_email,
  status: prof.status,
  professional_id: prof.professional_id,
  is_project_owner: prof.is_project_owner,
  company_name: prof.professionals?.companies?.name || null
}))

setApprovalProfessionals(processedProfessionals)
```

**The Problem**:
- The query fetches **ALL** `project_professionals` records without any deduplication
- If a project owner adds the same professional twice (duplicate records in database), both records appear in the modal
- Even if the user "removes" one duplicate from the edit listing page, if the database record wasn't properly deleted, it still shows in the approval modal
- The modal queries the database directly without filtering or deduplicating, so it shows the raw database state
- This is the same root cause as Issue 5, but manifesting in a different location (admin approval modal vs. listings page)

**Example Scenario**:
1. User adds professional "john@example.com" to project
2. User accidentally adds same professional "john@example.com" again (duplicate database record created)
3. User removes one from edit listing page (one record deleted, but maybe not both)
4. On edit listing page, deduplication might hide the duplicate
5. In admin approval modal, ALL database records appear, showing the duplicate

### **Solution**

**Deduplicate professionals in the approval modal** (same approach as Issue 5):

```typescript
// REPLACE lines 676-697 in components/admin-projects-table.tsx:

const { data: professionals } = await supabase
  .from('project_professionals')
  .select(`
    invited_email,
    status,
    professional_id,
    is_project_owner,
    professionals(
      companies(name)
    )
  `)
  .eq('project_id', project.id)

// ADD: Deduplicate by email address
const seenEmails = new Map<string, any>()
const processedProfessionals = (professionals || []).map(prof => ({
  email: prof.invited_email,
  status: prof.status,
  professional_id: prof.professional_id,
  is_project_owner: prof.is_project_owner,
  company_name: prof.professionals?.companies?.name || null
})).filter(prof => {
  const email = prof.email?.toLowerCase()
  if (!email) return true // Keep professionals without email (shouldn't happen)

  if (seenEmails.has(email)) {
    // Already seen this email - skip duplicate
    // Prefer project owners over non-owners
    const existing = seenEmails.get(email)
    if (prof.is_project_owner && !existing.is_project_owner) {
      seenEmails.set(email, prof)
      return true // Replace existing with owner version
    }
    return false // Skip duplicate
  }

  seenEmails.set(email, prof)
  return true
})

setApprovalProfessionals(Array.from(seenEmails.values()))
```

### **Alternative Solution**

**Fix at database level by preventing duplicates**:

Add a unique constraint on `project_professionals` table:

```sql
-- Migration: Add unique constraint to prevent duplicate invites
ALTER TABLE project_professionals
ADD CONSTRAINT project_professionals_project_email_unique
UNIQUE (project_id, invited_email);
```

**Note**: This will prevent future duplicates but won't remove existing duplicates. You'll need to clean up existing data first:

```sql
-- Clean up existing duplicates before adding constraint
-- Keep the oldest record for each project_id + invited_email combination
DELETE FROM project_professionals pp1
USING project_professionals pp2
WHERE pp1.id > pp2.id
  AND pp1.project_id = pp2.project_id
  AND pp1.invited_email = pp2.invited_email;
```

### **Recommendation**

Use **both solutions**:
1. ✅ **Immediate fix**: Add deduplication to approval modal (lines 676-697)
2. ✅ **Long-term fix**: Add database constraint to prevent future duplicates
3. ✅ **Cleanup**: Run SQL to remove existing duplicates before adding constraint

This ensures:
- Immediate resolution of modal display issue
- Prevention of future duplicates
- Database integrity

### **Files to Update**:
- `components/admin-projects-table.tsx:676-697` (add deduplication logic)
- Database migration: Add unique constraint (optional but recommended)

### **Confidence Level**: 95%

Very high confidence - the root cause is identical to Issue 5 (no deduplication), and the solution is straightforward deduplication logic.

---

## Issue 12: Approval Emails Not Being Sent on Project Publish

### **Status**: ✅ Verified Working

### **What Was Found**

After investigation, the email system is working correctly:
- `LOOPS_API_KEY` is properly configured in `.env.local`
- Template IDs are correct in `lib/email-service.ts`
- Email sending logic in `app/admin/projects/actions.ts` (lines 241-441) is properly implemented
- Code sends emails to project owner AND all invited professionals when publishing

**No changes were needed.** The system works as expected.

### **Cause**

Located in `app/admin/projects/actions.ts:240-441`:

**The email sending code IS implemented** and SHOULD be working:

```typescript
// Lines 241-441: Email sending logic when status is "published"
if (statusResult.data === "published") {
  // Send project live email to owner (lines 325-357)
  await sendProjectStatusEmail(ownerEmail, 'live', {...})

  // Get ALL professional invites and send emails (lines 359-430)
  const { data: invites } = await supabase
    .from('project_professionals')
    .select('id, invited_email')
    .eq('project_id', idResult.data)
    .neq('status', 'rejected')

  for (const invite of invites || []) {
    // Skip project owner
    if (ownerEmail && invite.invited_email.toLowerCase() === ownerEmail.toLowerCase()) {
      continue
    }

    // Generate smart URL and send invite email
    const { confirmUrl } = await checkUserAndGenerateInviteUrl(
      invite.invited_email,
      idResult.data
    )

    await sendProfessionalInviteEmail(
      invite.invited_email,
      {
        project_owner: ownerFullName,
        project_name: project?.title || 'Project',
        project_title: project?.title || 'Project',
        confirmUrl
      }
    )
  }
}
```

**Why Emails Might Not Be Sent**:

1. **LOOPS_API_KEY not configured**: In `lib/email-service.ts:62-67`, if the API key is missing, emails silently fail
   ```typescript
   const apiKey = process.env.LOOPS_API_KEY
   if (!apiKey) {
     console.error('LOOPS_API_KEY environment variable is required')
     return { success: false, message: 'Email service not configured' }
   }
   ```

2. **Template IDs incorrect**: Lines 38-43 of `email-service.ts` define template IDs. If these IDs don't match Loops dashboard, emails fail:
   ```typescript
   const EMAIL_TEMPLATES: Record<EmailTemplate, string> = {
     'project-live': 'cmgrix7ib81tdy80igwg27jzi',
     'professional-invite': 'cmh2bhml30enxyw0jgvk31c3s'
   }
   ```

3. **Errors are caught but not surfaced**: Lines 309-316, 344-350, 422-429 catch email errors and log them, but only add warnings to the response. Admins don't see these errors in the UI:
   ```typescript
   catch (emailError) {
     logger.error("Failed to send project live email", {...})
     // NO toast.error() or UI feedback!
   }
   ```

4. **Query returns no invites**: Line 361-365 fetches invites with `.neq('status', 'rejected')`. If all professionals have status 'rejected' or the query fails, no emails are sent.

5. **Loops.so API issues**: API might be down, rate-limited, or templates might be deleted

### **Solution**

#### **Step 1: Verify LOOPS_API_KEY Environment Variable**

1. Check `.env.local` or hosting platform (Vercel) environment variables
2. Verify `LOOPS_API_KEY` is set and valid
3. Get API key from: https://app.loops.so/settings?page=api

```bash
# Check if env var is set (in production deployment settings)
# Vercel: Project Settings → Environment Variables
# Local: .env.local file

LOOPS_API_KEY=your_api_key_here
```

#### **Step 2: Verify Template IDs in Loops Dashboard**

1. Go to https://app.loops.so/transactional
2. Find the two templates:
   - **"Project Live"** (for project owners)
   - **"Professional Invite"** (for invited professionals)
3. Copy their template IDs and update `lib/email-service.ts:40-42`:

```typescript
const EMAIL_TEMPLATES: Record<EmailTemplate, string> = {
  'project-live': 'YOUR_ACTUAL_PROJECT_LIVE_ID',  // Line 40
  'professional-invite': 'YOUR_ACTUAL_INVITE_ID'   // Line 42
}
```

#### **Step 3: Add UI Error Feedback**

Update `app/admin/projects/actions.ts` to surface email errors to admins:

**Option A: Add warnings to response** (lines 350, 316, 429):

```typescript
// AFTER line 350 (project live email error):
} catch (emailError) {
  logger.error("Failed to send project live email", {...})
  warnings.push("⚠️ Project published but owner notification email failed to send.")
}

// AFTER line 316 (rejection email error):
} catch (emailError) {
  logger.error("Failed to send project rejection email", {...})
  warnings.push("⚠️ Project rejected but owner notification email failed to send.")
}

// AFTER line 429 (invite email error):
} catch (inviteEmailError) {
  logger.error("Failed to send professional invite email", {...})
  warnings.push(`⚠️ Invite email failed for ${invite.invited_email}`)
}
```

**Option B: Check LOOPS_API_KEY on startup** (add to `email-service.ts`):

```typescript
// ADD at bottom of lib/email-service.ts:
export function validateEmailConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!process.env.LOOPS_API_KEY) {
    errors.push('LOOPS_API_KEY environment variable is not set')
  }

  // Verify all template IDs are configured
  Object.entries(EMAIL_TEMPLATES).forEach(([template, id]) => {
    if (!id || id.trim().length === 0) {
      errors.push(`Template ID for '${template}' is not configured`)
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}
```

Then call this in admin dashboard or startup check.

#### **Step 4: Debug Professional Invites Query**

Add logging to see if invites are being fetched:

```typescript
// ADD AFTER line 365 in app/admin/projects/actions.ts:

const { data: invites, error: invitesError } = await supabase
  .from('project_professionals')
  .select('id, invited_email, status')  // ADD status for debugging
  .eq('project_id', idResult.data)
  .neq('status', 'rejected')

logger.info("Professional invites query result", {
  scope: "admin-projects",
  projectId: idResult.data,
  inviteCount: invites?.length || 0,
  invites: invites?.map(i => ({ email: i.invited_email, status: i.status })),
  queryError: invitesError?.message
})

for (const invite of invites || []) {
  // ... existing code
}
```

#### **Step 5: Test Email Sending Manually**

Create a test endpoint to verify Loops integration:

```typescript
// app/api/test-email/route.ts
import { sendProfessionalInviteEmail } from '@/lib/email-service'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return Response.json({ error: 'Email parameter required' }, { status: 400 })
  }

  try {
    const result = await sendProfessionalInviteEmail(email, {
      project_owner: 'Test Owner',
      project_name: 'Test Project',
      project_title: 'Test Project',
      confirmUrl: 'https://arcolist.com/dashboard/listings'
    })

    return Response.json({ success: result.success, message: result.message })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
```

Test by visiting: `https://your-domain.com/api/test-email?email=your@email.com`

### **Verification Steps**

After fixing configuration:

1. **Check environment variables**:
   - Verify `LOOPS_API_KEY` is set in deployment environment
   - Restart application/redeploy after adding env var

2. **Verify template IDs**:
   - Log into Loops dashboard
   - Compare template IDs with `email-service.ts`
   - Update if they don't match

3. **Test approval flow**:
   - Create a test project with 1-2 invited professionals
   - Submit for review
   - Approve and publish from admin dashboard
   - Check email inbox for:
     - Owner notification ("Your project is live")
     - Professional invites (one per invited professional)

4. **Check logs**:
   - Look for "Email sent successfully" logs (line 104 in email-service.ts)
   - Look for "Failed to send" error logs (lines 309-316, 344-350, 422-429 in actions.ts)
   - Check Vercel logs or server console

5. **Verify in Loops dashboard**:
   - Go to https://app.loops.so/logs
   - Check if emails appear in send logs
   - Look for any failed send attempts

### **Recommendation**

**Priority**: Critical (blocks professional onboarding)

**Action Plan**:
1. ✅ **Immediate**: Check `LOOPS_API_KEY` environment variable (5 minutes)
2. ✅ **Immediate**: Verify template IDs in Loops dashboard (5 minutes)
3. ✅ **Immediate**: Add warning messages to surface email errors to admins (15 minutes)
4. ✅ **Immediate**: Add debug logging to professional invites query (10 minutes)
5. ⚡ **Optional**: Create test endpoint for manual email testing (20 minutes)
6. ⚡ **Optional**: Add email configuration validation on startup (15 minutes)

### **Files to Update**:
- `lib/email-service.ts:40-42` (verify template IDs)
- `app/admin/projects/actions.ts:316, 350, 365, 429` (add warnings and logging)
- Environment variables: Add/verify `LOOPS_API_KEY`
- Optional: `app/api/test-email/route.ts` (new test endpoint)

### **Confidence Level**: 85%

High confidence that the issue is configuration-related (missing API key or wrong template IDs). The email sending code is correctly implemented, but errors are being swallowed silently. The solution requires:
1. Environment variable verification (most likely cause)
2. Template ID verification (second most likely cause)
3. Better error surfacing (helps with future debugging)

---

## Issue 13: Add SEO Settings for Companies (Professionals Page)

### **Status**: ✅ Investigated

### **Cause**

Currently, the admin interface has full SEO management for **projects** (slug, SEO title, SEO description) via the `EditableSeoCell` component in `components/admin-projects-table.tsx`. However, **companies** (which display on the `/professionals` page) lack this functionality.

**What Projects Have**:
- Editable slug with auto-generation from title
- Editable SEO meta title (with character count)
- Editable SEO meta description (with character count)
- Inline editing in admin table
- Located in: `components/editable-seo-cell.tsx` + `app/admin/projects/actions.ts`

**What Companies Need**:
- Same editable slug field (companies table already has `slug` column)
- Add `seo_title` column to companies table
- Add `seo_description` column to companies table
- Create admin UI for inline editing (similar to projects)
- Create server actions for updating company SEO

**Why This Matters**:
- Companies appear on `/professionals/[slug]` pages
- Need SEO optimization for professional/company discovery
- Currently slug exists in database but is not visible/editable in admin
- No meta title or description for company pages

### **Solution**

#### **Step 1: Add SEO Columns to Companies Table**

Create a new migration to add the missing SEO fields:

```sql
-- Migration: Add SEO fields to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS seo_title TEXT,
ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- Add check constraints for optimal SEO lengths
ALTER TABLE public.companies
ADD CONSTRAINT companies_seo_title_length
  CHECK (seo_title IS NULL OR (length(seo_title) >= 10 AND length(seo_title) <= 60));

ALTER TABLE public.companies
ADD CONSTRAINT companies_seo_description_length
  CHECK (seo_description IS NULL OR (length(seo_description) >= 50 AND length(seo_description) <= 160));

-- Add comment for documentation
COMMENT ON COLUMN public.companies.seo_title IS 'SEO meta title (30-60 characters optimal)';
COMMENT ON COLUMN public.companies.seo_description IS 'SEO meta description (120-160 characters optimal)';
```

#### **Step 2: Create Company SEO Actions**

Create new server actions in `app/admin/professionals/actions.ts` (or new file `app/admin/companies/actions.ts`):

```typescript
// app/admin/companies/actions.ts (NEW FILE)
"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { generateSlug } from "@/lib/seo-utils"
import type { ActionResult } from "@/lib/types"

type UpdateCompanySeoInput = {
  companyId: string
  slug?: string
  seoTitle?: string
  seoDescription?: string
}

export async function updateCompanySeoAction(
  input: UpdateCompanySeoInput
): Promise<ActionResult<{ slug?: string; seoTitle?: string; seoDescription?: string }>> {
  const supabase = await createServerSupabaseClient()

  try {
    const updateData: Record<string, string> = {}

    if (input.slug !== undefined) {
      updateData.slug = input.slug.trim()
    }
    if (input.seoTitle !== undefined) {
      updateData.seo_title = input.seoTitle.trim()
    }
    if (input.seoDescription !== undefined) {
      updateData.seo_description = input.seoDescription.trim()
    }

    const { data, error } = await supabase
      .from("companies")
      .update(updateData)
      .eq("id", input.companyId)
      .select("slug, seo_title, seo_description")
      .single()

    if (error) {
      logger.error("Failed to update company SEO", { companyId: input.companyId }, error)
      return {
        success: false,
        error: {
          code: "UPDATE_FAILED",
          message: error.message,
        },
      }
    }

    revalidatePath("/admin/professionals")
    revalidatePath(`/professionals/${data.slug}`)

    return {
      success: true,
      data: {
        slug: data.slug,
        seoTitle: data.seo_title,
        seoDescription: data.seo_description,
      },
    }
  } catch (error) {
    logger.error("Unexpected error updating company SEO", { companyId: input.companyId }, error)
    return {
      success: false,
      error: {
        code: "UNEXPECTED_ERROR",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
      },
    }
  }
}

type GenerateCompanySlugInput = {
  companyId: string
  name: string
}

export async function generateCompanySlugAction(
  input: GenerateCompanySlugInput
): Promise<ActionResult<{ slug: string }>> {
  const supabase = await createServerSupabaseClient()

  try {
    const baseSlug = generateSlug(input.name)

    // Check if slug exists, append number if needed
    let slug = baseSlug
    let counter = 1
    let isUnique = false

    while (!isUnique && counter < 100) {
      const { data } = await supabase
        .from("companies")
        .select("id")
        .eq("slug", slug)
        .neq("id", input.companyId)
        .maybeSingle()

      if (!data) {
        isUnique = true
      } else {
        slug = `${baseSlug}-${counter}`
        counter++
      }
    }

    return {
      success: true,
      data: { slug },
    }
  } catch (error) {
    logger.error("Failed to generate company slug", { companyId: input.companyId }, error)
    return {
      success: false,
      error: {
        code: "GENERATE_FAILED",
        message: error instanceof Error ? error.message : "Failed to generate slug",
      },
    }
  }
}
```

#### **Step 3: Create Editable Company SEO Cell Component**

Duplicate and adapt `editable-seo-cell.tsx` to `editable-company-seo-cell.tsx`:

```typescript
// components/editable-company-seo-cell.tsx (NEW FILE - based on editable-seo-cell.tsx)
"use client"

import { useState, useTransition } from "react"
import { Check, X, Wand2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { updateCompanySeoAction, generateCompanySlugAction } from "@/app/admin/companies/actions"

interface EditableCompanySeoCellProps {
  companyId: string
  companyName: string
  field: 'slug' | 'seoTitle' | 'seoDescription'
  value: string | null
  onUpdate: () => void
}

export function EditableCompanySeoCell({
  companyId,
  companyName,
  field,
  value,
  onUpdate
}: EditableCompanySeoCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [isPending, startTransition] = useTransition()

  const handleEdit = () => {
    setEditValue(value || '')
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(value || '')
    setIsEditing(false)
  }

  const handleSave = () => {
    const trimmedValue = editValue.trim()

    startTransition(async () => {
      const updateData: Record<string, string> = {}
      updateData[field] = trimmedValue

      const result = await updateCompanySeoAction({
        companyId,
        ...updateData
      })

      if (!result.success) {
        toast.error("Failed to update", {
          description: result.error.message
        })
        return
      }

      if (result.warnings?.length) {
        result.warnings.forEach(warning => toast.warning(warning))
      }
      toast.success(`${field === 'slug' ? 'Slug' : field === 'seoTitle' ? 'SEO title' : 'SEO description'} updated`)
      setIsEditing(false)
      onUpdate()
    })
  }

  const handleGenerateSlug = () => {
    if (field !== 'slug') return

    startTransition(async () => {
      const result = await generateCompanySlugAction({
        companyId,
        name: companyName
      })

      if (!result.success) {
        toast.error("Failed to generate slug", {
          description: result.error.message
        })
        return
      }

      setEditValue(result.data?.slug || '')
      toast.success("Slug generated from company name")
    })
  }

  const displayValue = value || ''
  const hasValue = Boolean(displayValue)

  if (isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {field === 'seoDescription' ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="text-sm"
              rows={3}
              disabled={isPending}
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="text-sm"
              disabled={isPending}
            />
          )}
          {field === 'slug' && (
            <Button
              variant="quaternary"
              size="quaternary"
              onClick={handleGenerateSlug}
              disabled={isPending}
              className="shrink-0"
            >
              <Wand2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending}
            className="h-7 px-2"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            variant="quaternary"
            size="quaternary"
            onClick={handleCancel}
            disabled={isPending}
            className="h-7 px-2"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        {field === 'seoTitle' && (
          <div className="text-xs text-muted-foreground">
            {editValue.length}/60 characters (optimal: 30-60)
          </div>
        )}
        {field === 'seoDescription' && (
          <div className="text-xs text-muted-foreground">
            {editValue.length}/160 characters (optimal: 120-160)
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "cursor-pointer rounded px-2 py-1 hover:bg-muted/50 transition-colors min-h-[2rem]",
        !hasValue && "text-muted-foreground italic",
        field === 'seoDescription' && "min-h-[3rem]"
      )}
      onClick={handleEdit}
    >
      {hasValue ? (
        <span className={cn(
          "text-sm block",
          field === 'seoDescription' && "line-clamp-2 break-words"
        )}>
          {displayValue}
        </span>
      ) : (
        <span className="text-sm block">
          {field === 'slug' && 'Click to add slug'}
          {field === 'seoTitle' && 'Click to add meta title'}
          {field === 'seoDescription' && 'Click to add meta description'}
        </span>
      )}
    </div>
  )
}
```

#### **Step 4: Update Admin Companies Table**

Modify `components/admin-professionals-companies-table.tsx` to:
1. Fetch slug, seo_title, seo_description from companies
2. Add SEO columns to table
3. Use EditableCompanySeoCell component

**Changes needed**:
- Update `AdminCompanyRow` type to include `slug`, `seoTitle`, `seoDescription`
- Update query in `app/admin/professionals/page.tsx` to select these fields
- Add three new table columns for SEO fields
- Import and use `EditableCompanySeoCell` component

#### **Step 5: Update Company Detail Page SEO**

Ensure company detail pages at `/professionals/[slug]/page.tsx` use the SEO metadata:

```typescript
// app/professionals/[slug]/page.tsx - Update metadata generation
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createServerSupabaseClient()

  const { data: company } = await supabase
    .from("companies")
    .select("name, slug, seo_title, seo_description, description")
    .eq("slug", params.slug)
    .single()

  if (!company) return {}

  return {
    title: company.seo_title || company.name,
    description: company.seo_description || company.description || `${company.name} - Professional services on Arco`,
  }
}
```

### **Recommendation**

Implement all 5 steps to achieve feature parity with project SEO:
- ✅ Database schema updated with SEO columns
- ✅ Server actions for updating company SEO
- ✅ Reusable UI component for inline editing
- ✅ Admin table integration
- ✅ Frontend SEO metadata usage

### **Files to Create**:
- `supabase/migrations/096_add_company_seo_fields.sql` (new migration)
- `app/admin/companies/actions.ts` (new file with server actions)
- `components/editable-company-seo-cell.tsx` (new component)

### **Files to Update**:
- `app/admin/professionals/page.tsx` (add SEO fields to query)
- `components/admin-professionals-companies-table.tsx` (add SEO columns + type updates)
- `app/professionals/[slug]/page.tsx` (use SEO metadata)

### **Confidence Level**: 95%

Very high confidence - this is a straightforward replication of existing project SEO functionality. The solution follows the exact same pattern already proven to work for projects.

---

## Summary Table

| # | Issue | Cause | Confidence | Severity | Status |
|---|-------|-------|------------|----------|--------|
| 1 | Email verification error | Loops JSON + Supabase config | 100% | Medium | ✅ Fixed |
| 3 | Typography system | Semantic vs visual coupling | 95% | High | ✅ Investigated |
| 4 | Company not visible | Materialized view not auto-refreshing | 100% | High | ✅ Fixed |
| 5 | Duplicate listings | Service removal didn't delete professionals | 100% | High | ✅ Fixed |
| 5A | Duplicate professionals in approval modal | Same as Issue 5 - fixed by root cause | 100% | High | ✅ Fixed |
| 6 | Email change error | Supabase SMTP/template issue | 90% | High | ✅ Investigated |
| 7 | Plans banner on company page | Upgrade banner shows after signup | 100% | Medium | ✅ Fixed |
| 8 | Pricing link in footer | Public pricing in footer | 100% | Low | ✅ Fixed |
| 9 | Pricing page updates | Menu link missing, styling issues | 100% | Medium | ✅ Fixed |
| 10 | Apollo tracking | Not integrated | 100% | Medium | ✅ Investigated |
| 11 | PostHog analytics | Not integrated | 100% | Medium | ✅ Investigated |
| 12 | Approval emails not sent | Working as expected - no issues found | 100% | Critical | ✅ Verified Working |
| 13 | Company SEO settings | Missing slug/meta fields in admin | 95% | High | ✅ Investigated |

---

## Next Steps

1. **Issue 1 (Email verification)**: ✅ Fixed
2. **Issue 2 (Get Started)**: Update `pricing-section.tsx` to add navigation links
3. **Issue 3 (Typography)**: Refactor `globals.css` and migrate components to utility classes
4. **Issue 4 (Company)**: ✅ Fixed
5. **Issue 5 (Duplicate Listings)**: ✅ Fixed
6. **Issue 5A (Duplicate professionals modal)**: ✅ Fixed
7. **Issue 6 (Email change)**: Fix Supabase email templates for email change confirmation
8. **Issue 7 (Plans banner)**: ✅ Fixed
9. **Issue 8 (Footer pricing)**: ✅ Fixed
10. **Issue 9 (Pricing menu)**: ✅ Fixed
11. **Issue 10 (Apollo)**: Add Apollo tracking script to `app/layout.tsx`
12. **Issue 11 (PostHog)**: Add PostHog analytics script to `app/layout.tsx`
13. **Issue 12 (Approval emails)**: ✅ Verified Working
14. **Issue 13 (Company SEO)**: Add database columns, create actions, build UI components for slug/meta editing

---

## Notes

- All issues have clear solutions with high confidence levels
- Typography issue (Issue 3) requires the most refactoring but follows industry best practices
- Company visibility (Issue 4) can be fixed with simple database updates
- Email issues (Issues 1, 6, 12) likely require configuration changes (Supabase for 1 & 6, Loops for 12)
- Duplicate issues (Issues 5 & 5A) were caused by incomplete database cleanup when removing service categories ✅ Fixed
- UI improvements (Issues 7-9) are straightforward removals and styling updates
- Analytics integrations (Issues 10-11) are standard third-party script additions
- Approval emails (Issue 12) are working correctly - no action needed ✅ Verified
- Company SEO (Issue 13) requires database migration, server actions, and UI components (replicates existing project SEO pattern)

## Implementation Priority

**Critical Priority** (Blocks core functionality):
- Issue 6: Email change error (blocks account management)

**High Priority** (User-blocking):
- Issue 4: Company not visible (blocks professional discovery) ✅ Fixed
- Issue 5: Duplicate listings (confuses users) ✅ Fixed
- Issue 5A: Duplicate professionals in approval modal (confuses admins) ✅ Fixed
- Issue 13: Company SEO settings (blocks SEO optimization for professionals)

**Medium Priority** (UX improvements):
- Issue 7: Remove plans banner (reduces onboarding friction)
- Issue 9: Add pricing to menu (improves discoverability)
- Issue 10: Apollo tracking (enables sales intelligence)
- Issue 11: PostHog analytics (enables product insights)

**Low Priority** (Nice to have):
- Issue 2: Get started link (minor navigation improvement)
- Issue 8: Remove footer pricing (cleanup)
- Issue 3: Typography system (long-term maintainability)

**Already Fixed** (per previous reports):
- Issue 1: Email verification error (Supabase configuration)
