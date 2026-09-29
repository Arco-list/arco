"use server"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { restoreHeldBackCredits } from "@/lib/subscriptions/enforce-credit-allowance"
import { notifySubscriber } from "@/lib/subscriptions/notify"
import { scheduleFoundingEnding } from "@/lib/subscriptions/schedule-mail"
import { foundingEndsAt, NET_CENTS } from "@/app/dashboard/subscription/checkout/constants"

/** Resolve the calling user's company id — owner first, then team
 *  membership via the legacy professionals table. */
async function resolveCompanyId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceRoleSupabaseClient()
  const { data: owned } = await service
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle()
  if (owned?.id) return owned.id

  const { data: membership } = await service
    .from("professionals")
    .select("company_id")
    .eq("user_id", user.id)
    .not("company_id", "is", null)
    .limit(1)
    .maybeSingle()
  return membership?.company_id ?? null
}

/** Whether the current user's company has claimed founding access. */
export async function getFoundingClaimStatus(): Promise<{ claimed: boolean }> {
  const companyId = await resolveCompanyId()
  if (!companyId) return { claimed: false }
  const service = createServiceRoleSupabaseClient()
  const { data } = await service
    .from("companies")
    .select("founding_claimed_at")
    .eq("id", companyId)
    .maybeSingle()
  return { claimed: Boolean((data as any)?.founding_claimed_at) }
}

/** Stamp the founding claim (idempotent — first click wins). The
 *  durable counterpart of the PostHog upgrade_intent event, and the
 *  counter behind the "first 100 companies" promise. */
export async function claimFoundingAccess(): Promise<{ claimed: boolean }> {
  const companyId = await resolveCompanyId()
  if (!companyId) return { claimed: false }
  const service = createServiceRoleSupabaseClient()
  const { data: stamped } = await service
    .from("companies")
    .update({ founding_claimed_at: new Date().toISOString() } as any)
    .eq("id", companyId)
    .is("founding_claimed_at", null)
    .select("id")

  // Founding access is Pro, so it owes the reader the same page a paid
  // Pro gets. The Stripe webhook restores held-back credits on an
  // upgrade; this path has no Stripe object and no webhook, so nothing
  // was restoring them — a founding member was given the unlimited
  // page and left with their projects still parked at the free limit.
  //
  // Only on the click that actually stamped. Running it again would
  // undo a later, deliberate "not this one" every time somebody
  // revisited the button.
  if ((stamped ?? []).length > 0) {
    await restoreHeldBackCredits(companyId)

    // And tell them, because nothing else will.
    //
    // Every other way onto Pro produces an invoice, and the invoice is
    // the confirmation — that is why there is no separate "welcome to
    // Pro" mail. Founding access has no invoice, so a company that
    // claimed it would get a page that quietly changed and not one
    // word about it, including the part that matters most: that it
    // ends, on a date, and renews into nothing.
    //
    // Both non-fatal. The claim itself has already succeeded.
    const claimedAt = new Date().toISOString()
    await notifySubscriber(companyId, "founding-active", {
      until_at: foundingEndsAt(claimedAt)?.toISOString() ?? null,
    })
    await scheduleFoundingEnding(companyId, claimedAt, NET_CENTS.month)
  }

  // Unchanged for the caller: a second click by somebody who already
  // has access is a success, not a failure.
  return { claimed: true }
}

/**
 * The two companies the pricing page shows as example listings.
 *
 * REAL ONES, DELIBERATELY. The section used to draw two invented firms
 * with invented logos — "Van Dijk Keukens", "B&W Zwembadbouw" — on a
 * public page that asks for money. A reader has no way to tell those
 * from customers, which makes the illustration a small untruth in the
 * one place it can least afford one.
 *
 * CHOSEN BY HAND, fetched live. Which two firms represent the product
 * is an editorial decision and belongs in the code; what they are
 * called, what they do and how many projects they have is theirs to
 * change, and is read fresh every time. So a rename or a new logo
 * follows along, while a delisting makes the card disappear rather
 * than become a claim that is no longer true.
 *
 * Fewer than two come back and the caller hides the section — half an
 * illustration explains nothing.
 */
const EXAMPLE_SLUGS: string[] = ["bongers-architecten", "state-of-architecture"]

export type PricingExampleListing = {
  name: string
  slug: string
  logoUrl: string | null
  serviceLabel: string | null
  projectCount: number
}

export async function getPricingExampleListings(): Promise<PricingExampleListing[]> {
  try {
    const svc = createServiceRoleSupabaseClient()

    const { data: companies } = await svc
      .from("companies")
      .select("id, name, slug, logo_url, primary_service_id")
      .in("slug", EXAMPLE_SLUGS)
      .eq("status", "listed" as never)

    const rows = (companies ?? []) as Array<{
      id: string; name: string | null; slug: string | null
      logo_url: string | null; primary_service_id: string | null
    }>
    if (rows.length === 0) return []

    // The eyebrow names the trade, not the company.
    const serviceIds = Array.from(
      new Set(rows.map((r) => r.primary_service_id).filter((id): id is string => Boolean(id))),
    )
    const serviceById = new Map<string, string>()
    if (serviceIds.length > 0) {
      const { data: cats } = await svc.from("categories").select("id, name").in("id", serviceIds)
      for (const c of (cats ?? []) as Array<{ id: string; name: string | null }>) {
        if (c.name) serviceById.set(c.id, c.name)
      }
    }

    // Counted once each, and counted the way the company page counts —
    // the number under the name is a promise about what the reader
    // finds when they follow the link, so anything the page would not
    // show must not be in it.
    //
    // TWO conditions, because a project appears on a company page only
    // when both hold: the project itself is published, AND the link
    // between company and project is live_on_page. A link can be
    // `listed` — the company is credited, but not on their own page —
    // and counting those said 7 projecten over a page showing 6.
    const { data: all } = await svc
      .from("project_professionals")
      .select("company_id, project_id, projects!inner(status)")
      .in("company_id", rows.map((r) => r.id))
      .eq("status", "live_on_page")
      .in("projects.status", ["published"])
    const projectsByCompany = new Map<string, Set<string>>()
    for (const r of (all ?? []) as Array<{ company_id: string | null; project_id: string | null }>) {
      if (!r.company_id || !r.project_id) continue
      const set = projectsByCompany.get(r.company_id) ?? new Set<string>()
      set.add(r.project_id)
      projectsByCompany.set(r.company_id, set)
    }

    const bySlug = new Map(rows.map((r) => [r.slug ?? "", r]))
    return EXAMPLE_SLUGS
      .map((slug) => {
        const r = bySlug.get(slug)
        if (!r || !r.name) return null
        return {
          name: r.name,
          slug,
          logoUrl: r.logo_url,
          serviceLabel: r.primary_service_id ? serviceById.get(r.primary_service_id) ?? null : null,
          projectCount: projectsByCompany.get(r.id)?.size ?? 0,
        }
      })
      .filter((c): c is PricingExampleListing => c !== null)
  } catch {
    // An illustration is never worth a broken page.
    return []
  }
}
