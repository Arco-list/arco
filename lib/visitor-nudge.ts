import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { resolveClaimChannel } from "@/lib/claim/resolve-channel"
import { issueClaimToken } from "@/lib/claim/claim-token"
import type { EmailVariables } from "@/lib/email-service"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.arcolist.com"

export type VisitorNudgeTemplate =
  | "visitor-nudge-invite"
  | "visitor-nudge-showcase"
  | "visitor-nudge-platform"

/**
 * The Visitor-nudge is ONE sequence step with three copy variants —
 * picked here, AT SEND TIME, by the same channel resolution every other
 * claim-family sender uses. A visitor enqueued yesterday whose credit
 * appeared overnight gets the invite copy today, and the freshly minted
 * token lands them in the matching funnel. The queue row stays the
 * abstract 'visitor-nudge'; the concrete template goes out in the
 * Resend tag, so the admin stats split per variant for free.
 *
 * Copy contract with the Visitor stamp: the stamp can be a mail
 * scanner's prefetch, so no variant ever says "we saw you looking" —
 * each reads as a normal follow-up that happens to lead with the
 * strongest asset (the credited project > the built page > the name).
 */
export async function buildVisitorNudge(
  companyId: string | null,
  email: string,
): Promise<{ template: VisitorNudgeTemplate; variables: EmailVariables }> {
  const svc = createServiceRoleSupabaseClient()

  // No companies row (Apollo prospect whose domain never matched):
  // the tokenless platform funnel is the only landing there is.
  if (!companyId) {
    const { data: prospect } = await svc
      .from("prospects")
      .select("company_name")
      .ilike("email", email)
      .limit(1)
      .maybeSingle()
    return {
      template: "visitor-nudge-platform",
      variables: {
        company_name: prospect?.company_name ?? undefined,
        ref_url: `${SITE_URL}/claim`,
      },
    }
  }

  const resolved = await resolveClaimChannel(companyId)
  const issued = await issueClaimToken({
    companyId,
    creditId: resolved.channel === "invite" ? resolved.creditId : null,
    email: email.toLowerCase(),
    channel: resolved.channel,
  })

  const { data: company } = await svc
    .from("companies")
    .select("name, slug, logo_url, city")
    .eq("id", companyId)
    .maybeSingle()

  const base: EmailVariables = {
    company_name: company?.name ?? undefined,
    claim_url: issued.url,
    ref_url: issued.url,
  }

  if (resolved.channel === "invite" && resolved.creditId) {
    // The credited project + who credited them — the asset that made
    // them click in the first place.
    const { data: credit } = await svc
      .from("project_professionals")
      .select("project_id, projects!inner(title, slug, address_city)")
      .eq("id", resolved.creditId)
      .maybeSingle()
    const project = (credit as { projects?: { title: string | null; slug: string | null; address_city: string | null } } | null)?.projects
    let projectImage: string | undefined
    let inviterName: string | undefined
    if (credit?.project_id) {
      const [{ data: photo }, { data: owner }] = await Promise.all([
        svc
          .from("project_photos")
          .select("url")
          .eq("project_id", credit.project_id)
          .order("is_primary", { ascending: false })
          .order("order_index", { ascending: true })
          .limit(1)
          .maybeSingle(),
        svc
          .from("project_professionals")
          .select("companies!inner(name)")
          .eq("project_id", credit.project_id)
          .eq("is_project_owner", true)
          .limit(1)
          .maybeSingle(),
      ])
      projectImage = (photo as { url?: string } | null)?.url ?? undefined
      inviterName = (owner as { companies?: { name?: string } } | null)?.companies?.name ?? undefined
    }
    return {
      template: "visitor-nudge-invite",
      variables: {
        ...base,
        project_title: project?.title ?? undefined,
        project_location: project?.address_city ?? undefined,
        project_image: projectImage,
        project_link: project?.slug ? `${SITE_URL}/projects/${project.slug}` : undefined,
        inviter_company_name: inviterName,
      },
    }
  }

  if (resolved.channel === "showcase") {
    return {
      template: "visitor-nudge-showcase",
      variables: {
        ...base,
        company_page_url: company?.slug ? `${SITE_URL}/professionals/${company.slug}` : undefined,
        logo_url: company?.logo_url ?? undefined,
        company_subtitle: company?.city ?? undefined,
      },
    }
  }

  // Outreach-resolved companies get the platform copy — the nudge is
  // for someone already standing in the funnel, not a cold pitch.
  return { template: "visitor-nudge-platform", variables: base }
}
