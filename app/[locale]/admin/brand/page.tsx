import { fetchBrandData } from "./actions"
import { BrandClient } from "./brand-client"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Brand" }

export const dynamic = "force-dynamic"

export default async function AdminBrandPage() {
  const data = await fetchBrandData()
  return (
    <div className="min-h-screen bg-white">
      <BrandClient data={data} />
    </div>
  )
}
