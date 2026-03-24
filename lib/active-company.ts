import { cookies } from "next/headers"

const COOKIE_NAME = "active_company_id"
const MAX_AGE = 60 * 60 * 24 * 365 // 1 year

/**
 * Read the active company ID from cookies (server-side).
 */
export async function getActiveCompanyId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
}

/**
 * Set the active company ID cookie (server-side).
 * Not httpOnly so client-side JS can also read it.
 */
export async function setActiveCompanyId(companyId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, companyId, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  })
}
