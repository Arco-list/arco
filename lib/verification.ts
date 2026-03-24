import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

const CODE_TTL_SECONDS = 600 // 10 minutes

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function storeVerificationCode(
  userId: string,
  domain: string,
  code: string,
): Promise<boolean> {
  const supabase = createServiceRoleSupabaseClient()
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString()

  const { error } = await supabase
    .from("domain_verification_codes")
    .upsert(
      { user_id: userId, domain: domain.toLowerCase(), code, expires_at: expiresAt },
      { onConflict: "user_id,domain" },
    )

  if (error) {
    console.error("Failed to store verification code:", error.message)
    return false
  }

  return true
}

export async function validateVerificationCode(
  userId: string,
  domain: string,
  code: string,
): Promise<boolean> {
  const supabase = createServiceRoleSupabaseClient()

  const { data, error } = await supabase
    .from("domain_verification_codes")
    .select("code, expires_at")
    .eq("user_id", userId)
    .eq("domain", domain.toLowerCase())
    .maybeSingle()

  if (error || !data) return false

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    // Expired — clean up
    await supabase
      .from("domain_verification_codes")
      .delete()
      .eq("user_id", userId)
      .eq("domain", domain.toLowerCase())
    return false
  }

  if (data.code.trim() === code.trim()) {
    // Valid — delete the used code
    await supabase
      .from("domain_verification_codes")
      .delete()
      .eq("user_id", userId)
      .eq("domain", domain.toLowerCase())
    return true
  }

  return false
}
