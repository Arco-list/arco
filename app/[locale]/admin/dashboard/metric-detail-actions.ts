"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

export type TimeSeriesPoint = { date: string; value: number }

export type MetricDetailData = {
  timeSeries: TimeSeriesPoint[]
  total: number
}

type Timeframe = "days" | "weeks" | "months" | "years"

function getFrom(tf: Timeframe): Date {
  const now = new Date()
  switch (tf) {
    case "days": return new Date(now.getTime() - 8 * 86400000)
    case "weeks": return new Date(now.getTime() - 8 * 7 * 86400000)
    case "months": return new Date(now.getFullYear(), now.getMonth() - 8, now.getDate())
    case "years": return new Date(now.getFullYear() - 8, now.getMonth(), now.getDate())
  }
}

function bucket6(dates: Date[], from: Date): TimeSeriesPoint[] {
  const now = new Date()
  const totalMs = now.getTime() - from.getTime()
  const bucketMs = totalMs / 6
  const result: TimeSeriesPoint[] = []

  for (let i = 0; i < 6; i++) {
    const start = new Date(from.getTime() + i * bucketMs)
    const end = new Date(from.getTime() + (i + 1) * bucketMs)
    const count = dates.filter((d) => d >= start && d < end).length
    result.push({
      date: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: count,
    })
  }

  return result
}

export async function fetchMetricTimeSeries(
  metricKey: string,
  timeframe: Timeframe
): Promise<MetricDetailData> {
  const supabase = createServiceRoleSupabaseClient()
  const from = getFrom(timeframe)

  const query = async (table: string, select: string, filter?: (row: any) => boolean) => {
    const { data } = await supabase.from(table).select(select)
    const dates = (data ?? []).filter(filter ?? (() => true)).map((r: any) => new Date(r.created_at))
    const filtered = dates.filter((d: Date) => d >= from)
    return { timeSeries: bucket6(filtered, from), total: filtered.length }
  }

  switch (metricKey) {
    case "client_signups":
      return query("profiles", "created_at, user_types", (p) => p.user_types?.includes("client") && !p.user_types?.includes("professional"))
    case "drafts":
      return query("companies", "created_at, status", (c) => c.status === "draft")
    case "actives":
      return query("companies", "created_at, status", (c) => c.status === "listed")
    case "publishers":
      return query("projects", "created_at, status", (p) => p.status === "published")
    case "inviters":
      return query("project_professionals", "created_at")
    case "savers":
      return query("saved_projects", "created_at")
    case "subscribers":
      return query("companies", "created_at, plan_tier", (c) => c.plan_tier != null)
    default:
      return { timeSeries: [], total: 0 }
  }
}
