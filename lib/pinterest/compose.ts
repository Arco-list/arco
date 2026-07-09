/**
 * Pin copy builders — pure functions producing the Pinterest API payload
 * for the type board (one pin per project) and the space boards (one pin
 * per space feature).
 *
 * Design constraints (see docs/pinterest-sync.md):
 *   * Title cap at 100 chars — Pinterest truncates beyond, so the doc's
 *     drop order (style → company → "in {city}") kicks in for long
 *     project titles.
 *   * Description cap at 500 chars.
 *   * Hashtags: up to 5, one per signal, lower-case ASCII slug.
 *   * English only (Pinterest's search is en-US dominant).
 *   * Link: canonical arcolist.com URL — never localised.
 */

export interface PinCopyInput {
  projectTitle: string
  projectSlug: string
  projectDescription: string | null
  companyName: string | null
  companySlug: string | null
  city: string | null
  style: string | null
  buildingType: string | null
  scope: string | null
  spaceName?: string | null
  spaceSlug?: string | null
}

export interface PinCopy {
  title: string
  description: string
  hashtags: string[]
  link: string
}

// ── Constants ────────────────────────────────────────────────────────────
const TITLE_MAX = 100
const DESCRIPTION_MAX = 500
const HASHTAGS_MAX = 5
const CANONICAL_ORIGIN = "https://www.arcolist.com"
const CLOSING_TAGLINE =
  "Seen on Arco — the curated platform for architecture & interior design."

// ── Text helpers ─────────────────────────────────────────────────────────

/** Strip HTML and collapse whitespace so we can measure real character
 *  counts against the caps. */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
}

/** ASCII-slugify for hashtags. Diacritics stripped, punctuation dropped,
 *  spaces/underscores → single hyphen removal (hashtags run words
 *  together). Returns an empty string for null/blank input — caller must
 *  filter. */
function slugForHashtag(input: string | null | undefined): string {
  if (!input) return ""
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim()
}

/** Truncate text at word boundary if possible, else hard truncate. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const slice = text.slice(0, max - 1)
  const lastSpace = slice.lastIndexOf(" ")
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice
  return cut.replace(/[,;:.\s]+$/, "") + "…"
}

// ── Title builders ───────────────────────────────────────────────────────

interface TitlePartsBase {
  base: string
  company?: string
  style?: string
  buildingType?: string
  city?: string
}

/** Fit the title within TITLE_MAX by dropping optional parts in the doc's
 *  fallback order: {style} → {company} → in {city}. */
function fitTitle(parts: TitlePartsBase): string {
  const buildingBit = parts.buildingType ? ` ${parts.buildingType}` : ""

  const attempts = [
    () => `${parts.base}${parts.company ? ` by ${parts.company}` : ""}` +
      (parts.style || buildingBit ? ` · ${(parts.style ?? "").trim()}${buildingBit}`.replace(/\s+/g, " ") : "") +
      (parts.city ? ` in ${parts.city}` : ""),
    // Drop style
    () => `${parts.base}${parts.company ? ` by ${parts.company}` : ""}` +
      (buildingBit ? ` ·${buildingBit}` : "") +
      (parts.city ? ` in ${parts.city}` : ""),
    // Drop company
    () => `${parts.base}` +
      (parts.style || buildingBit ? ` · ${(parts.style ?? "").trim()}${buildingBit}`.replace(/\s+/g, " ") : "") +
      (parts.city ? ` in ${parts.city}` : ""),
    // Drop city
    () => `${parts.base}` +
      (buildingBit ? ` ·${buildingBit}` : ""),
    // Just base
    () => parts.base,
  ]

  for (const build of attempts) {
    const candidate = build().replace(/\s+/g, " ").trim()
    if (candidate.length <= TITLE_MAX) return candidate
  }
  return truncate(parts.base, TITLE_MAX)
}

// ── Description ──────────────────────────────────────────────────────────

function buildDescription(rawDescription: string | null): string {
  const body = rawDescription ? stripHtml(rawDescription) : ""
  const closing = CLOSING_TAGLINE
  const room = DESCRIPTION_MAX - closing.length - 2 // "\n\n"
  const trimmedBody = body.length > 0 ? truncate(body, Math.max(0, room)) : ""
  const glue = trimmedBody ? "\n\n" : ""
  return `${trimmedBody}${glue}${closing}`.slice(0, DESCRIPTION_MAX)
}

// ── Hashtags ─────────────────────────────────────────────────────────────

function buildHashtags(
  parts: {
    buildingType?: string | null
    space?: string | null
    scope?: string | null
    style?: string | null
    companySlug?: string | null
  },
): string[] {
  // Order matters — first tag is the strongest topical signal (building
  // type for type pins, space for space pins). arcolist always trails so
  // it survives the 5-tag cap even when other signals populate.
  const raw: (string | null | undefined)[] = [
    parts.buildingType,
    parts.space,
    parts.scope,
    parts.style,
    parts.companySlug,
    "arcolist",
  ]
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const slug = slugForHashtag(item ?? null)
    if (!slug) continue
    if (seen.has(slug)) continue
    seen.add(slug)
    out.push(`#${slug}`)
    if (out.length >= HASHTAGS_MAX) break
  }
  return out
}

// ── Public builders ──────────────────────────────────────────────────────

/** Type-board pin — one per project, using project cover. */
export function composeTypePinCopy(input: PinCopyInput): PinCopy {
  const title = fitTitle({
    base: input.projectTitle,
    company: input.companyName ?? undefined,
    style: input.style ?? undefined,
    buildingType: input.buildingType ?? undefined,
    city: input.city ?? undefined,
  })
  const description = buildDescription(input.projectDescription)
  const hashtags = buildHashtags({
    buildingType: input.buildingType,
    scope: input.scope,
    style: input.style,
    companySlug: input.companySlug,
  })
  return {
    title,
    description,
    hashtags,
    link: `${CANONICAL_ORIGIN}/projects/${input.projectSlug}`,
  }
}

/** Space-board pin — one per project_feature, using space cover. Space
 *  name leads the title so a viewer scrolling the Kitchen board sees the
 *  room the pin represents at a glance. */
export function composeSpacePinCopy(input: PinCopyInput): PinCopy {
  const spaceLabel = input.spaceName?.trim() ?? "Space"
  const title = fitTitle({
    base: `${spaceLabel} of ${input.projectTitle}`,
    company: input.companyName ?? undefined,
    style: input.style ?? undefined,
    // Building type intentionally omitted on space pins — the space label
    // is already the strongest signal in the title.
    city: input.city ?? undefined,
  })
  const description = buildDescription(input.projectDescription)
  const hashtags = buildHashtags({
    space: input.spaceSlug ?? input.spaceName ?? undefined,
    buildingType: input.buildingType,
    scope: input.scope,
    style: input.style,
    companySlug: input.companySlug,
  })
  return {
    title,
    description,
    hashtags,
    link: `${CANONICAL_ORIGIN}/projects/${input.projectSlug}`,
  }
}
