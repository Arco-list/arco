interface PageTitleProps {
  title: string
  description?: string
}

export function PageTitle({ title, description }: PageTitleProps) {
  return (
    <div className="page-title-section">
      <h1 className="arco-page-title">{title}</h1>
      {description && (
        <p className="arco-body-text page-description">{description}</p>
      )}
    </div>
  )
}
