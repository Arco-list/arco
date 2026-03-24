import { redirect } from "next/navigation"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getActiveCompanyId } from "@/lib/active-company"
import { TeamPageClient } from "./team-page-client"
import { claimPendingTeamInvitesAction } from "./actions"

export default async function TeamPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw new Error(userError.message)
  if (!user) redirect("/login?redirectTo=/dashboard/team")

  // Auto-claim any pending team invites for this user
  try {
    await claimPendingTeamInvitesAction(user.id)
  } catch {
    // Non-fatal
  }

  // Find company: owned (priority) → cookie → membership
  let company: { id: string; name: string } | null = null
  let isOwner = false

  // 1. Always prefer owned company (oldest first)
  const { data: ownedCompany } = await supabase
    .from("companies")
    .select("id, name")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (ownedCompany) {
    company = ownedCompany
    isOwner = true
  }

  // 2. No owned company — check cookie for membership
  if (!company) {
    const activeId = await getActiveCompanyId()
    if (activeId) {
      const { data: membership } = await supabase
        .from("company_members")
        .select("company_id, companies(id, name)")
        .eq("company_id", activeId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()

      if (membership?.companies) {
        company = membership.companies as unknown as { id: string; name: string }
      }
    }
  }

  // 3. Fallback: first team membership (oldest first)
  if (!company) {
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id, role, companies(id, name)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (membership?.companies) {
      company = membership.companies as unknown as { id: string; name: string }
    }
  }

  if (!company) redirect("/create-company")

  // Fetch all team members with profile data (service role bypasses RLS)
  const serviceClient = createServiceRoleSupabaseClient()
  const { data: members } = await serviceClient
    .from("company_members")
    .select(`
      id,
      company_id,
      user_id,
      email,
      role,
      status,
      invited_at,
      invited_by,
      joined_at,
      profiles:user_id(first_name, last_name, avatar_url)
    `)
    .eq("company_id", company.id)
    .order("created_at", { ascending: true })

  return (
    <TeamPageClient
      companyId={company.id}
      companyName={company.name}
      members={members ?? []}
      isOwner={isOwner}
      currentUserId={user.id}
    />
  )
}
