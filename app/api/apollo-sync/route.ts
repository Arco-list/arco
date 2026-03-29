import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { syncApolloList, syncApolloActivity } from "@/lib/apollo-sync"

export async function POST(request: NextRequest) {
  // Auth check — admin only
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check admin role from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .single()

  if (!profile || !isAdminUser(profile.user_types, profile.admin_role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action as string

  if (action === "sync_list") {
    const listId = body.list_id as string
    if (!listId) {
      return NextResponse.json({ error: "list_id is required" }, { status: 400 })
    }
    const result = await syncApolloList(listId)
    return NextResponse.json(result)
  }

  if (action === "sync_activity") {
    const result = await syncApolloActivity()
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: "Unknown action. Use 'sync_list' or 'sync_activity'" }, { status: 400 })
}
