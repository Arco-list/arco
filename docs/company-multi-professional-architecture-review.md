# Company Multi-Professional Architecture Review

**Date:** October 29, 2025
**Status:** Architecture Review & Gap Analysis

---

## Overview

This document reviews the current architecture for companies and professionals in the Arco platform, identifies gaps in supporting multiple professionals per company, and provides recommendations for implementing domain-based company membership.

### User Feedback

> "When a company domain is invited to a project, all users that create a company account with that domain should see the project under Your listings."

**Current Issue:** Users creating accounts with the same company email domain don't automatically see projects invited to their company. Each creates a separate company instance instead.

---

## Current Architecture

### Database Structure (✅ Good Foundation)

The schema already supports multiple professionals per company:

#### Tables
- **`companies`**
  - `owner_id` UUID - Single company owner
  - `domain` TEXT - Company website/domain (stored but not used for matching)
  - `email`, `phone`, `name`, etc.

- **`professionals`**
  - `user_id` UUID - 1:1 relationship with profiles
  - `company_id` UUID - Many-to-one relationship with companies
  - One professional record per user

- **`project_professionals`**
  - `project_id` UUID
  - `invited_email` TEXT - Email address invited
  - `professional_id` UUID (nullable)
  - `company_id` UUID (nullable)
  - `status` ENUM ('invited', 'listed', 'live_on_page', 'unlisted', 'rejected', 'removed')
  - `is_project_owner` BOOLEAN

### Current Flows

#### 1. Company Creation Flow (app/create-company/actions.ts)

**When user creates company:**
1. User fills out company form (name, domain, email, phone)
2. System checks if user already owns a company
3. If yes → updates existing company
4. If no → creates new company with `owner_id = user.id`
5. Creates or updates professional profile with `company_id`
6. Promotes user to "professional" type in profiles
7. Calls `claimPendingInvitesAction` to match by email

**Current behavior:**
```typescript
// Creates NEW company for each user - no domain matching
const { data: newCompany } = await supabase
  .from("companies")
  .insert({
    name: companyName,
    owner_id: user.id,
    website: domain,  // Stored but NOT used for matching
    email,
    phone,
  })
```

#### 2. Project Invitation Flow (lib/new-project/invite-professionals.ts)

**When project invites by email:**
1. Admin/client enters professional email
2. System checks if email matches existing professional user
3. Creates `project_professionals` record:
   - If match found → `professional_id` + `company_id` set, status = 'listed'
   - If no match → `professional_id` is null, status = 'invited'

**Status logic:**
```typescript
const status = inviteData.professional_id ? 'listed' : 'invited'
```

#### 3. Invite Claiming Flow (app/new-project/actions.ts:275)

**When user creates account after being invited:**
```typescript
export async function claimPendingInvitesAction(userId: string) {
  // Get user's email from auth
  const userEmail = authUser.user.email

  // Get professional record
  const professional = await supabase
    .from('professionals')
    .select('id, company_id')
    .eq('user_id', userId)
    .maybeSingle()

  // Update all pending invites with matching email
  await supabase
    .from('project_professionals')
    .update({
      professional_id: professional.id,
      company_id: professional.company_id,
      status: 'listed'
    })
    .eq('invited_email', userEmail)  // ❌ Exact email match only
    .is('professional_id', null)
}
```

#### 4. Dashboard Listings Query (app/dashboard/listings/page.tsx:239)

**Fetches projects for professional:**
```typescript
const { data, error } = await supabase
  .from("project_professionals")
  .select(`
    id,
    project_id,
    status,
    is_project_owner,
    invited_service_category_id,
    projects!inner(...)
  `)
  .eq("professional_id", professionalData.id)  // ❌ Individual only
  .neq("status", "rejected")
```

**Result:** Only shows projects where THIS specific professional was invited, not all company projects.

---

## Critical Gaps

### 🔴 Gap #1: No Domain-Based Company Matching

**Current behavior:**
- User A signs up with `john@acme.com` → Creates NEW company "Acme"
- User B signs up with `jane@acme.com` → Creates ANOTHER NEW company "Acme"
- Result: Two separate company records for the same organization

