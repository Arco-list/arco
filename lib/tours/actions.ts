"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

/** Server-side "seen" flags for the onboarding tours. One row per
 *  (user, tour_key) in ui_tour_seen, so the flag follows the account
 *  instead of the browser (localStorage replayed the tour on every new
 *  device / incognito session). tour_key embeds the target id plus any
 *  reset fragment — see buildTourKey call sites. */

export async function markTourSeen(tourKey: string): Promise<void> {
  if (!tourKey) return
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("ui_tour_seen")
    .upsert(
      { user_id: user.id, tour_key: tourKey },
      { onConflict: "user_id,tour_key", ignoreDuplicates: true },
    )
}

export async function getTourSeen(tourKey: string): Promise<boolean> {
  if (!tourKey) return false
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("ui_tour_seen")
    .select("tour_key")
    .eq("user_id", user.id)
    .eq("tour_key", tourKey)
    .maybeSingle()
  return Boolean(data)
}
