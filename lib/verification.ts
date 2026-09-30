import { randomInt } from "node:crypto"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * An hour — the same as every other emailed code on the platform.
 *
 * It was ten minutes, and stayed there while nothing counted wrong
 * guesses: the lifetime was the only bound on brute-forcing six
 * digits. MAX_ATTEMPTS below is what changed that, and it changes the
 * question too. Five guesses out of 900,000 is negligible whether the
 * code lives ten minutes or an hour, so the clock stops being a
 * security control and becomes what it should have been all along — a
 * courtesy to whoever has to go and find the mail.
 */
const CODE_TTL_SECONDS = 3600 // 1 hour

/**
 * Wrong guesses a single code tolerates before it is destroyed.
 *
 * The attack this closes: the row is keyed on (user_id, domain), so
 * anyone with an account can ask for a code on a domain they do not
 * own — it is mailed to a mailbox they cannot read, while the row sits
 * under THEIR id, free to be guessed at. Sending was capped at three
 * per fifteen minutes; guessing was not capped at all.
 */
const MAX_ATTEMPTS = 5

/**
 * Six digits from the system CSPRNG.
 *
 * Math.random() is seeded pseudo-randomness meant for shuffling
 * things, not for a credential: its output is reproducible from
 * internal state, and V8 makes no promise that observing values tells
 * you nothing about the next. randomInt is the same one line and
 * carries no such doubt. Both callers — this file and the claim
 * funnel's — mint codes that grant access to something.
 */
export function generateVerificationCode(): string {
  return randomInt(100000, 1000000).toString()
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
    .select("code, expires_at, attempts")
    .eq("user_id", userId)
    .eq("domain", domain.toLowerCase())
    .maybeSingle()

  if (error || !data) return false

  const cleanup = () =>
    supabase
      .from("domain_verification_codes")
      .delete()
      .eq("user_id", userId)
      .eq("domain", domain.toLowerCase())

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    await cleanup()
    return false
  }

  if (data.code.trim() === code.trim()) {
    // Valid — delete the used code
    await cleanup()
    return true
  }

  // Burn the code once the misses run out. Destroyed rather than
  // locked: a locked row invites grinding at the next one while this
  // one is still alive.
  const attempts = ((data as { attempts?: number | null }).attempts ?? 0) + 1
  if (attempts >= MAX_ATTEMPTS) {
    await cleanup()
  } else {
    await supabase
      .from("domain_verification_codes")
      .update({ attempts } as never)
      .eq("user_id", userId)
      .eq("domain", domain.toLowerCase())
  }

  return false
}
