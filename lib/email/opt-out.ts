import "server-only"

/**
 * May we send this person automated mail?
 *
 * Four independent ways to say no, in one answer:
 *
 *   1. the profile's notification_preferences.marketing is explicitly
 *      false (dashboard Marketing toggle; default ON when null)
 *   2. any prospects row for this address has unsubscribed_at set
 *      (List-Unsubscribe one-click for cold leads)
 *   3. any prospects row has bounced_at or complained_at — set by the
 *      Resend webhook; retrying a dead address hurts sender reputation
 *   4. any prospects row has not_interested_at — the polite decline.
 *      Soft, reversible, and it blocks automated sends all the same.
 *
 * The unsubscribe endpoint mirrors writes between (1) and (2) so either
 * path's "off" sticks.
 *
 * FAILS OPEN, deliberately. A transient Supabase blip returning "opted
 * out" would silently kill legitimate mail flow, and the damage from
 * one extra send is far smaller than from a day of silence.
 *
 * Lives here rather than inside email-service because it is now asked
 * at two moments. Sending still checks it — state changes between
 * scheduling and sending, and the later check is the one that protects
 * the recipient. Scheduling checks it so we don't enrol someone who has
 * already said no, and so the admin who clicked is told now rather than
 * finding a silently skipped row days later. Two questions, two
 * moments, ONE rule — a second copy of this list is how an address ends
 * up suppressed on one path and mailed on the other.
 */
export async function isOptedOutOfMarketing(
  email: string,
  userId: string | null,
): Promise<boolean> {
  try {
    const { createServiceRoleSupabaseClient } = await import("@/lib/supabase/server")
    const supabase = createServiceRoleSupabaseClient()

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", userId)
        .maybeSingle()
      const prefs = (profile as { notification_preferences?: { marketing?: boolean } | null } | null)
        ?.notification_preferences ?? null
      if (prefs && prefs.marketing === false) return true
    }

    // Single roundtrip — any prospect row for this email with any of
    // the suppression timestamps set means we don't send.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prospect } = await (supabase as any)
      .from("prospects")
      .select("id, unsubscribed_at, bounced_at, complained_at, not_interested_at")
      .ilike("email", email)
      .or("unsubscribed_at.not.is.null,bounced_at.not.is.null,complained_at.not.is.null,not_interested_at.not.is.null")
      .limit(1)
    if (Array.isArray(prospect) && prospect.length > 0) return true

    return false
  } catch (err) {
    console.error("isOptedOutOfMarketing failed; defaulting to not-opted-out", err)
    return false
  }
}
