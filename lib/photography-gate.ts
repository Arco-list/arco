/**
 * Photography section gate.
 *
 * Phase 1 of the photography landing page (/businesses/photography) is
 * admin-only — the marketing surface goes live to architects once we
 * have enough listed photographers to fill the grid. Mirror of
 * lib/products-gate.ts.
 *
 * Used by:
 *   - app/[locale]/businesses/photography/page.tsx
 *
 * Flip the gate (or remove the call) when the page is ready to ship
 * publicly.
 */

import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"

export async function requirePhotographyAdmin(): Promise<void> {
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