**What's missing:**
1. Email domain extraction from user's email
2. Lookup for existing companies with matching domain
3. Logic to join existing company vs. create new

**Required logic:**
```typescript
// Extract domain from user email
const userEmail = user.email // john@acme.com
const emailDomain = extractEmailDomain(userEmail) // acme.com

// Check if company with this domain exists
const existingCompany = await supabase
  .from("companies")
  .select("id, owner_id, name")
  .eq("domain", emailDomain)
  .maybeSingle()

if (existingCompany) {
  // Join existing company (don't create new)
  companyId = existingCompany.id
} else {
  // Create new company with domain
  const newCompany = await supabase
    .from("companies")
    .insert({
      name: companyName,
      owner_id: user.id,
      domain: emailDomain,  // ✅ Store extracted domain
      website: websiteUrl,
      email,
      phone,
    })
  companyId = newCompany.id
}
```

### 🔴 Gap #2: Dashboard Queries Individual Professional, Not Company

**Location:** `app/dashboard/listings/page.tsx:239`

**Current:**
```typescript
.eq("professional_id", professionalData.id)
```

**Problem scenario:**
1. Company `acme.com` gets invited to Project A
2. John from `acme.com` creates account → sees Project A ✅
3. Jane from `acme.com` creates account → does NOT see Project A ❌
4. Jane creates a new "Acme" company, no link to John's projects

**Should be:**
```typescript
.eq("company_id", professionalData.company_id)  // ✅ All company projects
```

**Impact:** This single line change would make all professionals from the same company see the same project listings.

### 🔴 Gap #3: No Company Team Management UI

**Location:** `app/dashboard/company/page.tsx`

**Currently shows:**
- ✅ Company settings (name, description, logo, etc.)
- ✅ Social links
- ✅ Company photos
- ✅ Services offered

**Missing:**
- ❌ List of team members (other professionals in this company)
- ❌ Team member roles or permissions
- ❌ Pending team invitations
- ❌ Ability for owner to see who else has access
- ❌ Ability to invite team members
- ❌ Ability to remove team members

**Current query only fetches owner's professional:**
```typescript
// Line 85-90
supabase
  .from("professionals")
  .select("id")
  .eq("user_id", user.id)
  .eq("company_id", company.id)
  .maybeSingle()
```

**Should also fetch:**
```typescript
// Get all team members
const { data: teamMembers } = await supabase
  .from("professionals")
  .select(`
    id,
    user_id,
    title,
    is_available,
    created_at,
    profiles!inner(
      id,
      first_name,
      last_name,
      email,
      avatar_url
    )
  `)
  .eq("company_id", company.id)
  .order("created_at", { ascending: true })
```

### 🔴 Gap #4: No Domain-Based Invite Claiming

**Location:** `app/new-project/actions.ts:310`

**Current:**
```typescript
.eq('invited_email', userEmail)  // Only exact email match
```

**Problem scenario:**
1. Project invites `info@acme.com` (generic company email)
2. John signs up with `john@acme.com` → Doesn't claim invite ❌
3. Jane signs up with `jane@acme.com` → Doesn't claim invite ❌
4. No one can claim the project unless they have access to `info@acme.com`

**Potential solution (with security considerations):**
```typescript
// Match by exact email OR company domain pattern
.or(`
  invited_email.eq.${userEmail},
  invited_email.ilike.%@${companyDomain}
`)
```

**⚠️ Security Risk:** This requires domain verification to prevent abuse.

### 🔴 Gap #5: No Domain Verification System

**Current state:**
- `companies.domain` field exists but is just a text field
- No verification that user actually controls the domain
- Anyone can claim any domain

**Security risks:**
1. User signs up with `fake@acme.com` → Auto-joins real Acme Inc's company
2. Competitor creates account with `spy@competitor.com` → Sees competitor's projects
3. No way to prevent domain squatting

**Missing infrastructure:**
- Domain ownership verification
- Email domain validation
- Owner approval workflow for new team members

