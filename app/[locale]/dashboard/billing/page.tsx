import { loadBillingPageProps } from "@/lib/subscriptions/billing-page-props"
import { SubscriptionScreen } from "@/components/subscription-screen"

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string; preview?: string }>
  params?: Promise<{ locale: string }>
}) {
  const { company_id: companyIdParam, preview } = await searchParams
  const props = await loadBillingPageProps({
    companyIdParam,
    preview,
    path: "/dashboard/billing",
  })

  return <SubscriptionScreen {...props} />
}
