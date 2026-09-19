import type { ListingStatusModalOption } from "@/components/listing-status-modal"
import type { Enums } from "@/lib/supabase/types"

export type ContributorStatus = Extract<
  Enums<"professional_project_status">,
  "invited" | "unlisted" | "listed" | "live_on_page" | "rejected"
>

export const CONTRIBUTOR_STATUS_LABELS: Record<ContributorStatus, string> = {
  invited: "Invited",
  unlisted: "Unlisted",
  listed: "Not on your page",
  live_on_page: "On your page",
  rejected: "Declined",
}

export const CONTRIBUTOR_STATUS_CHIP_CLASS: Record<ContributorStatus, string> = {
  invited: "bg-blue-100 text-blue-800",
  unlisted: "bg-surface text-text-secondary",
  listed: "bg-surface text-text-secondary",
  live_on_page: "bg-teal-100 text-teal-800",
  rejected: "bg-red-100 text-red-800",
}

export const CONTRIBUTOR_STATUS_DOT_CLASS: Record<ContributorStatus, string> = {
  invited: "bg-blue-500",
  unlisted: "bg-muted-foreground",
  listed: "bg-muted-foreground",
  live_on_page: "bg-teal-500",
  rejected: "bg-red-500",
}

export type StatusTranslator = (key: string) => string

export const buildContributorStatusOptions = (
  t: StatusTranslator,
): ReadonlyArray<ListingStatusModalOption<ContributorStatus>> => [
  {
    value: "live_on_page",
    label: t("featured.label"),
    description: t("featured.description_contributor"),
    colorClass: CONTRIBUTOR_STATUS_DOT_CLASS.live_on_page,
  },
  {
    value: "listed",
    label: t("listed.label"),
    description: t("listed.description_contributor"),
    colorClass: CONTRIBUTOR_STATUS_DOT_CLASS.listed,
  },
]

export const buildOwnerStatusOptions = (
  t: StatusTranslator,
): ReadonlyArray<ListingStatusModalOption<ContributorStatus>> => [
  {
    value: "live_on_page",
    label: t("featured.label"),
    description: t("featured.description_owner"),
    colorClass: CONTRIBUTOR_STATUS_DOT_CLASS.live_on_page,
  },
  {
    value: "listed",
    label: t("listed.label"),
    description: t("listed.description_owner"),
    colorClass: CONTRIBUTOR_STATUS_DOT_CLASS.listed,
  },
]
