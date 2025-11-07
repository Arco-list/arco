import type { ListingStatusModalOption } from "@/components/listing-status-modal"
import type { Enums } from "@/lib/supabase/types"

export type ContributorStatus = Extract<
  Enums<"professional_project_status">,
  "invited" | "unlisted" | "listed" | "live_on_page" | "rejected"
>

export const CONTRIBUTOR_STATUS_LABELS: Record<ContributorStatus, string> = {
  invited: "Invited",
  unlisted: "Unpublished",
  listed: "Published",
  live_on_page: "Featured",
  rejected: "Declined",
}

export const CONTRIBUTOR_STATUS_CHIP_CLASS: Record<ContributorStatus, string> = {
  invited: "bg-blue-100 text-blue-800",
  unlisted: "bg-surface text-text-secondary",
  listed: "bg-green-100 text-green-800",
  live_on_page: "bg-teal-100 text-teal-800",
  rejected: "bg-red-100 text-red-800",
}

export const CONTRIBUTOR_STATUS_DOT_CLASS: Record<ContributorStatus, string> = {
  invited: "bg-blue-500",
  unlisted: "bg-muted-foreground",
  listed: "bg-emerald-500",
  live_on_page: "bg-teal-500",
  rejected: "bg-red-500",
}

export const CONTRIBUTOR_STATUS_OPTIONS: ReadonlyArray<
  ListingStatusModalOption<ContributorStatus>
> = [
  {
    value: "unlisted",
    label: "Unpublished",
    description: "Your company is not shown on this project.",
    colorClass: "bg-muted-foreground",
  },
  {
    value: "listed",
    label: "Published",
    description: "Your company is listed on the project page.",
    colorClass: "bg-emerald-500",
  },
  {
    value: "live_on_page",
    label: "Featured",
    description: "Project is showcased in your company portfolio.",
    colorClass: "bg-teal-500",
    requiresPlus: true,
  },
]
