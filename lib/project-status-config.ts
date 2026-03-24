import type { ListingStatusModalOption } from "@/components/listing-status-modal"
import type { Enums } from "@/lib/supabase/types"

export type ProjectStatus = Enums<"project_status">

export const LISTING_STATUS_VALUES = ["published", "archived"] as const
export type ListingStatusValue = (typeof LISTING_STATUS_VALUES)[number]

export const ACTIVE_STATUS_VALUES: ReadonlyArray<ListingStatusValue> = ["published"]
export const BASIC_ACTIVE_LIMIT = 3

export const isListingStatusValue = (status: ProjectStatus | string): status is ListingStatusValue =>
  LISTING_STATUS_VALUES.includes(status as ListingStatusValue)

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "In progress",
  in_progress: "In review",
  published: "Listed",
  archived: "Unlisted",
  rejected: "Rejected",
}

export const PROJECT_STATUS_CHIP_CLASS: Record<ProjectStatus, string> = {
  draft: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-surface text-text-secondary",
  rejected: "bg-red-100 text-red-800",
}

export const PROJECT_STATUS_DOT_CLASS: Record<ProjectStatus, string> = {
  draft: "bg-amber-500",
  in_progress: "bg-blue-500",
  published: "bg-emerald-500",
  archived: "bg-muted-foreground",
  rejected: "bg-red-500",
}

export const LISTING_STATUS_OPTIONS: ReadonlyArray<ListingStatusModalOption<ListingStatusValue>> = [
  {
    value: "archived",
    label: "Unlisted",
    description: "Project is not visible to users.",
    colorClass: "bg-muted-foreground",
  },
  {
    value: "published",
    label: "Listed",
    description: "Project is visible to users and you are displayed on the project page.",
    colorClass: "bg-emerald-500",
  },
]
