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
