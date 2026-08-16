import { Link } from "@/i18n/navigation"
import { getTranslations } from "next-intl/server"
import { ReadMoreBody } from "@/components/project/read-more-body"

interface ProjectHeaderProps {
  title: string
  architectName: string | null
  architectSlug: string | null
  description: string | null
  /** Expanded editorial body (translations.<locale>.seo_body) rendered
   *  behind a "Read more" toggle below the intro description. */
  seoBody?: string | null
}

export async function ProjectHeader({ title, architectName, architectSlug, description, seoBody }: ProjectHeaderProps) {
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

      {(() => {
        // Split on blank lines BEFORE stripping tags — stripHtml collapses
        // all whitespace, which would merge the paragraphs into one.
        const bodyParagraphs = (seoBody ?? "")
          .split(/\n\n+/)
          .map((p) => p.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim())
          .filter((p) => p.length > 0)
        if (bodyParagraphs.length === 0) return null
        return (
          <ReadMoreBody
            paragraphs={bodyParagraphs}
            moreLabel={t("read_more")}
            lessLabel={t("read_less")}
          />
        )
      })()}
    </section>
  )
}
