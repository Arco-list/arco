import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

import type { ClaimChannel } from "./claim-token"

/**
 * One shared answer to "which claim funnel does this company get?" —
 * used by every sender (invite dispatcher, showcase prospect templates,
 * outreach campaigns) BEFORE issueClaimToken, so the e-mail's promise
 * and the /claim landing always match.
 *
 * The ranking is by strength of what we can show them:
 *   1. invite   — a pending credit on a published project: their work is
 *                 already live on someone's page, strongest social proof
 *   2. showcase — their own published work on Arco: "your page is ready"
 *   3. outreach — nothing on the platform yet: the example-card pitch
 *
 * Status can change between send and click (48h token TTL); the /claim
 * page additionally renders data-driven where possible (e.g. a real
 * project photo beats the example photo regardless of channel), so a
 * stale pick degrades gracefully.
 */
export async function resolveClaimChannel(companyId: string): Promise<{
  channel: ClaimChannel
  /** The newest addressable credit, when channel is 'invite'. */
  creditId: string | null
  /** Where the mail goes: the credit's invited address (invite) or
   *  companies.email (showcase/outreach); null when neither exists. */
  email: string | null
}> {
  const svc = createServiceRoleSupabaseClient()

  // 1. Invite: a pending, addressable credit on a published project.
  const { data: credit } = await svc
    .from("project_professionals")
    .select("id, invited_email, projects!inner(status)")
    .eq("company_id", companyId)
    .eq("is_project_owner", false)
    .eq("status", "invited")
    .not("invited_email", "is", null)
    .in("projects.status", ["published", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (credit) {
    return {
      channel: "invite",
      creditId: credit.id,
      email: (credit.invited_email as string).toLowerCase(),
    }
  }

  const { data: company } = await svc
    .from("companies")
    .select("id, email")
    .eq("id", companyId)
    .maybeSingle()
  const email = company?.email?.toLowerCase() ?? null

  // 2. Showcase: their own published work already on the platform.
  const { data: ownWork } = await svc
    .from("project_professionals")
    .select("project_id, projects!inner(status)")
    .eq("company_id", companyId)
    .eq("is_project_owner", true)
    .eq("projects.status", "published")
    .limit(1)
    .maybeSingle()
  if (ownWork) return { channel: "showcase", creditId: null, email }

  // 3. Outreach: nothing on the platform yet.
  return { channel: "outreach", creditId: null, email }
}
