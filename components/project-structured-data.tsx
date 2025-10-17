import type { ProjectPreviewData } from "@/contexts/project-preview-context"

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
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `https://arco.com/projects/${project.slug}`,
    "name": project.title,
    "description": project.description ? 
      project.description.replace(/<[^>]*>/g, '').substring(0, 200) : 
      `Architectural project: ${project.title}`,
    "url": `https://arco.com/projects/${project.slug}`,
    "image": coverPhotoUrl ? [coverPhotoUrl] : undefined,
    "dateCreated": project.createdAt,
    "genre": "Architecture",
    "inLanguage": "en",
    "publisher": {
      "@type": "Organization",
      "name": "Arco",
      "url": "https://arco.com"
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
      "@id": `https://arco.com/projects/${project.slug}`
    },
    "isPartOf": {
      "@type": "WebSite",
      "name": "Arco",
      "url": "https://arco.com"
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