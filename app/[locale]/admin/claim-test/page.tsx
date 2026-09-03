import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

import { ClaimTestClient } from "./claim-test-client"

export const dynamic = "force-dynamic"

/**
 * /admin/claim-test — walk any claim funnel on demand.
 *
 * Tokens are single-use, so every walkthrough starts here: pick a
 * company, pick a channel, mint a fresh link. The Olli fixture has a
 * reset button that returns it to virgin state after a completed
 * commit (account deleted, credit back to invited, company unclaimed).
 * Admin-gated by the /admin layout.
 */
export default async function ClaimTestPage() {
  const svc = createServiceRoleSupabaseClient()

  // Unclaimed companies only — the claim page refuses owned ones.
  // Pending-credit count marks which can walk the invite channel.
  const { data: companies } = await svc
    .from("companies")
    .select("id, name, email, domain, status")
    .is("owner_id", null)
    .order("name")
    .limit(400)

  const { data: credits } = await svc
    .from("project_professionals")
    .select("company_id, projects!inner(status)")
    .eq("is_project_owner", false)
    .eq("status", "invited")
    .not("invited_email", "is", null)
    .in("projects.status", ["published", "completed"])
  const creditCount = new Map<string, number>()
  for (const c of credits ?? []) {
    if (c.company_id) creditCount.set(c.company_id, (creditCount.get(c.company_id) ?? 0) + 1)
  }

  const rows = (companies ?? []).map((c) => ({
    id: c.id,
    name: c.name ?? "—",
    email: c.email ?? null,
    domain: c.domain ?? null,
    status: String(c.status ?? ""),
    pendingCredits: creditCount.get(c.id) ?? 0,
  }))

  return <ClaimTestClient companies={rows} />
}
