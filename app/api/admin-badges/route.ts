import { NextResponse } from "next/server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { countOutboundDueCompanies } from "../../[locale]/admin/sales/actions"
import { countUnreadInboundEmails } from "../../[locale]/admin/inbox/actions"
import { countProjectsToReview } from "../../[locale]/admin/projects/actions"

/**
 * Admin badge counts consumed by the Header client component so the
 * cumulative pills next to Growth / Marketplace (and the per-item
 * badges inside the account dropdown) show even on pages that don't
 * bake the admin nav into `navLinks` — chiefly the homepage. The
 * admin layout already passes these counts server-side; this endpoint
 * mirrors them for every other route.
 *
 * Non-admin sessions get an empty object without running any of the
 * count queries, so the extra network hop is admin-only.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return NextResponse.json({})

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role, is_active")
    .eq("id", session.user.id)
    .maybeSingle()
  if (profile?.is_active === false) return NextResponse.json({})
  if (!isAdminUser(profile?.user_types, profile?.admin_role)) return NextResponse.json({})

  const [outboundDueCount, inboxUnreadCount, projectsToReviewCount] = await Promise.all([
    countOutboundDueCompanies(),
    countUnreadInboundEmails(),
    countProjectsToReview(),
  ])

  return NextResponse.json({ outboundDueCount, inboxUnreadCount, projectsToReviewCount })
}
