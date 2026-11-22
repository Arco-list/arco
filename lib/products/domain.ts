/**
 * De kale domeinvorm van een merk ("tribu.com"): zonder protocol, www,
 * pad, poort of slash, in kleine letters — wat je ook plakt. Dezelfde
 * vorm als de domeinkolom van de bedrijventabel.
 */
export function normalizeDomain(input: string | null | undefined): string {
  if (!input) return ""
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "")
}

/** Een geldig domein: labels met letters, cijfers en streepjes, en een extensie. */
export const isValidDomain = (d: string): boolean => /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)
