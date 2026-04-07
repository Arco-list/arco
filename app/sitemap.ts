
  import type { MetadataRoute } from "next"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/utils"
import { locales } from "@/i18n/config"

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
    url: `${baseUrl}/${locales[0]}${path}`,
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
    { path: "/businesses", priority: 0.6, changeFrequency: "monthly" },
    { path: "/about", priority: 0.4, changeFrequency: "monthly" },
  ]

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map(({ path, priority, changeFrequency }) => ({
    ...localizedUrls(baseUrl, path),
    lastModified: new Date(),
    changeFrequency,
    priority,
  }))

  // Published projects
  const { data: projects } = await supabase
    .from("projects")
    .select("slug, updated_at")
    .eq("status", "published")
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .limit(10000)

  const projectEntries: MetadataRoute.Sitemap = (projects ?? [])
    .filter((p): p is { slug: string; updated_at: string | null } => !!p.slug)
    .map((p) => ({
      ...localizedUrls(baseUrl, `/projects/${p.slug}`),
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))

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

  return [...staticEntries, ...projectEntries, ...companyEntries]
}