---

## Required Changes

### Phase 1: Fix Current System (Do Now - 4-6 hours)

**Priority: High** - These changes make the existing system work correctly for companies that already have multiple professionals.

#### 1.1 Update Dashboard Query (app/dashboard/listings/page.tsx)

**File:** `app/dashboard/listings/page.tsx:239`

**Change:**
```typescript
// FROM:
.eq("professional_id", professionalData.id)

// TO:
.eq("company_id", professionalData.company_id)
```

**Impact:** All professionals from same company see same project listings immediately.

**Testing:**
1. Create company A with professional A1
2. Invite company A to project X
3. Create professional A2 with same company
4. Professional A2 should see project X in dashboard

#### 1.2 Store Domain During Company Creation (app/create-company/actions.ts)

**File:** `app/create-company/actions.ts:125-148`

**Change:**
```typescript
// Extract domain from user email
const emailDomain = user.email?.split('@')[1]?.toLowerCase() || null

const { data: newCompany, error: insertCompanyError } = await supabase
  .from("companies")
  .insert({
    name: companyName,
    owner_id: user.id,
    website: domain,
    domain: emailDomain,  // ✅ Add this line
    email,
    phone,
  })
  .select("id")
  .single()
```

**Impact:** Future logic can use this field for matching.

#### 1.3 Add Team Members View (app/dashboard/company/page.tsx)

**File:** `app/dashboard/company/page.tsx:68-91`

**Add to existing Promise.all:**
```typescript
const [
  { data: socialLinks },
  { data: photos },
  { data: allCategories },
  { data: professional },
  { data: teamMembers }  // ✅ Add this
] = await Promise.all([
  // ... existing queries ...
  supabase
    .from("professionals")
    .select(`
      id,
      user_id,
      title,
      is_available,
      created_at,
      profiles!inner(
        id,
        first_name,
        last_name,
        avatar_url
      )
    `)
    .eq("company_id", company.id)
    .order("created_at")
])
```

**Pass to component:**
```typescript
<CompanySettingsShell
  company={company as CompanyRow}
  socialLinks={socialLinks ?? []}
  photos={photos ?? []}
  services={serviceOptions}
  professionalId={professional?.id ?? null}
  teamMembers={teamMembers ?? []}  // ✅ Add this
/>
```

#### 1.4 Create Team Management UI Component

**New file:** `components/company-settings/team-members-section.tsx`

**Features:**
- Display list of team members with avatars
- Show owner badge for company owner
- Show join date for each member
- Simple read-only view (no editing in Phase 1)

**Example:**
```typescript
export function TeamMembersSection({
  teamMembers,
  companyOwnerId
}: TeamMembersSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Team Members</h3>
      <div className="space-y-2">
        {teamMembers.map(member => (
          <div key={member.id} className="flex items-center gap-3 p-3 border rounded">
            <Avatar />
            <div className="flex-1">
              <p className="font-medium">{member.profiles.first_name} {member.profiles.last_name}</p>
              <p className="text-sm text-muted-foreground">{member.title}</p>
            </div>
            {member.user_id === companyOwnerId && (
              <Badge>Owner</Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Phase 2: Domain-Based Company Joining (Next Version - 8-12 hours)

**Priority: Medium** - These changes enable automatic company joining by domain with proper security.

#### 2.1 Domain Extraction & Validation Utility

**New file:** `lib/utils/domain.ts`

```typescript
/**
 * Extract email domain from email address
 */
export function extractEmailDomain(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase().trim()
  return domain || null
}

/**
 * Check if email domain is a common free email provider
 */
export function isFreeDomain(domain: string): boolean {
  const freeDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'icloud.com', 'aol.com', 'protonmail.com', 'mail.com'
  ]
  return freeDomains.includes(domain.toLowerCase())
}

/**
 * Validate that domain looks legitimate for company use
 */
