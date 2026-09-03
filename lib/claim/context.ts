import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * Everything the /claim screens render, loaded server-side off a
 * verified token. All of it is public information about the recipient's
 * own company — which is why viewing needs verification, not a session.
 */

export type ClaimServiceOption = { id: string; name: string; slug: string | null; imageUrl: string | null }
export type ClaimTaxonomyGroup = { id: string; name: string; slug: string | null; services: ClaimServiceOption[] }

export type ClaimRosterRow = {
  name: string
  serviceName: string | null
  serviceSlug: string | null
  logoUrl: string | null
  isOwner: boolean
  isSelf: boolean
  live: boolean
}

export type ClaimContext = {
  company: {
    id: string
    name: string
    slug: string | null
    city: string | null
    address: string | null
    domain: string | null
    contactLocal: string
    logoUrl: string | null
    heroPhotoUrl: string | null
    primaryServiceId: string | null
    ownerId: string | null
  }
  creditedService: ClaimServiceOption | null
  project: {
    title: string | null
    slug: string | null
    city: string | null
    /** Slug of the type category ("villa", "extension", …) — the same
     *  source as the TYPE spec on the project page; the client
     *  translates it via translateCategoryName. */
    typeSlug: string | null
    /** Primary first — the card scrolls through these on hover arrows. */
    photoUrls: string[]
    inviterName: string | null
  } | null
  roster: ClaimRosterRow[]
  taxonomy: ClaimTaxonomyGroup[]
}

/** Parent slugs that are professional services (the other four groups in
 *  `categories` are project spaces). Matches the product's picker. */
const PROFESSIONAL_GROUP_SLUGS = [
  "design-planning", "construction", "systems", "finishing", "outdoor-garden",
]

/** The five professional groups with their services — shared by the
 *  token-based context and the tokenless platform start. */
async function loadClaimTaxonomy(
  svc: ReturnType<typeof createServiceRoleSupabaseClient>,
): Promise<ClaimTaxonomyGroup[]> {
  const { data: parents } = await svc
    .from("categories")
    .select("id, name, slug, sort_order")
    .in("slug", PROFESSIONAL_GROUP_SLUGS)
    .order("sort_order")
  const parentIds = (parents ?? []).map((p) => p.id)
  const { data: children } = await svc
    .from("categories")
    .select("id, name, slug, parent_id, sort_order, image_url")
    .in("parent_id", parentIds.length ? parentIds : ["00000000-0000-0000-0000-000000000000"])
    .order("sort_order")
  return (parents ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? "",
    slug: p.slug ?? null,
    services: (children ?? [])
      .filter((c) => c.parent_id === p.id)
      // Photographer is an ASSIGNED role, never a picked one: it is set
      // when a photographer is added via the project details bar, flips
      // the page to the photographer format (audience='pro'), and that
      // format cannot be changed back. Offering it here let a claimant
      // turn their company page into a photographer page by accident.
      .filter((c) => c.slug !== "photographer")
      .map((c) => ({ id: c.id, name: c.name ?? "", slug: c.slug ?? null, imageUrl: (c as { image_url?: string | null }).image_url ?? null })),
  }))
}

/** Blank context for the tokenless platform start: taxonomy loaded, the
 *  company empty until the visitor picks or creates one. */
export async function loadPlatformStartContext(): Promise<ClaimContext> {
  const svc = createServiceRoleSupabaseClient()
  const taxonomy = await loadClaimTaxonomy(svc)
  return {
    company: {
      id: "", name: "", slug: null, city: null, address: null,
      domain: null, contactLocal: "", logoUrl: null, heroPhotoUrl: null,
      primaryServiceId: null, ownerId: null,
    },
    creditedService: null,
    project: null,
    roster: [],
    taxonomy,
  }
}

