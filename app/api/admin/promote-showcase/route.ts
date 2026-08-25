import { NextRequest, NextResponse } from "next/server"

import { promoteCompanyToShowcase } from "../../../[locale]/admin/sales/actions"
import { isAdminUser } from "@/lib/auth-utils"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/**
 * GET /api/admin/promote-showcase?company_id=X
 *
 * Promote a catalogue company to Showcase, then redirect into the
 * company editor. Exists so the Sales table's Showcase pill can be a
 * plain <a target="_blank"> — the previous window.open()-after-await
 * approach was popup-blocked in Safari, so the edit tab never opened.
 */
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id")
  if (!companyId) {
    return NextResponse.json({ error: "company_id required" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin))
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()
  if (!isAdminUser(profile?.user_types, profile?.admin_role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }

  const result = await promoteCompanyToShowcase(companyId)
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Promotion failed" }, { status: 400 })
  }

  return NextResponse.redirect(
    new URL(`/dashboard/company?company_id=${companyId}`, request.nextUrl.origin),
  )
}
