/**
 * Rejection reasons are authored in /admin/projects from a fixed list
 * (REJECTION_REASONS in components/admin-projects-data-table.tsx) and
 * stored joined by ". " in projects.rejection_reason, optionally with a
 * free-text note appended.
 *
 * The stored value is therefore English, but the owner reading it in the
 * dashboard may be on the Dutch locale. Map the known phrases back to
 * i18n keys and translate those; anything unrecognised (a hand-typed
 * note) is passed through verbatim rather than mangled.
 */

/** Canonical English phrase → key under project_status.rejection_reasons */
export const REJECTION_REASON_KEYS: Record<string, string> = {
  "not a residential project": "not_residential",
  "insufficient photos": "insufficient_photos",
  "low quality images": "low_quality_images",
  "missing project details": "missing_details",
  "duplicate project": "duplicate",
  "inappropriate content": "inappropriate",
  "not architecture or interior design": "not_architecture",
  // Written by the admin action when a status change carries no reason.
  "no reason provided": "none_given",
}

/**
 * Translate a stored rejection reason for display.
 * @param raw   the stored projects.rejection_reason value
 * @param t     a translator scoped to `project_status.rejection_reasons`
 */
export function translateRejectionReason(
  raw: string | null | undefined,
  t: (key: string) => string,
): string | null {
  if (!raw) return null
  return raw
    .split(". ")
    .map((part) => {
      const trimmed = part.trim().replace(/\.$/, "")
      if (!trimmed) return null
      const key = REJECTION_REASON_KEYS[trimmed.toLowerCase()]
      if (!key) return trimmed
      try {
        return t(key)
      } catch {
        return trimmed
      }
    })
    .filter(Boolean)
    .join(". ")
}
