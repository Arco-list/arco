import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { ProfessionalContactSidebar } from "@/components/professional-contact-sidebar"
import { ProfessionalGallery } from "@/components/professional-gallery"
import { ProfessionalInfo } from "@/components/professional-info"
import { ProfessionalProjects } from "@/components/professional-projects"
import { ProfessionalReviews } from "@/components/professional-reviews"
import { fetchProfessionalDetail, fetchProfessionalMetadata } from "@/lib/professionals/queries"

const REVIEWS_ANCHOR_ID = "professional-reviews"
const PLACEHOLDER_IMAGE = "/placeholder.svg?height=800&width=1200"

type PageParams = {
  slug: string
}

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { slug } = await params
  const professional = await fetchProfessionalMetadata(slug)

  if (!professional) {
    return {
      title: "Professional not found · Arco",
    }
  }

  const description =
    professional.description ??
    (professional.location ? `Discover ${professional.name} in ${professional.location}.` : `Discover ${professional.name}.`)

  const image = professional.coverImageUrl ?? PLACEHOLDER_IMAGE

  return {
    title: `${professional.name} · Arco`,
    description,
    openGraph: {
      title: `${professional.name} · Arco`,
      description,
      images: image ? [{ url: image, alt: professional.name }] : undefined,
    },
  }
}

export default async function ProfessionalDetailPage({ params }: { params: Promise<PageParams> }) {
  const { slug } = await params
  const professional = await fetchProfessionalDetail(slug)

  if (!professional) {
    notFound()
  }

  const shareUrl = `/professionals/${professional.slug}`
  const galleryImages = professional.gallery
  const projects = professional.projects
  const reviews = professional.reviews

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 pt-24 sm:px-6 lg:px-8 xl:px-12">
        <div className="mb-8">
          <ProfessionalGallery professionalName={professional.name} images={galleryImages} />
        </div>

        <div className="grid grid-cols-1 items-start gap-8 py-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <ProfessionalInfo professional={professional} shareUrl={shareUrl} reviewsAnchorId={REVIEWS_ANCHOR_ID} />
          </div>

          <div className="lg:col-span-1">
            <ProfessionalContactSidebar professional={professional} />
          </div>
        </div>
      </main>

      <section className="w-full bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
          <ProfessionalProjects projects={projects} />
        </div>
      </section>

      <ProfessionalReviews
        id={REVIEWS_ANCHOR_ID}
        companyId={professional.id}
        professionalName={professional.name}
        ratings={professional.ratings}
        reviews={reviews}
      />

      <Footer />
    </div>
  )
}
