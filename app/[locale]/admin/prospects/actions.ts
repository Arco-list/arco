"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

export type ProspectStatus =
  | "imported"
  | "sequence_active"
  | "email_opened"
  | "email_clicked"
  | "landing_visited"
  | "signed_up"
  | "company_created"
  | "project_started"
  | "project_published"
  | "converted"
  | "unsubscribed"
  | "bounced"

export type Prospect = {
  id: string
  email: string
  contact_name: string | null
  company_name: string | null
  city: string | null
  source: string
  status: ProspectStatus
  ref_code: string
  apollo_contact_id: string | null
  apollo_account_id: string | null
  emails_sent: number
  emails_opened: number
  emails_clicked: number
  linked_user_id: string | null
  linked_company_id: string | null
  linked_project_id: string | null
  first_email_sent_at: string | null
  last_email_sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  landing_visited_at: string | null
  signed_up_at: string | null
  company_created_at: string | null
  project_started_at: string | null
  project_published_at: string | null
  converted_at: string | null
  unsubscribed_at: string | null
  bounced_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ProspectEvent = {
  id: string
  prospect_id: string
  event_type: string
  metadata: Record<string, unknown>
  created_at: string
}

export type ProspectFunnel = {
  total: number
  imported: number
  sequence_active: number
  email_opened: number
  email_clicked: number
  landing_visited: number
  signed_up: number
  company_created: number
  project_started: number
  project_published: number
  converted: number
  unsubscribed: number
  bounced: number
  with_opens: number
  with_clicks: number
  total_emails_sent: number
}

type FetchProspectsFilters = {
  status?: ProspectStatus | "all"
  source?: string
  search?: string
  offset?: number
  limit?: number
}

export async function fetchProspects(filters: FetchProspectsFilters = {}) {
  const supabase = createServiceRoleSupabaseClient()
  const { status, source, search, offset = 0, limit = 50 } = filters

  let query = supabase
    .from("prospects")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && status !== "all") {
    query = query.eq("status", status)
  }

  if (source && source !== "all") {
    query = query.eq("source", source)
  }

  if (search) {
    query = query.or(`email.ilike.%${search}%,company_name.ilike.%${search}%,contact_name.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to fetch prospects", error)
    return { prospects: [] as Prospect[], error: error.message }
  }

  return { prospects: (data ?? []) as Prospect[] }
}

const EMPTY_FUNNEL: ProspectFunnel = {
  total: 0, imported: 0, sequence_active: 0, email_opened: 0,
  email_clicked: 0, landing_visited: 0, signed_up: 0, company_created: 0,
  project_started: 0, project_published: 0, converted: 0,
  unsubscribed: 0, bounced: 0, with_opens: 0, with_clicks: 0,
  total_emails_sent: 0,
}

export async function fetchFunnel() {
  const supabase = createServiceRoleSupabaseClient()

  // get_prospect_funnel returns rows like [{status: 'imported', count: 5}, ...]
  const { data: funnelRows, error: funnelError } = await supabase.rpc("get_prospect_funnel")

  // Also get aggregate email stats
  const { data: statsData, error: statsError } = await supabase
    .from("prospects")
    .select("emails_sent, emails_opened, emails_clicked")

  if (funnelError) {
    console.error("Failed to fetch funnel", funnelError)
    return { funnel: EMPTY_FUNNEL }
  }

  const funnel: ProspectFunnel = { ...EMPTY_FUNNEL }

  // Map RPC rows to funnel object
  const rows = (funnelRows as Array<{ status: string; count: number }>) ?? []
  for (const row of rows) {
    const key = row.status as keyof ProspectFunnel
    if (key in funnel) {
      (funnel as any)[key] = Number(row.count) || 0
    }
    funnel.total += Number(row.count) || 0
  }

  // Calculate email aggregate stats
  const prospects = (statsData as Array<{ emails_sent: number; emails_opened: number; emails_clicked: number }>) ?? []
  for (const p of prospects) {
    funnel.total_emails_sent += p.emails_sent || 0
    if (p.emails_opened > 0) funnel.with_opens++
    if (p.emails_clicked > 0) funnel.with_clicks++
  }

  return { funnel }
}

export async function addProspect(formData: {
  email: string
  contact_name?: string
  company_name?: string
  city?: string
  source?: string
}) {
  const supabase = createServiceRoleSupabaseClient()

  const { data, error } = await supabase
    .from("prospects")
    .insert({
      email: formData.email,
      contact_name: formData.contact_name || null,
      company_name: formData.company_name || null,
      city: formData.city || null,
      source: formData.source || "manual",
      status: "imported",
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to add prospect", error)
    return { success: false, error: error.message }
  }

  // Log event
  await supabase.from("prospect_events").insert({
    prospect_id: data.id,
    event_type: "created",
    metadata: { source: formData.source || "manual" },
  })

  return { success: true, prospect: data as Prospect }
}

export async function updateProspectStatus(id: string, newStatus: ProspectStatus) {
  const supabase = createServiceRoleSupabaseClient()

  const timestampField = {
    signed_up: "signed_up_at",
    company_created: "company_created_at",
    project_started: "project_started_at",
    project_published: "project_published_at",
    converted: "converted_at",
    unsubscribed: "unsubscribed_at",
    bounced: "bounced_at",
    email_opened: "opened_at",
    email_clicked: "clicked_at",
    landing_visited: "landing_visited_at",
  } as Record<string, string>

  const updateData: Record<string, unknown> = { status: newStatus }
  const tsField = timestampField[newStatus]
  if (tsField) {
    updateData[tsField] = new Date().toISOString()
  }

  const { error } = await supabase
    .from("prospects")
    .update(updateData)
    .eq("id", id)

  if (error) {
    console.error("Failed to update prospect status", error)
    return { success: false, error: error.message }
  }

  // Log event
  await supabase.from("prospect_events").insert({
    prospect_id: id,
    event_type: "status_changed",
    metadata: { new_status: newStatus },
  })

  return { success: true }
}

export async function fetchProspectEvents(prospectId: string) {
  const supabase = createServiceRoleSupabaseClient()

  const { data, error } = await supabase
    .from("prospect_events")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch prospect events", error)
    return { events: [] as ProspectEvent[], error: error.message }
  }

  return { events: (data ?? []) as ProspectEvent[] }
}

export async function deleteProspect(id: string) {
  const supabase = createServiceRoleSupabaseClient()

  const { error } = await supabase
    .from("prospects")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Failed to delete prospect", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
