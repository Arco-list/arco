/**
 * Products section gate.
 *
 * Phase 1 of Arco Products is admin-only — the catalog, brand pages,
 * product detail pages, and all admin tools are gated behind this check
 * so we can build, scrape, and stage content without exposing it to the
 * public. Flip the gate (or remove the calls) when Phase 4 ships.
 *
 * Used by:
 *   - app/[locale]/products/page.tsx           (discover)
 *   - app/[locale]/products/[slug]/page.tsx    (product detail)
 *   - app/[locale]/brands/[slug]/page.tsx      (brand detail)
 *
 * Admin tables under /admin/* are already gated by the admin layout.
 */

import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"

export async function requireProductsAdmin(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()

  if (!isAdminUser(profile?.user_types, profile?.admin_role)) {
    notFound()
  }
}
