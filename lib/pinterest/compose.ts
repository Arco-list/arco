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
// Pinterest allows up to 20 but ranking value drops off around 7-8.
// Our order is (room), type, scope, style, city, architect, brand.
const HASHTAGS_MAX = 7
// Brand tag is preserved verbatim (mixed case). #arco disambiguates from
// the more crowded lowercase #arco (arco lamps/lighting, Spanish "arco")
// only cosmetically — Pinterest hashtag matching is case-insensitive.
// Keep the mixed-case spelling because it renders as the brand name in
// the pin preview, not as the domain slug.
const BRAND_HASHTAG = "#Arco"
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

/** Compose the title as `{base} by {company}` if we have a company,
 *  otherwise just `{base}`. Truncated to TITLE_MAX. */
function buildTitle(base: string, company: string | null | undefined): string {
  const raw = company ? `${base} by ${company}` : base
  return truncate(raw.replace(/\s+/g, " ").trim(), TITLE_MAX)
}

// ── Description ──────────────────────────────────────────────────────────

// Paragraph separator between description blocks. Pinterest's pin-view
// UI collapses ordinary "\n\n" whitespace when rendering — U+2029 is the
// Unicode PARAGRAPH SEPARATOR (semantically distinct from generic
// whitespace) which some clients respect as a hard break where "\n\n"
// would render inline. Belt-and-braces: leading "\n" too, in case a
// downstream renderer normalises the paragraph separator away.
const PARAGRAPH_BREAK = "\n\u2029\n"

function buildDescription(rawDescription: string | null): string {
  const body = rawDescription ? stripHtml(rawDescription) : ""
  const closing = CLOSING_TAGLINE
  const room = DESCRIPTION_MAX - closing.length - PARAGRAPH_BREAK.length
  const trimmedBody = body.length > 0 ? truncate(body, Math.max(0, room)) : ""
  const glue = trimmedBody ? PARAGRAPH_BREAK : ""
  return `${trimmedBody}${glue}${closing}`.slice(0, DESCRIPTION_MAX)
}

/** Re-exported so the pin-workflow layer can use the same separator
 *  between description and hashtags. */
export const DESCRIPTION_PARAGRAPH_BREAK = PARAGRAPH_BREAK

// ── Hashtags ─────────────────────────────────────────────────────────────

function buildHashtags(
  parts: {
    space?: string | null
    buildingType?: string | null
    scope?: string | null
    style?: string | null
    city?: string | null
    companySlug?: string | null
  },
): string[] {
  // Order matters — first tag is the strongest topical signal. Room
  // leads on space pins (Pinterest room-search dominates), building
  // type next, then scope (renovation vs new-build is a high-intent
  // search bucket), style, city, architect. #Arco always trails so it
  // survives the cap even when other signals populate.
  const raw: (string | null | undefined)[] = [
    parts.space,
    parts.buildingType,
    parts.scope,
    parts.style,
    parts.city,
    parts.companySlug,
  ]
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const slug = slugForHashtag(item ?? null)
    if (!slug) continue
    if (seen.has(slug)) continue
    seen.add(slug)
    out.push(`#${slug}`)
    if (out.length >= HASHTAGS_MAX - 1) break // reserve last slot for brand
  }
  // Always trail with the brand tag (mixed case, verbatim).
  if (!seen.has(BRAND_HASHTAG.toLowerCase().slice(1))) {
    out.push(BRAND_HASHTAG)
  }
  return out
}

// ── Public builders ──────────────────────────────────────────────────────

/** Type-board pin — one per project, using project cover. Title is
 *  intentionally simple ({project} by {company}) — the pin lives on the
 *  Villa/Townhouse/etc board so building_type is implicit, and style/
 *  city are surfaced via hashtags where a data glitch is less visible
 *  than a UUID in the headline. */
export function composeTypePinCopy(input: PinCopyInput): PinCopy {
  const title = buildTitle(input.projectTitle, input.companyName)
  const description = buildDescription(input.projectDescription)
  const hashtags = buildHashtags({
    buildingType: input.buildingType,
    scope: input.scope,
    style: input.style,
    city: input.city,
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
 *  name leads the title so a viewer scrolling the Kitchen board sees
 *  the room the pin represents at a glance, and so the 4–5 space pins
 *  from one project don't read as near-duplicates on Pinterest. */
export function composeSpacePinCopy(input: PinCopyInput): PinCopy {
  const spaceLabel = input.spaceName?.trim() ?? "Space"
  const title = buildTitle(`${spaceLabel} of ${input.projectTitle}`, input.companyName)
  const description = buildDescription(input.projectDescription)
  const hashtags = buildHashtags({
    space: input.spaceSlug ?? input.spaceName ?? undefined,
    buildingType: input.buildingType,
    scope: input.scope,
    style: input.style,
    city: input.city,
    companySlug: input.companySlug,
  })
  return {
    title,
    description,
    hashtags,
    link: `${CANONICAL_ORIGIN}/projects/${input.projectSlug}`,
  }
}
