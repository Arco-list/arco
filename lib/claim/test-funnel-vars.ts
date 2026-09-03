import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { issueClaimToken } from "@/lib/claim/claim-token"

/**
 * Test/preview variables for the nine claim-family email templates —
 * showcase (prospect-*), invite (new-professional-*) and outreach
 * (outreach-*). Mints a REAL single-use token on the Olli DUMMY
 * fixture, so the button in a test send or admin preview opens the
 * actual /claim funnel; completing a walkthrough claims only Olli, and
 * /admin/claim-test's reset puts everything back.
 *
 * Returns null for templates outside the claim families. The visuals
 * switch to Olli so the email and the funnel behind its button show
 * the same company.
 */

const CLAIM_FIXTURE_ID = "c0c0c629-2983-4658-b834-c5dafe6bc7f3" // Olli — dummy test company
const OLLI_HERO =
  "https://ogvobdcrectqsegqrquz.supabase.co/storage/v1/object/public/project-photos/f6cae5bc-cbc7-4c13-9ab2-48863a30d9d0/d01a8c81-c16c-4ccb-a218-a52f4fa53f5d.webp"

export async function buildClaimTestFunnelVars(
  template: string,
  origin: string,
): Promise<Record<string, unknown> | null> {
  if (!/^(prospect|new-professional|outreach)-/.test(template)) return null

  const channel = template.startsWith("prospect-")
    ? ("showcase" as const)
    : template.startsWith("outreach-")
      ? ("outreach" as const)
      : ("invite" as const)

  let creditId: string | null = null
  let tokenEmail = "hallo@askolli.com"
  if (channel === "invite") {
    // The invite family rides the fixture's pending credit; its invited
    // address becomes the token's proven mailbox.
    const svc = createServiceRoleSupabaseClient()
    const { data: credit } = await svc
      .from("project_professionals")
      .select("id, invited_email, projects!inner(status)")
      .eq("company_id", CLAIM_FIXTURE_ID)
      .eq("is_project_owner", false)
      .eq("status", "invited")
      .not("invited_email", "is", null)
      .in("projects.status", ["published", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    creditId = credit?.id ?? null
    tokenEmail = (credit?.invited_email as string | null) ?? "niek@askolli.com"
  }

  const { token } = await issueClaimToken({
    companyId: CLAIM_FIXTURE_ID,
    creditId,
    email: tokenEmail,
    channel,
  })
  // The caller's origin, not NEXT_PUBLIC_SITE_URL: a preview or test
  // sent from a dev server must link back to that dev server, where the
  // funnel code under test actually runs.
  const funnelUrl = `${origin}/claim?t=${encodeURIComponent(token)}`

  return {
    // prospect-* and new-professional-* button on claim_url; outreach-*
    // buttons on ref_url.
    claim_url: funnelUrl,
    ref_url: funnelUrl,
    company_page_url: funnelUrl,
    company_name: "Olli",
    businessname: "Olli",
    company_subtitle: "Interieurontwerper · Amsterdam",
    logo_url: null,
    hero_image_url: OLLI_HERO,
  }
}
