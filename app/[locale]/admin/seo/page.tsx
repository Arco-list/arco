import { fetchSeoOverview } from "./actions"
import { SeoClient } from "./seo-client"

export const dynamic = "force-dynamic"

export default async function AdminSeoPage() {
  const data = await fetchSeoOverview()
  return (
    <div className="min-h-screen bg-white">
      <SeoClient initialData={data} />
    </div>
  )
}