export function isValidCompanyDomain(domain: string): boolean {
  // Must have valid domain format
  if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(domain)) {
    return false
  }

  // Should not be a free email provider
  if (isFreeDomain(domain)) {
    return false
  }

  return true
}
```

#### 2.2 Company Matching Logic (app/create-company/actions.ts)

**Update createCompanyAction:**

```typescript
export async function createCompanyAction(input: CreateCompanyInput) {
  // ... validation ...

  const user = // ... get user ...
  const emailDomain = extractEmailDomain(user.email!)

  // Only attempt domain matching for valid company domains
  let companyId: string | null = null

  if (emailDomain && isValidCompanyDomain(emailDomain)) {
    // Check for existing company with this domain
    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id, name, owner_id")
      .eq("domain", emailDomain)
      .maybeSingle()

    if (existingCompany) {
      // Found existing company with same domain
      // TODO: Add owner approval workflow here in future
      companyId = existingCompany.id

      logger.info("User joining existing company by domain", {
        userId: user.id,
        companyId: existingCompany.id,
        domain: emailDomain
      })
    }
  }

  // If no existing company found, create new one
  if (!companyId) {
    const { data: newCompany } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        owner_id: user.id,
        website: domain,
        domain: emailDomain,  // Store domain
        email,
        phone,
      })
      .select("id")
      .single()

    companyId = newCompany.id
  }

  // Rest of logic (create/update professional, etc.)
}
```

#### 2.3 Domain-Based Invite Claiming (optional)

**Update claimPendingInvitesAction:**

```typescript
export async function claimPendingInvitesAction(userId: string) {
  const userEmail = // ... get email ...
  const professional = // ... get professional ...
  const company = // ... get company ...

  // Get company domain
  const companyDomain = company.domain

  // Build query to match invites
  let query = supabase
    .from('project_professionals')
    .update({
      professional_id: professional.id,
      company_id: professional.company_id,
      status: 'listed',
      responded_at: new Date().toISOString()
    })

  // Match by exact email OR company domain
  if (companyDomain && isValidCompanyDomain(companyDomain)) {
    query = query.or(`
      invited_email.eq.${userEmail},
      invited_email.ilike.%@${companyDomain}
    `)
  } else {
    query = query.eq('invited_email', userEmail)
  }

  const { data: updatedInvites } = await query
    .is('professional_id', null)
    .select('id')

  return {
    success: true,
    claimedCount: updatedInvites?.length || 0
  }
}
```

⚠️ **Security Note:** Domain-based claiming should only work after domain verification.

#### 2.4 Owner Approval Workflow (recommended)

**New table migration:**

```sql
-- Add pending_team_members table
CREATE TABLE public.pending_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

  UNIQUE(company_id, user_id)
);
```

**Flow:**
1. User with matching domain tries to join company
2. Create pending_team_members record with status = 'pending'
3. Send notification to company owner
4. Owner approves/rejects from dashboard
5. On approval, update professional.company_id

### Phase 3: Domain Verification (Future - 12-16 hours)

**Priority: Low** - Enterprise feature for domain ownership verification.

#### 3.1 Domain Verification Methods

**Option A: DNS TXT Record**
- Company adds TXT record to DNS: `arco-verification=abc123`
- System verifies record exists via DNS lookup
- Used by: Google Workspace, Microsoft 365

**Option B: Email Verification**
- Send verification email to admin@ or webmaster@domain
- User clicks link to verify
- Simpler but less secure

**Option C: File Upload**
- Company uploads file to `domain.com/.well-known/arco-verify.txt`
- System fetches and validates file
- Used by: Apple, Facebook

#### 3.2 Database Schema

```sql
-- Add verification fields to companies
ALTER TABLE public.companies
  ADD COLUMN domain_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN domain_verification_token TEXT,
  ADD COLUMN domain_verified_at TIMESTAMPTZ;

-- Create verification attempts table
CREATE TABLE public.domain_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  verification_method TEXT NOT NULL CHECK (verification_method IN ('dns', 'email', 'file')),
  verification_token TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Security Considerations

### 1. Domain Squatting Prevention

**Risk:** Malicious user creates company with competitor's domain

