
  import type { MetadataRoute } from "next"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/utils"
import { locales, defaultLocale } from "@/i18n/config"
import { getHubs } from "@/lib/project-hubs"
import { getProfessionalHubs } from "@/lib/professional-hubs"

// Refresh the sitemap at most every hour
export const revalidate = 3600

type SitemapEntry = MetadataRoute.Sitemap[number]

function localizedUrls(baseUrl: string, path: string): {
  url: string
  alternates: SitemapEntry["alternates"]
} {
  const languages = Object.fromEntries(
    locales.map((l) => [l, `${baseUrl}/${l}${path}`])
  )
  return {
    // Use the default locale URL as the canonical entry
    url: `${baseUrl}/${defaultLocale}${path}`,
    alternates: { languages },
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl()
  const supabase = await createServerSupabaseClient()

  // Static, high-value pages
  const staticPaths: Array<{ path: string; priority: number; changeFrequency: SitemapEntry["changeFrequency"] }> = [
    { path: "", priority: 1.0, changeFrequency: "daily" },
    { path: "/projects", priority: 0.9, changeFrequency: "daily" },
    { path: "/professionals", priority: 0.9, changeFrequency: "daily" },
    // /businesses 307s to /businesses/architects — list the target, not
    // the redirect (GSC flags redirecting sitemap URLs as not-indexed).
    { path: "/businesses/architects", priority: 0.6, changeFrequency: "monthly" },
    { path: "/businesses/professionals", priority: 0.6, changeFrequency: "monthly" },
    { path: "/about", priority: 0.4, changeFrequency: "monthly" },
  ]

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map(({ path, priority, changeFrequency }) => ({
    ...localizedUrls(baseUrl, path),
    lastModified: new Date(),
    changeFrequency,
    priority,
  }))

  // Published projects — each entry declares its OWN photos as sitemap
  // image entries. Google Images uses this as the canonical page-owns-
  // image signal, so photos appearing in Similar/More-from rails on
  // other pages don't get attributed to those pages.
  const { data: projects } = await supabase
    .from("projects")
    .select("id, slug, updated_at")
    .eq("status", "published")
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .limit(10000)

  const publishedIds = (projects ?? []).map((p) => p.id).filter(Boolean)
  const photosByProject = new Map<string, string[]>()
  if (publishedIds.length > 0) {
    const { data: photoRows } = await supabase
      .from("project_photos")
      .select("project_id, url, is_primary, order_index")
      .in("project_id", publishedIds)
      .order("is_primary", { ascending: false })
      .order("order_index", { ascending: true })
    for (const row of photoRows ?? []) {
      if (!row.project_id || !row.url) continue
      const list = photosByProject.get(row.project_id) ?? []
      // Cap per project — primary + first tour photos carry the signal;
      // exhaustive lists just bloat the sitemap.
      if (list.length < 12) list.push(row.url)
      photosByProject.set(row.project_id, list)
    }
  }

  const projectEntries: MetadataRoute.Sitemap = (projects ?? [])
    .filter((p): p is { id: string; slug: string; updated_at: string | null } => !!p.slug)
    .map((p) => ({
      ...localizedUrls(baseUrl, `/projects/${p.slug}`),
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: photosByProject.get(p.id),
    }))

  // Programmatic hub pages (city / scope) — only hubs clearing the
  // inventory gate exist, so every listed URL is a real, stocked page.
  let hubEntries: MetadataRoute.Sitemap = []
  try {
    const { cities, scopes, types, combos, provinces } = await getHubs()
    hubEntries = [...cities, ...scopes, ...types, ...combos, ...provinces].map((hub) => ({
      ...localizedUrls(baseUrl, `/projects/${hub.slug}`),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  } catch { /* non-fatal — sitemap ships without hubs */ }

  let proHubEntries: MetadataRoute.Sitemap = []
  try {
    proHubEntries = (await getProfessionalHubs()).map((hub) => ({
      ...localizedUrls(baseUrl, `/professionals/${hub.slug}`),
    }))
  } catch { /* non-fatal */ }

  // Publicly visible companies. Matches the same status set used by
  // fetchProfessionalDetail and the homepage/listing queries: 'listed'
  // (claimed + active) and 'prospected' (unclaimed but editorially curated).
  const { data: companies } = await supabase
    .from("companies")
    .select("slug, updated_at")
    // Cast: 'prospected' exists in the live DB enum but the generated
    // types in lib/supabase/types.ts are stale and only include
    // 'unlisted' | 'listed' | 'deactivated'. Regenerate types to remove.
    .in("status", ["listed", "prospected"] as ("listed" | "prospected")[] as never)
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .limit(10000)

  const companyEntries: MetadataRoute.Sitemap = (companies ?? [])
    .filter((c): c is { slug: string; updated_at: string | null } => !!c.slug)
    .map((c) => ({
      ...localizedUrls(baseUrl, `/professionals/${c.slug}`),
      lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))

  return [...staticEntries, ...hubEntries, ...proHubEntries, ...projectEntries, ...companyEntries]
}
