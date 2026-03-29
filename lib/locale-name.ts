/**
 * Returns the localized name from a row that has `name` and `name_nl` columns.
 * Falls back to `name` (English) if `name_nl` is not set.
 */
export function getLocalizedName(
  row: { name: string | null; name_nl?: string | null },
  locale: string
): string {
  if (locale === "nl" && row.name_nl) return row.name_nl
  return row.name ?? ""
}
