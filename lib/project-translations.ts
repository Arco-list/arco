/**
 * Get a locale-aware project field (title or description) from translations JSONB.
 * Falls back to the main column value if no translation exists.
 */
export function getProjectTranslation(
  project: { title?: string | null; description?: string | null; translations?: Record<string, any> | null },
  field: "title" | "description",
  locale: string = "en"
): string {
  const translations = project.translations
  const localeValue = translations?.[locale]?.[field]
  if (localeValue && typeof localeValue === "string" && localeValue.trim()) {
    return localeValue
  }
  // Fallback to main column
  return (project[field] ?? "") as string
}
