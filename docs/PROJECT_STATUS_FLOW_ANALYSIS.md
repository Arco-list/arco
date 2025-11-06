# Project Status Flow: Current vs. Proposed Architecture

**Date:** 2025-01-06
**Purpose:** Map actual status management, permissions, and proposed clean architecture

---

## TL;DR

You're correct - we DO have a two-tier status system:
1. **`projects.status`** = Global project lifecycle (admin + owner control)
2. **`project_professionals.status`** = Per-company visibility (admin only currently)

**Problem:** Contributors CANNOT update their company's status. The system is incomplete.

---

## Current Implementation

### Table 1: `projects.status` (Global Project Lifecycle)

**Purpose:** Overall project workflow from creation to publication

| Status Value | User Label | Who Can Set | RLS Policy | Description |
|--------------|------------|-------------|------------|-------------|
| `draft` | "Draft" / "In progress" | Owner, Admin | `client_id = auth.uid()` OR admin | Being created |
| `in_progress` | "In Review" | Admin (auto on submit?) | Admin only | Awaiting approval |
| `published` | "Published" / "Live" | Owner, Admin | `client_id = auth.uid()` OR admin | Approved and live |
| `completed` | "Featured" / "Listed" | Owner, Admin | `client_id = auth.uid()` OR admin | ⚠️ **Broken** - see analysis |
| `archived` | "Unpublished" / "Unlisted" | Owner, Admin | `client_id = auth.uid()` OR admin | Hidden from public |
| `rejected` | "Rejected" | Admin only | Admin only | Admin rejected |

**Update Mechanism:**
- **Owner:** Dashboard UI → `app/dashboard/listings/page.tsx:505-509`
  ```typescript
  await supabase
    .from("projects")
    .update({ status: selectedStatus })
    .eq("id", projectId)
    .eq("client_id", userId)  // RLS enforces this
  ```
- **Admin:** Admin panel → `app/admin/projects/actions.ts:104-168`
  ```typescript
  await supabase
    .from("projects")
    .update({ status, status_updated_at, status_updated_by })
    .eq("id", projectId)
  // No client_id check - admin RLS policy allows
  ```

**RLS Policies:**
- `projects_public_read`: Published OR owner OR admin can read
- `projects_admin_update`: Admin can update any project
- Implicit owner update: Via standard `client_id = auth.uid()` check

---

### Table 2: `project_professionals.status` (Per-Company Visibility)

**Purpose:** Control how EACH company appears on a project

| Status Value | User Label | Who Can Set | RLS Policy | Description |
|--------------|------------|-------------|------------|-------------|
| `invited` | "Invited" / "Not claimed" | System (auto) | N/A | Initial state after invite |
| `listed` | "Listed" / "Published" | Admin only | Admin only | Company shown on project page |
| `live_on_page` | "Live" / "Featured" | Admin only | Admin only | Featured in company portfolio |
| `unlisted` | "Unlisted" / "Unpublished" | Admin only | Admin only | Company hidden |
| `rejected` | "Rejected" / "Declined" | Contributor (opt-out), Admin | ⚠️ **No policy!** | Company opted out |
| `removed` | "Removed" | Admin only | Admin only | Admin removed |

**Update Mechanism:**
- **Contributor (current):** Opt-out only → `app/dashboard/listings/page.tsx:675-704`
  ```typescript
  await supabase
    .from("project_professionals")
    .update({ status: "rejected", responded_at: now })
    .eq("id", projectProfessionalId)
  // ⚠️ NO RLS POLICY for contributors!
  ```
- **Admin:** Admin panel → Updates directly via admin RLS policy

**RLS Policies:**
- `project_professionals_admin_update` (migration 029): Admin can update any row
- `project_professionals_owner_read` (migration 030): Project owner can read invites
- ⚠️ **MISSING:** No policy for contributors to update their own company's status!

---

## The Two-Tier System Explained

### Why Two Tables?

**`projects.status`** controls:
- ✅ Whether project exists in search/discovery
- ✅ Whether public can view project page
- ✅ Overall project lifecycle
- ✅ Admin approval workflow

**`project_professionals.status`** controls:
- ✅ Whether a specific COMPANY is shown on the project
- ✅ Whether project appears in that company's portfolio
- ✅ Per-company opt-in/opt-out

**Example:**
```
Project: "Modern Kitchen Renovation"
  projects.status = 'published' (globally live)

  Company A (owner):
    project_professionals.status = 'live_on_page' (featured in portfolio)

  Company B (contractor):
    project_professionals.status = 'listed' (shown on project page)

  Company C (designer):
    project_professionals.status = 'unlisted' (opted out)
```

