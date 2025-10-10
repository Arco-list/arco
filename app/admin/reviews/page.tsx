import Link from "next/link"

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminReviewsTable, type AdminReviewRow } from "@/components/admin-reviews-table"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import type { Database } from "@/lib/supabase/types"

const REVIEW_STATUSES: Database["public"]["Enums"]["review_moderation_status"][] = ["pending", "approved", "rejected"]
const DEFAULT_STATUS: Database["public"]["Enums"]["review_moderation_status"] = "pending"

type ReviewsPageSearchParams = {
  status?: string
}

export const dynamic = "force-dynamic"

type ReviewRecord = {
  id: string
  professional_id: string
  overall_rating: number
  quality_rating: number | null
  reliability_rating: number | null
  communication_rating: number | null
  work_completed: boolean | null
  comment: string | null
  created_at: string | null
  moderation_status: Database["public"]["Enums"]["review_moderation_status"]
  moderation_notes: string | null
  moderated_at: string | null
  reviewer: {
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
  professional: {
    id: string
    title: string | null
    company: {
      name: string | null
    } | null
  } | null
  moderator: {
    first_name: string | null
    last_name: string | null
  } | null
}

const toDisplayName = (first: string | null, last: string | null, fallback: string) => {
  const name = [first, last].filter((value) => typeof value === "string" && value.trim().length > 0).join(" ").trim()
  return name.length > 0 ? name : fallback
}

const loadCounts = async (supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) => {
  const queries = REVIEW_STATUSES.map((status) =>
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("moderation_status", status),
  )

  const results = await Promise.all(queries)

  return results.reduce<Record<string, number>>((acc, result, index) => {
    if (result.error) {
      logger.db("select", "reviews", "Failed to count reviews by status", { status: REVIEW_STATUSES[index] }, result.error)
      acc[REVIEW_STATUSES[index]] = 0
      return acc
    }

    acc[REVIEW_STATUSES[index]] = result.count ?? 0
    return acc
  }, {})
}

const loadReviews = async (status: Database["public"]["Enums"]["review_moderation_status"]) => {
  const supabase = await createServerSupabaseClient()

  const [reviewsResult, counts] = await Promise.all([
    supabase
      .from("reviews")
      .select(
        `
          id,
          professional_id,
          overall_rating,
          quality_rating,
          reliability_rating,
          communication_rating,
          work_completed,
          comment,
          created_at,
          moderation_status,
          moderation_notes,
          moderated_at,
          reviewer:profiles!reviews_reviewer_id_fkey (
            first_name,
            last_name,
            avatar_url
          ),
          professional:professionals (
            id,
            title,
            company:companies (
              name
            )
          ),
          moderator:profiles!reviews_moderated_by_fkey (
            first_name,
            last_name
          )
        `,
      )
      .eq("moderation_status", status)
      .order("created_at", { ascending: false })
      .limit(100),
    loadCounts(supabase),
  ])

  if (reviewsResult.error) {
    logger.db("select", "reviews", "Failed to load admin review queue", { status }, reviewsResult.error)
    return { reviews: [], counts }
  }

  const rows = Array.isArray(reviewsResult.data) ? (reviewsResult.data as ReviewRecord[]) : []

  const reviews: AdminReviewRow[] = rows.map((row) => {
    const companyName = row.professional?.company?.name?.trim()
    const professionalTitle = row.professional?.title?.trim()
    const professionalName = companyName && companyName.length > 0 ? companyName : professionalTitle ?? "Professional"

    const reviewerName = toDisplayName(row.reviewer?.first_name ?? null, row.reviewer?.last_name ?? null, "Verified homeowner")
    const moderatorName =
      row.moderator && (row.moderator.first_name || row.moderator.last_name)
        ? toDisplayName(row.moderator.first_name ?? null, row.moderator.last_name ?? null, "Moderator")
        : null

    return {
      id: row.id,
      professionalId: row.professional_id,
      professionalName,
      reviewerName,
      submittedAt: row.created_at,
      overallRating: row.overall_rating,
      qualityRating: row.quality_rating,
      reliabilityRating: row.reliability_rating,
      communicationRating: row.communication_rating,
      workCompleted: row.work_completed,
      comment: row.comment,
      moderationStatus: row.moderation_status,
      moderationNotes: row.moderation_notes,
      moderatedAt: row.moderated_at,
      moderatorName,
    }
  })

  return { reviews, counts }
}

const resolveStatus = (raw?: string): Database["public"]["Enums"]["review_moderation_status"] => {
  if (!raw || typeof raw !== "string") {
    return DEFAULT_STATUS
  }

  return REVIEW_STATUSES.includes(raw as Database["public"]["Enums"]["review_moderation_status"])
    ? (raw as Database["public"]["Enums"]["review_moderation_status"])
    : DEFAULT_STATUS
}

type AdminReviewsPageProps = {
  searchParams?: ReviewsPageSearchParams
}

export default async function AdminReviewsPage({ searchParams }: AdminReviewsPageProps) {
  const status = resolveStatus(searchParams?.status)
  const { reviews, counts } = await loadReviews(status)

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-6" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Reviews</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="space-y-6 p-4 pt-0">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
              <p className="text-sm text-muted-foreground">
                Review homeowner feedback before it goes live on professional profiles.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {REVIEW_STATUSES.map((entry) => {
                const isActive = entry === status
                const count = counts?.[entry] ?? 0
                const href = entry === DEFAULT_STATUS ? "/admin/reviews" : `/admin/reviews?status=${entry}`

                return (
                  <Button key={entry} asChild variant={isActive ? "default" : "outline"} size="sm">
                    <Link href={href} className="flex items-center gap-1">
                      <span className="capitalize">{entry}</span>
                      <span className="rounded-full bg-background/40 px-2 py-0.5 text-xs font-medium">{count}</span>
                    </Link>
                  </Button>
                )
              })}
            </div>
          </div>

          <AdminReviewsTable reviews={reviews} status={status} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