**Mitigations:**
- ✅ Require domain verification before enabling domain-based features
- ✅ Allow only one company per verified domain
- ✅ Implement owner approval for new team members
- ✅ Audit log for company membership changes

### 2. Email Spoofing

**Risk:** Attacker uses fake email to join company

**Mitigations:**
- ✅ Validate email ownership during signup
- ✅ Send confirmation emails for company joins
- ✅ Require email re-verification if domain changes
- ✅ 2FA for company settings changes

### 3. Free Email Domains

**Risk:** Users with gmail.com, yahoo.com try to auto-join

**Mitigations:**
- ✅ Block domain matching for free email providers
- ✅ Maintain whitelist of free domains
- ✅ Require custom domains for company features

### 4. Company Takeover

**Risk:** Non-owner changes critical company settings

**Mitigations:**
- ✅ Only owner can delete company
- ✅ Only owner can transfer ownership
- ✅ Only owner can change domain
- ✅ Audit log for all admin actions
- ✅ Email notifications for critical changes

---

## Recommended Approach

### ✅ **Start with Phase 1** (Recommended)

**Why:**
- Low risk, high impact
- Fixes current broken behavior
- No security concerns
- Can ship in 1-2 days
- Enables manual team building

**Delivers:**
- All company members see shared projects
- Owner can view team members
- Domain stored for future use
- Foundation for Phase 2

### 🔄 **Then Phase 2** (With Caution)

**Why:**
- Requires owner approval workflow
- Needs careful security review
- Can wait until you have real companies with teams
- More complexity = more bugs

**When to do:**
- After Phase 1 is tested and stable
- When you have 5+ companies with multiple team members
- When manual team building becomes pain point
- When you can dedicate time to security review

### 🚫 **Skip Phase 3** (Unless Enterprise Customers)

**Why:**
- Very complex
- Only needed for large enterprises
- Manual verification works fine at small scale
- Can outsource to auth providers

**When to do:**
- When you have enterprise customers
- When domain verification is hard requirement
- When you see abuse of domain features

---

## Testing Checklist

### Phase 1 Testing

- [ ] Create company A with user A1
- [ ] Invite company A to project X by email
- [ ] User A1 sees project X in dashboard
- [ ] Create user A2 with same company (manual assignment)
- [ ] User A2 sees project X in dashboard
- [ ] Company owner sees both A1 and A2 in team list
- [ ] Non-owner cannot delete company
- [ ] Projects show correct company name

### Phase 2 Testing

- [ ] User with `john@acme.com` creates company A
- [ ] User with `jane@acme.com` creates account
- [ ] System detects matching domain `acme.com`
- [ ] Jane's professional linked to company A (not new company)
- [ ] Jane sees company A's projects
- [ ] Both users see each other in team list
- [ ] User with `fake@acme.com` requires owner approval
- [ ] Users with `gmail.com` don't auto-join anything

### Phase 3 Testing

- [ ] Company owner initiates domain verification
- [ ] DNS TXT record method works correctly
- [ ] Email verification method works correctly
- [ ] Unverified domains don't enable auto-join
- [ ] Verified badge shows on company profile
- [ ] Re-verification required if domain changes

---

## Files to Modify

### Phase 1 Changes

1. **app/dashboard/listings/page.tsx** (line 239)
   - Change query from `professional_id` to `company_id`

2. **app/create-company/actions.ts** (line 125-148)
   - Extract and store email domain in `domain` field

3. **app/dashboard/company/page.tsx** (line 68-91)
   - Add query for team members
   - Pass to component

4. **components/company-settings/company-settings-shell.tsx**
   - Accept teamMembers prop
   - Add new tab for team

5. **components/company-settings/team-members-section.tsx** (new file)
   - Display team members list
   - Show owner badge
   - Read-only view

### Phase 2 Changes

6. **lib/utils/domain.ts** (new file)
   - Domain extraction utilities
   - Free domain detection
   - Domain validation

7. **app/create-company/actions.ts** (major refactor)
   - Company matching by domain
   - Join existing vs. create new logic
   - Owner approval notifications

