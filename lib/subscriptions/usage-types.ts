/**
 * Shapes shared by the usage query and the screen that draws it.
 *
 * Kept apart from get-project-usage.ts because that module is
 * "server-only": importing a type from it would drag the service-role
 * Supabase client into the client bundle and break the build.
 */

/** Contributor credits a company may show on the Free plan. */
export const FREE_CONTRIBUTOR_LIMIT = 1

export type ProjectUsage = {
  /** Whether any of the company's services may publish at all. */
  canPublish: boolean
  /** Published projects the company owns. Unlimited on every plan. */
  publishedCount: number
  /** Credits on other people's published projects. */
  contributorTotal: number
  /** Of those, how many are actually visible under the current plan. */
  contributorVisible: number
  /** The rest — held in the dashboard, not shown on the public page. */
  contributorHidden: number
}
