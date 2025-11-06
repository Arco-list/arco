import { Suspense } from "react"
import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProfessionalsFilterBar } from "@/components/professionals-filter-bar"
import { ProfessionalsGrid } from "@/components/professionals-grid"
import { ProfessionalFilterProvider } from "@/contexts/professional-filter-context"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"

export const metadata: Metadata = {
  title: "Browse Professionals",
  description: "Discover verified architecture, interior design, and construction professionals in the Netherlands. Filter by specialty, location, and ratings.",
}

function ProfessionalsPageContent() {
  return (
    <FilterErrorBoundary>
      <ProfessionalFilterProvider>
        <div className="min-h-screen flex flex-col pt-[60px] md:pt-[68px]">
          <Header />
          <ProfessionalsFilterBar />
          <main className="flex-1 bg-white">
            <ProfessionalsGrid />
          </main>
          <Footer />
        </div>
      </ProfessionalFilterProvider>
    </FilterErrorBoundary>
  )
}

export default function ProfessionalsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ProfessionalsPageContent />
    </Suspense>
  )
}
