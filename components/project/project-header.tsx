import Link from "next/link"
import { getTranslations } from "next-intl/server"

interface ProjectHeaderProps {
  title: string
  architectName: string | null
  architectSlug: string | null
  description: string | null
}

export async function ProjectHeader({ title, architectName, architectSlug, description }: ProjectHeaderProps) {
  const t = await getTranslations("project_detail")
  // Strip HTML tags from description
  const stripHtml = (html: string | null) => {
    if (!html) return null
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const cleanDescription = stripHtml(description)
  
  // Split into paragraphs (assuming double line breaks or <p> tags in original)
  const paragraphs = cleanDescription
    ? cleanDescription.split(/\n\n+/).filter(p => p.trim().length > 0)
    : []

  return (
    <section className="project-header">
      <h1 className="arco-page-title">{title}</h1>
      
      {architectName && (
        <p className="architect-attribution">
          {t("by_architect")}{' '}
          {architectSlug ? (
            <Link href={`/professionals/${architectSlug}`}>{architectName}</Link>
          ) : (
            <span>{architectName}</span>
          )}
        </p>
      )}

      {paragraphs.map((paragraph, index) => (
        <p key={index} className="arco-body-text">
          {paragraph}
        </p>
      ))}
    </section>
  )
}
