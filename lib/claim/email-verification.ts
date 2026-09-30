import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * Pre-account domain verification for the platform claim funnel.
 * Mirror of lib/verification.ts, but keyed on (email, domain) instead
 * of a user id — the flipped platform flow proves the mailbox BEFORE
 * any account exists, so there is no auth.users row to hang it on.
 */

/**
 * An hour, matching the sign-in and recovery codes.
 *
 * It was ten minutes, and could not be raised while nothing counted
 * wrong guesses — the lifetime was the only thing bounding a brute
 * force against six digits. MAX_ATTEMPTS is what pays for the longer
 * window: a code now dies after a handful of misses, which is a far
 * tighter bound than any clock, and lets the honest reader who opened
 * their mail twenty minutes late still use it.
 *
 * The number is also a promise printed in the mail
 * (renderDomainVerification in lib/email-service.ts) — change one and
 * the other is a lie.
 */
const CODE_TTL_SECONDS = 3600 // 1 hour

/**
 * Wrong guesses a single code tolerates before it is destroyed.
 *
 * Five is enough for fat fingers and a misread digit, and turns
 * 900,000 possibilities into 900,000 / 5 codes an attacker must first
 * cause to be SENT — and sending is already capped at three per
 * fifteen minutes per mailbox.
 */
const MAX_ATTEMPTS = 5

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
    .select("code, expires_at, attempts")
    .eq("email", email.toLowerCase())
    .eq("domain", domain.toLowerCase())
    .maybeSingle()
  if (!data) return false
  const row = data as { code: string; expires_at: string; attempts: number | null }

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

  if (row.code.trim() !== code.trim()) {
    // Burn the code once the misses run out. Counted BEFORE the
    // comparison decides anything, so a guess costs the attacker a try
    // whatever it was — and the row is destroyed rather than locked,
    // because a locked row invites grinding at the next one while this
    // one is still alive.
    const attempts = (row.attempts ?? 0) + 1
    if (attempts >= MAX_ATTEMPTS) {
      await cleanup()
    } else {
      await svc
        .from("claim_email_verification_codes" as never)
        .update({ attempts } as never)
        .eq("email", email.toLowerCase())
        .eq("domain", domain.toLowerCase())
    }
    return false
  }

  // One-shot: a validated code is spent.
  await cleanup()
  return true
}
