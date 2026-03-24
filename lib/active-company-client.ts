const COOKIE_NAME = "active_company_id"

/**
 * Read the active company ID from document.cookie (client-side).
 */
export function getActiveCompanyIdClient(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}
