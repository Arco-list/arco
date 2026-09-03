import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * Pre-account domain verification for the platform claim funnel.
 * Mirror of lib/verification.ts, but keyed on (email, domain) instead
 * of a user id — the flipped platform flow proves the mailbox BEFORE
 * any account exists, so there is no auth.users row to hang it on.
 */

const CODE_TTL_SECONDS = 600 // 10 minutes

export async function storeClaimEmailCode(
  email: string,
  domain: string,
  code: string,
): Promise<boolean> {
  const svc = createServiceRoleSupabaseClient()
  const { error } = await svc
    .from("claim_email_verification_codes" as never)
    .upsert(
      {
        email: email.toLowerCase(),
        domain: domain.toLowerCase(),
        code,
        expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
      } as never,
      { onConflict: "email,domain" },
    )
  if (error) {
    console.error("Failed to store claim email code:", error.message)
    return false
  }
  return true
}

export async function validateClaimEmailCode(
  email: string,
  domain: string,
  code: string,
): Promise<boolean> {
  const svc = createServiceRoleSupabaseClient()
  const { data } = await svc
    .from("claim_email_verification_codes" as never)
    .select("code, expires_at")
    .eq("email", email.toLowerCase())
    .eq("domain", domain.toLowerCase())
    .maybeSingle()
  if (!data) return false
  const row = data as { code: string; expires_at: string }

  const cleanup = () =>
    svc
      .from("claim_email_verification_codes" as never)
      .delete()
      .eq("email", email.toLowerCase())
      .eq("domain", domain.toLowerCase())

  if (new Date(row.expires_at) < new Date()) {
    await cleanup()
    return false
  }
  if (row.code.trim() !== code.trim()) return false
  // One-shot: a validated code is spent.
  await cleanup()
  return true
}