Result:
- ✅ Project discoverable in search
- ✅ Company A's portfolio shows this project
- ✅ Project page lists Companies A & B
- ❌ Company C not shown anywhere

---

## Current Permission Model

| Action | Owner | Contributor | Admin | Notes |
|--------|-------|-------------|-------|-------|
| Create project | ✅ Yes | ❌ No | ✅ Yes | Owner = client who created |
| Set project to Draft | ✅ Yes | ❌ No | ✅ Yes | Via `projects.status` |
| Submit for review | ✅ Yes | ❌ No | ✅ Yes | Sets `in_progress` |
| Approve project | ❌ No | ❌ No | ✅ Yes | Sets `published` |
| Reject project | ❌ No | ❌ No | ✅ Yes | Sets `rejected` |
| Unpublish own project | ✅ Yes | ❌ No | ✅ Yes | Sets `archived` |
| Update company listing status | ❌ No | ⚠️ **Broken** | ✅ Yes | Should update `project_professionals.status` |
| Opt out | ❌ N/A | ⚠️ **Half-working** | ✅ Yes | Sets `rejected` but no RLS policy! |

**Key Problem:** Contributors can execute opt-out query, but **no RLS policy explicitly allows it**. This is a security issue OR the code is bypassing RLS somehow.

---

## Your Proposed Flow

### Clarified Status Flow

```
CREATION:
  Professional creates project
    → projects.status = 'draft'
    → project_professionals.status = 'invited' (for owner company)

SUBMISSION:
  Professional clicks "Submit for review"
    → projects.status = 'in_progress'
    → Email sent to admin

ADMIN REVIEW:
  Admin approves
    → projects.status = 'published'
    → Emails sent to invited professionals

  Admin rejects
    → projects.status = 'rejected'
    → Email sent to owner with reason

VISIBILITY CONTROL (Project Owner):
  Owner can set projects.status:
    - 'archived' = Unpublished (not visible to anyone)
    - 'published' = Published (visible, companies shown)

  ⚠️ Owner should NOT control 'featured' globally
     (that's per-company via project_professionals.status)

VISIBILITY CONTROL (Contributors):
  Contributor can set project_professionals.status FOR THEIR COMPANY:
    - 'unlisted' = Unpublished (not shown on project or portfolio)
    - 'listed' = Published (shown on project page)
    - 'live_on_page' = Featured (shown on portfolio)
```

### Key Question: Should Admin Control Visibility?

**Current:** Admin can set both `projects.status` AND `project_professionals.status`

**Proposed:**

| Status Type | Admin Control | Owner Control | Contributor Control |
|-------------|---------------|---------------|---------------------|
| **Global Lifecycle** (`projects.status`) | ✅ Full | ✅ Limited | ❌ None |
| **Per-Company Visibility** (`project_professionals.status`) | ✅ Override only | ❌ None | ✅ Full (own company) |

**Admin Powers:**
- Approve/reject projects (`in_progress` → `published` or `rejected`)
- Override owner decisions (safety/moderation)
- Override contributor visibility (rare, moderation only)

**Owner Powers:**
- Create/edit project
- Submit for review (`draft` → `in_progress`)
- Unpublish own project (`published` → `archived`)
- ⚠️ **CANNOT** set `in_progress` directly (must go through submission flow)
- ⚠️ **CANNOT** approve own project (admin only)

**Contributor Powers:**
- Control own company visibility (`unlisted` / `listed` / `live_on_page`)
- Opt out completely (`rejected`)
- ⚠️ **CANNOT** affect global project status

---

## Proposed Clean Architecture

### Step 1: Remove `completed` Status

**Rationale:** Redundant with per-company `live_on_page`

```sql
UPDATE projects SET status = 'published' WHERE status = 'completed';
```

### Step 2: Define Clear Ownership

**`projects.status` (Global):**
```
draft → in_progress → published → archived
                    ↘ rejected
```

**`project_professionals.status` (Per-Company):**
```
invited → unlisted / listed / live_on_page
        ↘ rejected
```

### Step 3: Add RLS Policy for Contributors

**New migration:**
```sql
CREATE POLICY project_professionals_contributor_update
ON public.project_professionals
FOR UPDATE
USING (
  -- User is a team member of the company on this project
  company_id IN (
    SELECT company_id
    FROM public.professionals
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  -- Can only update status field (not project_id, company_id, etc.)
  company_id IN (
    SELECT company_id
    FROM public.professionals
    WHERE user_id = auth.uid()
  )
);
```

