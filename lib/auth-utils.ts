import type { Session, User } from "@supabase/supabase-js"

export const buildSession = (rawSession: Session | null, verifiedUser: User | null): Session | null => {
  if (!rawSession || !verifiedUser) {
    return null
  }

  const {
    access_token,
    refresh_token,
    expires_in,
    expires_at,
    token_type,
    provider_token,
    provider_refresh_token,
    type,
  } = rawSession

  return {
    access_token,
    refresh_token,
    expires_in,
    expires_at,
    token_type,
    provider_token,
    provider_refresh_token,
    type,
    user: verifiedUser,
  }
}

const normalizeUserTypes = (userTypes?: string[] | null) =>
  Array.isArray(userTypes)
    ? Array.from(
        new Set(
          userTypes
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean),
        ),
      )
    : []

export const isAdminUser = (userTypes?: string[] | null, adminRole?: string | null): boolean => {
  const normalizedTypes = normalizeUserTypes(userTypes)
  return normalizedTypes.includes("admin") || adminRole === "admin" || adminRole === "super_admin"
}

export const isSuperAdminUser = (adminRole?: string | null): boolean => adminRole === "super_admin"

export const ensureAdminUserTypes = (userTypes?: string[] | null): string[] => {
  const normalizedTypes = normalizeUserTypes(userTypes)
  if (!normalizedTypes.includes("admin")) {
    normalizedTypes.push("admin")
  }
  return normalizedTypes
}
