"use server"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"

/**
 * The two counts the admin nav badges: unread inbound email, and
 * projects waiting to be reviewed.
 *
 * The admin layout reads these server-side and hands them to the header
 * as nav badges — but only on /admin pages. Everywhere else an admin
 * still carries the admin menu inside the account dropdown, and it had
 * no counts on it: exactly where one is worth something, since you are
 * somewhere else and want to know whether anything needs you.
 *
 * Read through the service-role client, so the admin check here is not
 * decoration: without it this would hand anyone the size of the queue.
 */
export async function fetchAdminNavCounts(): Promise<{ inbox: number; projects: number }> {
  const empty = { inbox: 0, projects: 0 }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return empty

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()

  if (!isAdminUser(profile?.user_types, profile?.admin_role)) return empty

  const service = createServiceRoleSupabaseClient()
  const [inbox, projects] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).from("inbound_emails").select("id", { count: "exact", head: true }).eq("status", "unread"),
    service.from("projects").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
  ])

  return { inbox: inbox.count ?? 0, projects: projects.count ?? 0 }
}