8. **app/new-project/actions.ts** (claimPendingInvitesAction)
   - Domain-based invite matching
   - Security checks

9. **supabase/migrations/XXX_add_pending_team_members.sql** (new file)
   - Create pending_team_members table
   - RLS policies

10. **components/company-settings/pending-approvals-section.tsx** (new file)
    - Show pending team member requests
    - Approve/reject buttons
    - Owner-only access

### Phase 3 Changes

11. **supabase/migrations/XXX_add_domain_verification.sql** (new file)
    - Add verification columns to companies
    - Create domain_verifications table

12. **app/dashboard/company/verify-domain/page.tsx** (new file)
    - Domain verification UI
    - Multiple verification methods
    - Status checking

13. **app/api/domain-verification/** (new API routes)
    - DNS lookup endpoint
    - File verification endpoint
    - Status check endpoint

---

## Migration Strategy

### For Existing Data

If you already have companies in production:

```sql
-- Update existing companies with domain from website field
UPDATE public.companies
SET domain = LOWER(
  regexp_replace(
    regexp_replace(website, '^https?://', ''),
    '/.*$',
    ''
  )
)
WHERE domain IS NULL
  AND website IS NOT NULL
  AND website != '';

-- Or extract from company email if website not set
UPDATE public.companies
SET domain = LOWER(split_part(email, '@', 2))
WHERE domain IS NULL
  AND email IS NOT NULL
  AND email LIKE '%@%.%';
```

---

## Open Questions

1. **Should free email domains be blocked completely?**
   - Or allow but disable auto-join features?
   - Recommendation: Allow signup, disable domain matching

2. **What's the UX for joining existing company?**
   - Automatic with notification?
   - Require owner approval first?
   - Recommendation: Require approval for security

3. **Can non-owners invite other team members?**
   - Or owner-only permission?
   - Recommendation: Owner-only for now

4. **How to handle company ownership transfer?**
   - Can owner transfer to another team member?
   - What happens to old owner?
   - Recommendation: Owner can designate new owner, becomes regular member

5. **Should there be team member roles?**
   - Owner, Admin, Member?
   - Different permissions per role?
   - Recommendation: Defer to Phase 3+

---

## Success Criteria

### Phase 1
- [x] Database schema supports multi-professional companies
- [x] Invitations stored with company_id
- [ ] Dashboard queries company_id instead of professional_id
- [ ] Team members visible in company settings
- [ ] Domain stored during company creation
- [ ] No broken functionality

### Phase 2
- [ ] Users with matching domains join existing companies
- [ ] Owner approval workflow functional
- [ ] Security checks prevent unauthorized joining
- [ ] Free email domains handled correctly
- [ ] Audit logging for company changes
- [ ] Email notifications for approvals

### Phase 3
- [ ] Domain verification methods implemented
- [ ] DNS, email, or file verification works
- [ ] Verified badge displays correctly
- [ ] Auto-join only enabled for verified domains
- [ ] Re-verification on domain change

---

## Estimated Effort

| Phase | Features | Hours | Priority |
|-------|----------|-------|----------|
| Phase 1 | Dashboard query, team view, domain storage | 4-6 | High ✅ |
| Phase 2 | Domain matching, approval workflow | 8-12 | Medium |
| Phase 3 | Domain verification system | 12-16 | Low |
| **Total** | Full multi-professional system | **24-34** | - |

---

## Next Steps

1. **Decision:** Phase 1 now, or push everything to next version?
2. **If Phase 1:** Start with dashboard query change (lowest risk)
3. **Testing:** Manual test with 2+ users per company
4. **Security Review:** Before shipping Phase 2
5. **Documentation:** Update user guide for team features

---

## Related Documents

- [professional-to-company-migration-plan.md](./professional-to-company-migration-plan.md) - Previous migration from professional-centric to company-centric
- [Database schema](../supabase/migrations/) - All migration files
- [Company settings PRD](../supabase/migrations/025_update_companies_settings.sql) - Original company features design

---

## Contact

For questions about this architecture review, see the implementation files or database migrations for current state.
