/**
 * Wat een dienst mag publiceren (categories.publish_scope, migratie 297).
 * none: niets (fotograaf, schilder). project: architectuurprojecten
 * (architect, interieurarchitect). partial: deelprojecten — een keuken,
 * een zwembad — alleen zichtbaar onder een ruimtefilter. De oude boolean
 * can_publish_projects volgt deze kolom via een trigger.
 */
export const PUBLISH_SCOPES = ["none", "project", "partial"] as const
export type PublishScope = (typeof PUBLISH_SCOPES)[number]

export const PUBLISH_SCOPE_LABEL: Record<PublishScope, string> = {
  none: "Nothing",
  project: "Projects",
  partial: "Partial projects",
}

export const PUBLISH_SCOPE_HINT: Record<PublishScope, string> = {
  none: "Appears on projects as a credit only.",
  project: "Publishes architecture projects: the main grid.",
  partial: "Publishes partial projects: visible under a space filter.",
}

export function toPublishScope(value: unknown, fallbackCanPublish?: boolean | null): PublishScope {
  if (value === "project" || value === "partial" || value === "none") return value
  return fallbackCanPublish ? "project" : "none"
}

const LABEL_NL: Record<PublishScope, string> = {
  none: "Niets",
  project: "Projecten",
  partial: "Deelprojecten",
}
const HINT_NL: Record<PublishScope, string> = {
  none: "Staat op projecten alleen als credit.",
  project: "Publiceert architectuurprojecten: de hoofdgrid.",
  partial: "Publiceert deelprojecten: zichtbaar onder een ruimtefilter.",
}

export function publishScopeLabel(scope: PublishScope, locale: string): string {
  return locale === "nl" ? LABEL_NL[scope] : PUBLISH_SCOPE_LABEL[scope]
}
export function publishScopeHint(scope: PublishScope, locale: string): string {
  return locale === "nl" ? HINT_NL[scope] : PUBLISH_SCOPE_HINT[scope]
}

/** De drie scopes van een project (projects.project_type, canoniek). */
export const ALL_SCOPES = ["new_build", "renovation", "interior_design"] as const
export type ScopeSlug = (typeof ALL_SCOPES)[number]

/** De scopes die een bedrijf ziet: de vereniging van project_scopes van
 *  zijn diensten met stand 'project'. Een dienst met een lege lijst, of
 *  een bedrijf zonder dienst met stand 'project', krijgt alle drie. */
export function resolveScopeSlugs(services: Array<{ publish_scope: string; project_scopes: string[] | null }>): ScopeSlug[] {
  const projectServices = services.filter((s) => s.publish_scope === "project")
  if (projectServices.length === 0) return [...ALL_SCOPES]
  const set = new Set<string>()
  for (const s of projectServices) {
    const list = s.project_scopes ?? []
    if (list.length === 0) return [...ALL_SCOPES]
    for (const x of list) set.add(x)
  }
  return ALL_SCOPES.filter((x) => set.has(x))
}


/** Wat een nieuw project van een bedrijf standaard is: een ruimteproject
 *  wanneer het alleen diensten met stand 'partial' heeft; bij beide
 *  standen beslist de primaire dienst. Eén regel voor de import
 *  (lib/projects/publish-options.ts) en voor "Leeg project". */
export function resolveDefaultKind(
  services: Array<{ id: string; publish_scope: string }>,
  primaryServiceId: string | null | undefined,
): "project" | "partial" {
  const scopes = services.map((s) => s.publish_scope)
  const hasProject = scopes.includes("project")
  const hasPartial = scopes.includes("partial")
  if (hasPartial && !hasProject) return "partial"
  if (hasPartial && hasProject) {
    const primary = services.find((s) => s.id === primaryServiceId)?.publish_scope
    return primary === "partial" ? "partial" : "project"
  }
  return "project"
}
