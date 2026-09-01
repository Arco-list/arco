import "server-only"

import { logger } from "@/lib/logger"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * Reconcile third-party credits against the services a company actually
 * offers — run once, when the company is created/claimed.
 *
 * A credit's service is the project owner's statement about what that
 * company did on their project, so it is normally left alone. But until
 * the company exists nobody has checked it against reality, and the
 * editor's service dropdown only lists the company's own services — so a
 * credit naming a service the company does not offer becomes an
 * unreachable value the owner cannot even re-select.
 *
 * The rule, in order:
 *   - any credited service the company DOES offer is kept, untouched
 *   - a dropped service is replaced by the NEAREST service the company
 *     does offer: first one sharing a meaningful word ("Lighting
 *     Designer" -> "Lighting"), then one under the same parent category
 *   - only if nothing is near does it fall back to the primary service
 *   - a company with no services declared changes nothing (there is no
 *     better answer, and blanking a credit is worse than a stale one)
 *
 * The nearest-match step matters: Ann interiors was credited "Lighting
 * Designer" and offers "Lighting" among nine services. Jumping straight
 * to their primary would have turned a lighting credit into an
 * interior-design one, losing what the project owner actually meant.
 *
 * Only non-owner credits are considered: the owner row describes the
 * company's own project and was authored by the company itself.
 */
export async function reconcileCreditServicesToCompany(
  companyId: string,
): Promise<{ examined: number; updated: number }> {
  const supabase = createServiceRoleSupabaseClient()

  const { data: company } = await supabase
    .from("companies")
    .select("primary_service_id, services_offered")
    .eq("id", companyId)
    .maybeSingle()
  if (!company) return { examined: 0, updated: 0 }

  const offered = new Set<string>(
    [...((company.services_offered as string[] | null) ?? []), company.primary_service_id]
      .filter((v): v is string => Boolean(v)),
  )
  // Nothing declared yet — leave every credit as the owner wrote it.
  if (offered.size === 0) return { examined: 0, updated: 0 }

  // Resolve names/parents so a dropped service can be matched to the
  // nearest thing the company does offer.
  const { data: creditRows } = await supabase
    .from("project_professionals")
    .select("invited_service_category_ids")
    .eq("company_id", companyId)
    .eq("is_project_owner", false)
  const creditedIds = new Set<string>(
    (creditRows ?? []).flatMap((r) => (r.invited_service_category_ids as string[] | null) ?? []),
  )
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .in("id", Array.from(new Set([...creditedIds, ...offered])))
  type Cat = { id: string; name: string | null; parent_id: string | null }
  const catById = new Map<string, Cat>(((categories ?? []) as Cat[]).map((c) => [c.id, c]))

  // Match on the SUBJECT of a service, never on its role suffix:
  // "Lighting Designer" and "Interior Designer" share "designer", which
  // would pair a lighting credit with interior design. Dropping those
  // generic words leaves "lighting" vs "interior" — no false match.
  const ROLE_WORDS = new Set(["designer", "design", "service", "services", "general", "specialist"])
  const wordsOf = (id: string): Set<string> =>
    new Set(
      (catById.get(id)?.name ?? "")
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 5 && !ROLE_WORDS.has(w)),
    )

  /** Nearest offered service to `droppedId`, or null when nothing is close. */
  const nearestOffered = (droppedId: string): string | null => {
    const want = wordsOf(droppedId)
    let bestId: string | null = null
    let bestScore = 0
    for (const id of offered) {
      const shared = [...wordsOf(id)].filter((w) => want.has(w)).length
      if (shared > bestScore) { bestScore = shared; bestId = id }
    }
    if (bestId) return bestId
    const parent = catById.get(droppedId)?.parent_id
    if (!parent) return null
    for (const id of offered) {
      if (catById.get(id)?.parent_id === parent) return id
    }
    return null
  }

  const { data: credits } = await supabase
    .from("project_professionals")
    .select("id, invited_service_category_ids")
    .eq("company_id", companyId)
    .eq("is_project_owner", false)

  const rows = (credits ?? []) as Array<{ id: string; invited_service_category_ids: string[] | null }>
  let updated = 0

  for (const row of rows) {
    const current = row.invited_service_category_ids ?? []
    if (current.length === 0) continue // already falls back to the company's service

    const kept = current.filter((id) => offered.has(id))
    // Everything the owner picked is offered — their statement stands.
    if (kept.length === current.length) continue

    // Replace each dropped service with the nearest offered one, so a
    // lighting credit stays a lighting credit where possible.
    const replacements = current
      .filter((id) => !offered.has(id))
      .map(nearestOffered)
      .filter((id): id is string => Boolean(id))

    const resolved = Array.from(new Set([...kept, ...replacements]))
    const next = resolved.length > 0
      ? resolved
      : company.primary_service_id
        ? [company.primary_service_id]
        : null
    if (!next) continue
    // Nothing actually moved.
    if (next.length === current.length && next.every((id) => current.includes(id))) continue

    const { error } = await supabase
      .from("project_professionals")
      .update({ invited_service_category_ids: next })
      .eq("id", row.id)
    if (error) {
      logger.warn("Credit service reconcile failed", { scope: "company-claim", companyId, creditId: row.id, error: error.message })
      continue
    }
    updated++
    logger.info("Credit service reconciled to company services", {
      scope: "company-claim", companyId, creditId: row.id, from: current, to: next,
    })
  }

  return { examined: rows.length, updated }
}
