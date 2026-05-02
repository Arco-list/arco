// Company slug utilities.
//
// Slug lifecycle (see Notion: Project SEO doc):
//   draft         — slug is transient. Each name change can rebuild it; no
//                   SEO impact since the page isn't in the sitemap.
//   draft → listed — lock-in moment. Regenerate slug from current `name`
//                   with collision handling. This becomes Google's URL.
//   listed (renamed) — generate new slug, write a `company_redirects` row
//                   from old → new, return 301. Same machinery as
//                   `project_redirects`.
//
// Use `slugifyCompanyName` for the raw transform and `ensureUniqueCompanySlug`
// for the actual write — the latter handles collisions by appending -2, -3, …
// against `companies.slug` (and the live `company_redirects.old_slug` set, so
// we never reissue a slug that's currently being redirected away from).
import type { SupabaseClient } from "@supabase/supabase-js"

export function slugifyCompanyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Resolve a desired slug to one that's actually safe to use:
 *   - Not in use by any other company (excluding `excludeCompanyId` when
 *     provided, so a company keeps its own slug if nothing else conflicts).
 *   - Not currently the `old_slug` side of an active redirect — those are
 *     committed to forwarding traffic away from themselves and reusing them
 *     would create a loop.
 *
 * Falls back to `<base>-2`, `<base>-3`, … on collision. In the rare case
 * we exhaust the suffix budget (1000), throws so the caller surfaces an
 * actionable error rather than picking a random fallback.
 */
export async function ensureUniqueCompanySlug(
  baseSlug: string,
  supabase: SupabaseClient,
  excludeCompanyId?: string,
): Promise<string> {
  const candidate = baseSlug || "company"
  const tryCandidate = async (s: string): Promise<boolean> => {
    const companyQuery = supabase.from("companies").select("id").eq("slug", s).limit(1)
    const [companyRes, redirectRes] = await Promise.all([
      excludeCompanyId ? companyQuery.neq("id", excludeCompanyId) : companyQuery,
      supabase.from("company_redirects").select("id").eq("old_slug", s).limit(1),
    ])
    const companyTaken = (companyRes.data?.length ?? 0) > 0
    const redirectTaken = (redirectRes.data?.length ?? 0) > 0
    return !companyTaken && !redirectTaken
  }

  if (await tryCandidate(candidate)) return candidate
  for (let n = 2; n < 1000; n++) {
    const next = `${candidate}-${n}`
    if (await tryCandidate(next)) return next
  }
  throw new Error(`ensureUniqueCompanySlug: exhausted 1000 suffix attempts for "${baseSlug}"`)
}

/**
 * Resolve a slug through the `company_redirects` table, following one-hop
 * chains (capped at 10) so a slug that's been renamed multiple times still
 * resolves to the current canonical. Mirrors the project-side `resolveRedirect`.
 *
 * Returns the original slug when no redirect exists, so callers can use the
 * result directly as the canonical slug for downstream queries.
 */
export async function resolveCompanyRedirect(
  slug: string,
  supabase: SupabaseClient,
  visited: Set<string> = new Set(),
): Promise<string> {
  if (visited.has(slug)) return Array.from(visited)[0] ?? slug
  visited.add(slug)
  if (visited.size > 10) return Array.from(visited)[0] ?? slug

  const { data, error } = await supabase
    .from("company_redirects")
    .select("new_slug")
    .eq("old_slug", slug)
    .maybeSingle()

  if (error || !data?.new_slug) return slug
  return resolveCompanyRedirect(data.new_slug, supabase, visited)
}
