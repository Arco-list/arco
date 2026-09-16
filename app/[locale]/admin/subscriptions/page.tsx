import { loadBillingPageProps } from "@/lib/subscriptions/billing-page-props"
import { SubscriptionScreen } from "@/components/subscription-screen"

/**
 * The subscription screen, mounted inside admin.
 *
 * Not a copy and not a summary: the same component the company sees,
 * fed by the same loader, wearing the admin header. A dashboard that
 * shows its own rendering of the truth is a dashboard that drifts from
 * it — here the preview tabs walk through every state the real page can
 * be in, and what an admin signs off on is what ships.
 */
export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string; preview?: string }>
}) {
  const { company_id: companyIdParam, preview } = await searchParams
  const props = await loadBillingPageProps({
    companyIdParam,
    preview,
    path: "/admin/subscriptions",
    // An admin without a company of their own still gets the screen,
    // filled with the same fixtures the state switcher uses.
    previewWithoutCompany: true,
  })

  return <SubscriptionScreen {...props} chrome="admin" />
}
