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