export async function loadClaimContext(input: {
  companyId: string
  creditId: string | null
  email: string
}): Promise<ClaimContext | null> {
  const svc = createServiceRoleSupabaseClient()

  const { data: company } = await svc
    .from("companies")
    .select("id, name, slug, city, address, domain, email, logo_url, hero_photo_url, primary_service_id, owner_id")
    .eq("id", input.companyId)
    .maybeSingle()
  if (!company) return null

  const taxonomy = await loadClaimTaxonomy(svc)
  const serviceById = new Map<string, ClaimServiceOption>()
  for (const g of taxonomy) for (const s of g.services) serviceById.set(s.id, s)

  // The credit that carried the invite → project + credited service.
  let creditedService: ClaimServiceOption | null = null
  let project: ClaimContext["project"] = null
  let roster: ClaimRosterRow[] = []

  if (input.creditId) {
    const { data: credit } = await svc
      .from("project_professionals")
      .select("id, project_id, invited_service_category_ids")
      .eq("id", input.creditId)
      .maybeSingle()

    if (credit?.project_id) {
      const serviceIds = (credit.invited_service_category_ids as string[] | null) ?? []
      creditedService = serviceIds.map((id) => serviceById.get(id)).find(Boolean) ?? null

      const { data: proj } = await svc
        .from("projects")
        .select("id, title, slug, address_city, location, project_type_category_id")
        .eq("id", credit.project_id)
        .maybeSingle()
      const { data: photos } = await svc
        .from("project_photos")
        .select("url, is_primary, order_index")
        .eq("project_id", credit.project_id)
        .order("is_primary", { ascending: false })
        .order("order_index")
        .limit(6)

      // Full roster on the project, claimed state included — the
      // greyed-out names are the social pressure the flow leans on.
      const { data: pps } = await svc
        .from("project_professionals")
        .select("id, is_project_owner, status, invited_email, invited_service_category_ids, companies(name, owner_id, logo_url, primary_service_id)")
        .eq("project_id", credit.project_id)

      let inviterName: string | null = null
      roster = (pps ?? []).map((pp) => {
        const co = pp.companies as { name: string | null; owner_id: string | null; logo_url: string | null; primary_service_id: string | null } | null
        const svcIds = (pp.invited_service_category_ids as string[] | null) ?? []
        const svcOpt = svcIds.map((id) => serviceById.get(id)).find(Boolean)
          ?? (co?.primary_service_id ? serviceById.get(co.primary_service_id) : undefined)
        const row: ClaimRosterRow = {
          name: co?.name ?? pp.invited_email ?? "—",
          serviceName: svcOpt?.name ?? null,
          serviceSlug: svcOpt?.slug ?? null,
          logoUrl: co?.logo_url ?? null,
          isOwner: pp.is_project_owner,
          isSelf: pp.id === input.creditId,
          live: pp.is_project_owner || pp.status === "live_on_page" || pp.status === "listed",
        }
        if (pp.is_project_owner) inviterName = co?.name ?? null
        return row
      })
      // Owner first, self second — the pair the sidebar shows; the rest
      // sit behind the "more" toggle.
      roster.sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || Number(b.isSelf) - Number(a.isSelf))

      let typeCategorySlug: string | null = null
      const typeCatId = (proj as { project_type_category_id?: string | null } | null)?.project_type_category_id
      if (typeCatId) {
        const { data: typeCat } = await svc
          .from("categories")
          .select("slug")
          .eq("id", typeCatId)
          .maybeSingle()
        typeCategorySlug = typeCat?.slug ?? null
      }

      project = proj
        ? {
            title: proj.title ?? null,
            slug: proj.slug ?? null,
            city: proj.address_city ?? proj.location ?? null,
            typeSlug: typeCategorySlug,
            photoUrls: (photos ?? []).map((p) => p.url).filter(Boolean) as string[],
            inviterName,
          }
        : null
    }
  }

  if (!creditedService && company.primary_service_id) {
    creditedService = serviceById.get(company.primary_service_id) ?? null
  }

  // Showcase-preview: heroPhotoUrl toont de professional-kaart zoals hij
  // op discover staat. hero_photo_url is bij prospects vrijwel altijd
  // leeg — val terug op de eerste foto van hun eigen gepubliceerde
  // project (dezelfde afleiding als de Showcase-mail gebruikt).
  let heroPhotoUrl: string | null = (company as { hero_photo_url?: string | null }).hero_photo_url ?? null
  if (!heroPhotoUrl) {
    const { data: ownPP } = await svc
      .from("project_professionals")
      .select("project_id, projects!inner(status)")
      .eq("company_id", input.companyId)
      .eq("is_project_owner", true)
      .eq("projects.status", "published")
      .limit(1)
      .maybeSingle()
    if (ownPP?.project_id) {
      const { data: hp } = await svc
        .from("project_photos")
        .select("url")
        .eq("project_id", ownPP.project_id)
        .order("is_primary", { ascending: false })
        .order("order_index")
        .limit(1)
        .maybeSingle()
      heroPhotoUrl = hp?.url ?? null
    }
  }

  const domain = company.domain ?? input.email.split("@")[1] ?? null
  const contactLocal = (company.email ?? input.email).split("@")[0]

  return {
    company: {
      id: company.id,
      name: company.name ?? "",
      slug: company.slug ?? null,
      city: company.city ?? null,
      address: company.address ?? null,
      domain,
      contactLocal,
      logoUrl: company.logo_url ?? null,
      heroPhotoUrl,
      primaryServiceId: company.primary_service_id ?? null,
      ownerId: company.owner_id ?? null,
    },
    creditedService,
    project,
    roster,
    taxonomy,
  }
}
