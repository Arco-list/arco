import "server-only"

/**
 * Wat een bedrijf mag publiceren, afgeleid van de publiceerstanden van
 * zijn diensten (categories.publish_scope, migratie 297) en de ruimtes
 * die aan die diensten hangen (service_spaces). Eén bron voor de
 * importflow en straks de rest van de server; de projecteditor doet
 * hetzelfde aan de clientkant in zijn scopevak.
 *
 * - scopes: mag architectuurprojecten publiceren (Nieuwbouw, Renovatie,
 *   Interieur) — ook waar als het bedrijf geen enkele publicerende
 *   dienst heeft, zodat een admin altijd verder kan.
 * - spaces: de ruimtes waaronder deelprojecten vallen (Keuken, Tuin).
 * - defaultKind: wat een nieuw project van dit bedrijf standaard is. Bij
 *   beide standen beslist de primaire dienst.
 */

export type PublishSpace = { id: string; slug: string }
export type PublishOptions = {
  scopes: boolean
  spaces: PublishSpace[]
  defaultKind: "project" | "partial"
}

type Client = any

export async function getCompanyPublishOptions(supabase: Client, companyId: string): Promise<PublishOptions> {
  const fallback: PublishOptions = { scopes: true, spaces: [], defaultKind: "project" }
  const { data: company } = await supabase
    .from("companies")
    .select("primary_service_id, services_offered")
    .eq("id", companyId)
    .maybeSingle()
  if (!company) return fallback
  const serviceIds = Array.from(new Set([company.primary_service_id, ...(company.services_offered ?? [])].filter(Boolean))) as string[]
  if (serviceIds.length === 0) return fallback

  const [{ data: services }, { data: links }] = await Promise.all([
    supabase.from("categories").select("id, publish_scope").in("id", serviceIds),
    supabase.from("service_spaces").select("service_id, space_id, spaces(id, slug, sort_order, is_active)").in("service_id", serviceIds),
  ])
  const scopeById = new Map<string, string>(((services ?? []) as Array<{ id: string; publish_scope: string }>).map((s) => [s.id, s.publish_scope]))
  const hasProject = Array.from(scopeById.values()).includes("project")
  const hasPartial = Array.from(scopeById.values()).includes("partial")

  const spaces: PublishSpace[] = hasPartial
    ? Array.from(
        new Map(
          ((links ?? []) as Array<{ spaces: { id: string; slug: string; sort_order: number | null; is_active: boolean | null } | null }>)
            .map((l) => l.spaces)
            .filter((s): s is NonNullable<typeof s> => Boolean(s) && s!.is_active !== false)
            .map((s) => [s.id, { id: s.id, slug: s.slug, sort: Number(s.sort_order ?? 0) }]),
        ).values(),
      )
        .sort((a, b) => a.sort - b.sort)
        .map(({ id, slug }) => ({ id, slug }))
    : []

  let defaultKind: "project" | "partial" = "project"
  if (hasPartial && !hasProject) defaultKind = "partial"
  else if (hasPartial && hasProject) {
    const primaryScope = company.primary_service_id ? scopeById.get(company.primary_service_id) : undefined
    defaultKind = primaryScope === "partial" ? "partial" : "project"
  }

  return { scopes: hasProject || !hasPartial, spaces, defaultKind }
}

/** De primaire ruimte van een deelproject: de toegestane ruimte met de
 *  meeste foto's, anders de eerste toegestane ruimte. */
export function pickPrimarySpace(options: PublishOptions, photoCountBySlug: Map<string, number>): PublishSpace | null {
  if (options.spaces.length === 0) return null
  let best: PublishSpace | null = null
  let bestCount = -1
  for (const space of options.spaces) {
    const n = photoCountBySlug.get(space.slug) ?? 0
    if (n > bestCount) { best = space; bestCount = n }
  }
  return best ?? options.spaces[0]
}
