/**
 * Brands section gate.
 *
 * The brands layer (brand → series → photo) is admin-only while it is
 * being filled. The public /brands/[brand] and /brands/[brand]/[series]
 * pages will call this so content can be staged without being exposed;
 * flip the gate (or remove the calls) when the layer goes public.
 *
 * The product catalog that first used this gate is gone (migration 290).
 * The function name stays so the call sites read the same.
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
