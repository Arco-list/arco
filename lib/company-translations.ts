/**
 * Get a locale-aware company field (description) from translations JSONB.
 * Falls back to the main column value if no translation exists.
 */
export function getCompanyTranslation(
  company: { description?: string | null; translations?: Record<string, any> | null },
  field: "description",
  locale: string = "en"
): string {
  const translations = company.translations
  const localeValue = translations?.[locale]?.[field]
  if (localeValue && typeof localeValue === "string" && localeValue.trim()) {
    return localeValue
  }
  return (company[field] ?? "") as string
}
