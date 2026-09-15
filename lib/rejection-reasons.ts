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

/**
 * The reasons an admin can tick, in display order. `label` is the
 * canonical English phrase that gets STORED (the reviewer may be on any
 * locale — storing their translated label would break every lookup
 * below, and the rejection email would quote a raw label instead of its
 * full sentence). `key` addresses both the UI translation
 * (project_edit.rejection.reason_<key>) and the email copy.
 */
export const REJECTION_REASON_OPTIONS = [
  { key: "not_residential", label: "Not a residential project" },
  { key: "insufficient_photos", label: "Insufficient photos" },
  { key: "low_quality_images", label: "Low quality images" },
  { key: "no_real_photos", label: "No real photos (renders)" },
  { key: "missing_details", label: "Missing project details" },
  { key: "duplicate", label: "Duplicate project" },
  { key: "inappropriate", label: "Inappropriate content" },
  { key: "not_architecture", label: "Not distinctive enough as architecture or interior design" },
] as const

export type RejectionReasonKey = (typeof REJECTION_REASON_OPTIONS)[number]["key"]

/**
 * The sentence each reason becomes in the rejection email — one source
 * of truth, so the admin dialog can show exactly what the publisher
 * will read.
 */
export const REJECTION_REASON_EMAIL_COPY: Record<string, { en: string; nl: string }> = {
  not_residential: {
    en: 'This project falls outside Arco: for now we only list residential projects.',
    nl: 'Dit project valt buiten Arco: we tonen nu nog alleen woonprojecten.',
  },
  insufficient_photos: {
    en: 'The project has too few photos. Add more images and resubmit it.',
    nl: 'Het project heeft te weinig foto’s. Voeg meer afbeeldingen toe en dien het opnieuw in.',
  },
  low_quality_images: {
    en: 'The project photos do not meet our quality guidelines. Upload higher-resolution images and resubmit the project.',
    nl: 'De projectfoto’s voldoen niet aan onze kwaliteitsrichtlijnen. Upload afbeeldingen in hogere resolutie en dien het project opnieuw in.',
  },
  no_real_photos: {
    en: 'The project contains renders instead of photos of the built work. Replace them with real photos and resubmit it.',
    nl: 'Het project bevat renders in plaats van foto’s van het gerealiseerde werk. Vervang ze door echte foto’s en dien het opnieuw in.',
  },
  missing_details: {
    en: 'Some project details are missing. Complete the project and resubmit it.',
    nl: 'Er ontbreken projectgegevens. Vul het project verder aan en dien het opnieuw in.',
  },
  duplicate: {
    en: 'This project is already on Arco.',
    nl: 'Dit project staat al op Arco.',
  },
  inappropriate: {
    en: 'The project contains content that does not fit our guidelines.',
    nl: 'Het project bevat inhoud die niet past binnen onze richtlijnen.',
  },
  not_architecture: {
    en: 'The project does not show enough distinctive architecture or interior design work to be listed on Arco.',
    nl: 'Het project laat niet genoeg onderscheidend architectuur- of interieurontwerp zien om op Arco getoond te worden.',
  },
}

/** Canonical English phrase → key under project_status.rejection_reasons */
export const REJECTION_REASON_KEYS: Record<string, string> = {
  "not a residential project": "not_residential",
  "insufficient photos": "insufficient_photos",
  "low quality images": "low_quality_images",
  "no real photos (renders)": "no_real_photos",
  "missing project details": "missing_details",
  "duplicate project": "duplicate",
  "inappropriate content": "inappropriate",
  // The clarified phrase, plus the pre-clarification one still stored on
  // historical rejections — both resolve to the same (updated) copy.
  "not distinctive enough as architecture or interior design": "not_architecture",
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
