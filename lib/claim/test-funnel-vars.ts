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
const FIXTURE_PROJECT_ID = "f6cae5bc-cbc7-4c13-9ab2-48863a30d9d0" // Hedendaags (published)
const FIXTURE_SERVICE_ID = "18b8eb0f-ba7d-4ad8-897f-642d7259d954" // interior-designer
const OLLI_HERO =
  "https://ogvobdcrectqsegqrquz.supabase.co/storage/v1/object/public/project-photos/f6cae5bc-cbc7-4c13-9ab2-48863a30d9d0/d01a8c81-c16c-4ccb-a218-a52f4fa53f5d.webp"

/** The fixture exists ON DEMAND: deleting Olli (row, credit, accounts)
 *  is always safe cleanup — the next test send or preview recreates
 *  exactly this state. Nothing here touches real companies.
 *
 *  Returns the EFFECTIVE fixture company id. A platform-channel
 *  walkthrough creates its own askolli.com row under a fresh id; the
 *  canonical fixture can't be recreated next to it (duplicate), and a
 *  token minted on the canonical id would violate its FK — which used
 *  to fail silently and ship test mails with the static sample URL.
 *  Such a row is ADOPTED as the fixture instead; if a completed
 *  walkthrough left it claimed, it's un-claimed first (everything on
 *  askolli.com is test state, same rules as the claim-test reset). */
async function ensureClaimFixture(svc: ReturnType<typeof createServiceRoleSupabaseClient>): Promise<string> {
  const { data: existing } = await svc
    .from("companies")
    .select("id, owner_id")
    .eq("domain", "askolli.com")
    .limit(1)
    .maybeSingle()
  if (existing && existing.id !== CLAIM_FIXTURE_ID) {
    if (existing.owner_id) {
      await svc
        .from("companies")
        .update({ owner_id: null, status: "invited", audience: "homeowner" } as never)
        .eq("id", existing.id)
    }
    return existing.id
  }

  await svc.from("companies").upsert(
    {
      id: CLAIM_FIXTURE_ID,
      name: "Olli",
      email: "hallo@askolli.com",
      domain: "askolli.com",
      website: "https://askolli.com",
      city: "Amsterdam",
      address: "Keizersgracht 123, Amsterdam",
      country: "Netherlands",
      status: "invited",
      audience: "homeowner",
      primary_service_id: FIXTURE_SERVICE_ID,
      services_offered: [FIXTURE_SERVICE_ID],
      hero_photo_url: OLLI_HERO,
      is_verified: false,
    } as never,
    { onConflict: "id", ignoreDuplicates: true },
  )
  const { data: credit } = await svc
    .from("project_professionals")
    .select("id")
    .eq("project_id", FIXTURE_PROJECT_ID)
    .eq("company_id", CLAIM_FIXTURE_ID)
    .limit(1)
    .maybeSingle()
  if (!credit) {
    await svc.from("project_professionals").insert({
      project_id: FIXTURE_PROJECT_ID,
      company_id: CLAIM_FIXTURE_ID,
      is_project_owner: false,
      status: "invited",
      invited_email: "niek@askolli.com",
      invited_service_category_ids: [FIXTURE_SERVICE_ID],
    } as never)
  }
  return CLAIM_FIXTURE_ID
}

export async function buildClaimTestFunnelVars(
  template: string,
  origin: string,
): Promise<Record<string, unknown> | null> {
  if (!/^(prospect|new-professional|outreach|visitor-nudge|verified)-/.test(template)) return null

  // Visitor-nudge variants map to their parent channel's funnel; the
  // platform variant rides the outreach token (same landing family).
  const channel = template.startsWith("prospect-") || template === "visitor-nudge-showcase" || template === "verified-reminder"
    ? ("showcase" as const)
    : template.startsWith("outreach-") || template === "visitor-nudge-platform"
      ? ("outreach" as const)
      : ("invite" as const)

  const svcEnsure = createServiceRoleSupabaseClient()
  const fixtureId = await ensureClaimFixture(svcEnsure)

  let creditId: string | null = null
  let tokenEmail = "hallo@askolli.com"
  let inviteVisuals: Record<string, unknown> = {}
  if (channel === "invite") {
    // The invite family rides the fixture's pending credit; its invited
    // address becomes the token's proven mailbox.
    const svc = createServiceRoleSupabaseClient()
    const { data: credit } = await svc
      .from("project_professionals")
      .select("id, invited_email, projects!inner(status)")
      .eq("company_id", fixtureId)
      .eq("is_project_owner", false)
      .eq("status", "invited")
      .not("invited_email", "is", null)
      .in("projects.status", ["published", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    creditId = credit?.id ?? null
    tokenEmail = (credit?.invited_email as string | null) ?? "niek@askolli.com"

    // The invite templates render a project card + inviter badge — pull
    // the fixture project's real fields so the email tells the same
    // story as the funnel behind its button (Olli, credited on the
    // fixture project) instead of the preview route's generic sample
    // visuals (which used to leave "Villa Oisterwijk" around an Olli
    // token — confusing mid-walkthrough).
    const [{ data: project }, { data: photo }, { data: owner }] = await Promise.all([
      svc.from("projects").select("title, slug, address_city").eq("id", FIXTURE_PROJECT_ID).maybeSingle(),
      svc
        .from("project_photos")
        .select("url")
        .eq("project_id", FIXTURE_PROJECT_ID)
        .order("is_primary", { ascending: false })
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle(),
      svc
        .from("project_professionals")
        .select("companies!inner(name, logo_url, city)")
        .eq("project_id", FIXTURE_PROJECT_ID)
        .eq("is_project_owner", true)
        .limit(1)
        .maybeSingle(),
    ])
    const projectRow = project as { title?: string | null; slug?: string | null; address_city?: string | null } | null
    const ownerCompany = (owner as { companies?: { name?: string | null; logo_url?: string | null; city?: string | null } } | null)?.companies
    inviteVisuals = {
      project_title: projectRow?.title ?? undefined,
      project_name: projectRow?.title ?? undefined,
      // Overwrites the sample "Villa" — filtered out of the card
      // subtitle when undefined.
      project_type: undefined,
      project_location: projectRow?.address_city ?? undefined,
      project_link: projectRow?.slug ? `${origin}/projects/${projectRow.slug}` : undefined,
      project_image: (photo as { url?: string } | null)?.url ?? OLLI_HERO,
      project_owner: ownerCompany?.name ?? undefined,
      inviter_company_name: ownerCompany?.name ?? undefined,
      inviter_logo_url: ownerCompany?.logo_url ?? undefined,
      inviter_subtitle: ownerCompany?.city ?? undefined,
      inviter_page_url: undefined,
    }
  }

  const { token } = await issueClaimToken({
    companyId: fixtureId,
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
    ...inviteVisuals,
  }
}
