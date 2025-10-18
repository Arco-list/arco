import type { ProjectPreviewData } from "@/contexts/project-preview-context"
import { getSiteUrl } from "@/lib/utils"

interface ProjectStructuredDataProps {
  project: {
    id: string
    title: string
    description?: string | null
    slug?: string | null
    createdAt?: string | null
    location?: {
      city?: string | null
      region?: string | null
      summary?: string | null
    }
  }
  coverPhotoUrl?: string | null
  professionals?: Array<{
    name: string
    badge: string
  }>
}

export function ProjectStructuredData({ project, coverPhotoUrl, professionals }: ProjectStructuredDataProps) {
  const baseUrl = getSiteUrl()
  const projectUrl = `${baseUrl}/projects/${project.slug}`
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": projectUrl,
    "name": project.title,
    "description": project.description ? 
      project.description.replace(/<[^>]*>/g, '').substring(0, 200) : 
      `Architectural project: ${project.title}`,
    "url": projectUrl,
    "image": coverPhotoUrl ? [coverPhotoUrl] : undefined,
    "dateCreated": project.createdAt,
    "genre": "Architecture",
    "inLanguage": "en",
    "publisher": {
      "@type": "Organization",
      "name": "Arco",
      "url": baseUrl
    },
    "locationCreated": project.location?.summary ? {
      "@type": "Place",
      "name": project.location.summary,
      "addressLocality": project.location.city,
      "addressRegion": project.location.region
    } : undefined,
    "creator": professionals && professionals.length > 0 ? 
      professionals.map(prof => ({
        "@type": "Person",
        "name": prof.name,
        "jobTitle": prof.badge
      })) : undefined,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": projectUrl
    },
    "isPartOf": {
      "@type": "WebSite",
      "name": "Arco",
      "url": baseUrl
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData, null, 2)
      }}
    />
  )
}