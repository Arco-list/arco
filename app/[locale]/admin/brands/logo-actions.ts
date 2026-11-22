"use server"

import { revalidatePath } from "next/cache"
import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { storeRemoteImage } from "@/lib/collections/shared"
import { findLogoCandidates, type LogoCandidate } from "@/lib/brands/find-logo"

/**
 * Logo's van merken van hun eigen website (lib/brands/find-logo): per merk
 * de kandidaten tonen en er één kiezen, of voor alle merken zonder logo in
 * één keer de beste nemen. Elk opgeslagen logo krijgt een eigen
 * bestandsnaam, net als bij uploaden: een vaste naam bleef in cache hangen.
 */

async function requireAdmin(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in." }
  const { data: profile } = await supabase.from("profiles").select("user_types, admin_role").eq("id", user.id).maybeSingle()
  if (!isAdminUser(profile?.user_types, profile?.admin_role)) return { error: "Admin access required." }
  return { ok: true }
}

const websiteOf = (b: { website: string | null; domain: string | null }) => b.website || (b.domain ? `https://${b.domain}/` : null)

export async function findBrandLogoCandidates(brandId: string): Promise<{ candidates: LogoCandidate[] } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const sb = createServiceRoleSupabaseClient() as any
  const { data: brand } = await sb.from("brands").select("website, domain").eq("id", brandId).maybeSingle()
  const site = brand ? websiteOf(brand) : null
  if (!site) return { error: "This brand has no website." }
  return { candidates: await findLogoCandidates(site) }
}

async function storeLogo(sb: any, brandId: string, c: Pick<LogoCandidate, "url" | "svg">): Promise<string | null> {
  const name = `logo-${Date.now()}`
  if (c.svg) {
    const path = `brands/${brandId}/${name}.svg`
    const { error } = await sb.storage.from("company-assets").upload(path, Buffer.from(c.svg, "utf8"), { cacheControl: "3600", upsert: true, contentType: "image/svg+xml" })
    if (error) return null
    return sb.storage.from("company-assets").getPublicUrl(path).data?.publicUrl ?? null
  }
  if (c.url) return storeRemoteImage(sb, c.url, `brands/${brandId}`, name)
  return null
}

export async function setBrandLogoFromCandidate(brandId: string, candidate: Pick<LogoCandidate, "url" | "svg">): Promise<{ url: string } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const sb = createServiceRoleSupabaseClient() as any
  const url = await storeLogo(sb, brandId, candidate)
  if (!url) return { error: "Could not save this logo — try another one or upload it." }
  await sb.from("brands").update({ logo_url: url }).eq("id", brandId)
  revalidatePath("/admin/brands")
  revalidatePath(`/admin/brands/${brandId}`)
  return { url }
}

/**
 * Merken zonder logo, een paar per aanroep (binnen de tijdslimiet van de
 * pagina): de beste kandidaat van de site die zich laat opslaan. De knop
 * roept dit aan tot `remaining` nul is; merken zonder vondst slaat hij de
 * volgende keer over (`skip`).
 */
export async function findMissingLogos(skip: string[] = []): Promise<{ processed: number; found: number; failedIds: string[]; remaining: number } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const sb = createServiceRoleSupabaseClient() as any
  const BATCH = 6
  let q = sb.from("brands").select("id, website, domain").neq("status", "deactivated").or("logo_url.is.null,logo_url.eq.").order("name").limit(BATCH)
  if (skip.length > 0) q = q.not("id", "in", `(${skip.join(",")})`)
  const { data: brands } = await q
  const list = (brands ?? []) as Array<{ id: string; website: string | null; domain: string | null }>
  const failedIds: string[] = []
  let found = 0
  await Promise.all(list.map(async (b) => {
    const site = websiteOf(b)
    const candidates = site ? await findLogoCandidates(site) : []
    for (const c of candidates) {
      const url = await storeLogo(sb, b.id, c)
      if (url) { await sb.from("brands").update({ logo_url: url }).eq("id", b.id); found++; return }
    }
    failedIds.push(b.id)
  }))
  let countQ = sb.from("brands").select("id", { count: "exact", head: true }).neq("status", "deactivated").or("logo_url.is.null,logo_url.eq.")
  const allSkip = [...skip, ...failedIds]
  if (allSkip.length > 0) countQ = countQ.not("id", "in", `(${allSkip.join(",")})`)
  const { count } = await countQ
  if (found > 0) revalidatePath("/admin/brands")
  return { processed: list.length, found, failedIds, remaining: count ?? 0 }
}