### Step 4: Update UI Logic

**Owner Modal Options:**
- Unpublished (`archived`)
- Published (`published`)

**Contributor Modal Options:**
- Unpublished (`unlisted`)
- Published (`listed`)
- Featured (`live_on_page`) [Plus only]

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ PROJECT CREATION & SUBMISSION                               │
└─────────────────────────────────────────────────────────────┘

Owner Creates → [DRAFT]
                   ↓
Owner Submits → [IN REVIEW]
                   ↓
           ┌───────┴────────┐
           ↓                ↓
    [PUBLISHED]      [REJECTED]
           ↓                ↓
   Owner can toggle   Owner fixes
   [ARCHIVED] ←────   and resubmits
   (Unpublish)


┌─────────────────────────────────────────────────────────────┐
│ PER-COMPANY VISIBILITY (Contributors Control)              │
└─────────────────────────────────────────────────────────────┘

Invited → [invited]
             ↓
      ┌──────┼──────┐
      ↓      ↓      ↓
  [unlisted] [listed] [live_on_page]
  (Hidden)   (On page) (Portfolio)
      ↓      ↓      ↓
      └──────┼──────┘
             ↓
        [rejected]
        (Opted out)
```

---

## Status Terminology Mapping

### Standardized Labels

| Database Value | User-Facing Label | Context |
|----------------|-------------------|---------|
| **Global (`projects.status`)** |||
| `draft` | "Draft" | Owner creating |
| `in_progress` | "In Review" | Admin reviewing |
| `published` | "Published" | Live and visible |
| `archived` | "Unpublished" | Hidden by owner |
| `rejected` | "Rejected" | Admin declined |
| ~~`completed`~~ | ~~Removed~~ | Redundant |
| **Per-Company (`project_professionals.status`)** |||
| `invited` | "Invited" | Not yet claimed |
| `unlisted` | "Unpublished" | Not shown |
| `listed` | "Published" | On project page |
| `live_on_page` | "Featured" | In portfolio |
| `rejected` | "Declined" | Opted out |
| `removed` | "Removed" | Admin action |

---

## Implementation Checklist

### Database Changes
- [ ] Remove `completed` from `project_status` enum
- [ ] Add RLS policy for contributor updates to `project_professionals`
- [ ] Add trigger to auto-set `in_progress` when owner submits
- [ ] Add email trigger when admin approves/rejects

### Frontend Changes
- [ ] Owner modal: Only Unpublished/Published options
- [ ] Contributor modal: Unpublished/Published/Featured options
- [ ] Update all status labels to standardized terminology
- [ ] Remove opt-out modal, replace with status modal

### Backend Changes
- [ ] Prevent owner from setting `in_progress` directly (must submit)
- [ ] Prevent owner from self-approving (admin only)
- [ ] Add server action for "submit for review" if needed

---

## Open Questions

1. **Should admin control Featured/Listed/Unlisted at project level?**
   - Current: Admin can set `project_professionals.status` for any company
   - Proposed: Admin only overrides for moderation, not normal workflow

2. **How does submission work currently?**
   - Is there a "Submit" button that sets `in_progress`?
   - Or does owner manually set status to "In Review"?

3. **What happens when admin approves?**
   - Does it send emails to invited professionals?
   - Do they need to "claim" the project first?

4. **Should contributors be able to reverse opt-out?**
   - Current: Opt-out is one-way (no UI to reverse)
   - Proposed: Status modal allows toggling between all statuses

---

## Recommendation

**YES** to your proposed flow, with these clarifications:

1. **Admin controls:**
   - Global project lifecycle (approve/reject)
   - Override powers for moderation

2. **Owner controls:**
   - Project editing
   - Unpublish/republish own projects
   - **CANNOT** approve own projects
   - **CANNOT** control per-company visibility

3. **Contributor controls:**
   - Own company's visibility on each project
   - Opt in/out at will
   - Feature projects in portfolio (Plus only)

4. **Remove `completed` status:**
   - Redundant with per-company `live_on_page`
   - Simplifies mental model
   - Aligns with actual functionality

This gives you:
- Clear separation of concerns
- Proper permission model
- Flexible per-company control
- Simple global lifecycle

---

## Next Steps

1. Confirm this architecture aligns with business requirements
2. Create migration for RLS policy
3. Update PRD with this clarified flow
4. Implement in order: Database → Backend → Frontend
