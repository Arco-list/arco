"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { createBoard, listBoards, listPins, deletePin } from "@/lib/pinterest/client"

/** Guard used by every action here. Throws → server action returns 500. */
async function assertAdmin(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("unauthorized")
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()
  const types = Array.isArray(profile?.user_types) ? profile!.user_types : []
  if (!types.includes("admin")) throw new Error("forbidden")
}

// ── Board id updates ─────────────────────────────────────────────────────
// Admin pastes the Pinterest board id after manually creating the board
// on Pinterest. Empty string clears the mapping (board goes back to
// "not yet mapped" and won't be resolved by the cron).
export async function updateBoardIdAction(
  boardRowId: string,
  boardId: string,
): Promise<{ success: boolean; error?: string }> {
  await assertAdmin()
  const trimmed = boardId.trim()
  const supabase = createServiceRoleSupabaseClient()
  const { error } = await supabase
    .from("pinterest_boards")
    .update({ board_id: trimmed.length > 0 ? trimmed : null })
    .eq("id", boardRowId)
  if (error) return { success: false, error: error.message }
  revalidatePath("/[locale]/admin/pinterest", "page")
  return { success: true }
}

// ── One-shot backfill ────────────────────────────────────────────────────
// Enqueue publish rows for every currently-published project + every one
// of its eligible features. Safe to run repeatedly — the enqueue helper
// dedupes against pending rows, and re-publishing an already-synced pin
// just overwrites its stored id.
export async function enqueueBackfillAction(): Promise<{
  success: boolean
  enqueued: number
  error?: string
}> {
  await assertAdmin()
  const supabase = createServiceRoleSupabaseClient()

  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("id")
    .eq("status", "published")
  if (projErr) return { success: false, enqueued: 0, error: projErr.message }

  const projectIds = (projects ?? []).map((p) => p.id)
  if (projectIds.length === 0) return { success: true, enqueued: 0 }

  let enqueued = 0
  for (const id of projectIds) {
    const { error } = await supabase.rpc("pinterest_enqueue", {
      p_target_type: "project",
      p_target_id: id,
      p_action: "publish",
    })
    if (!error) enqueued++
  }

  // Fan out to features (non-Exterior). Eligibility is "has any photo
  // attached" — either an explicit cover_photo_id OR at least one row
  // in project_photos linked via feature_id. The workflow falls back
  // to first-order photo when no cover is set.
  const { data: features } = await supabase
    .from("project_features")
    .select("id, project_id, space_id, cover_photo_id, spaces(slug)")
    .in("project_id", projectIds)
  const featureIds = (features ?? []).map((f) => f.id)
  const withPhotos = new Set<string>()
  if (featureIds.length > 0) {
    const { data: photos } = await supabase
      .from("project_photos")
      .select("feature_id")
      .in("feature_id", featureIds)
    for (const p of photos ?? []) if (p.feature_id) withPhotos.add(p.feature_id)
  }
  for (const f of features ?? []) {
    if (!projectIds.includes(f.project_id)) continue
    const slug = (f as { spaces?: { slug?: string | null } | null }).spaces?.slug
    if (slug === "exterior") continue
    const hasAnyPhoto = f.cover_photo_id != null || withPhotos.has(f.id)
    if (!hasAnyPhoto) continue
    const { error } = await supabase.rpc("pinterest_enqueue", {
      p_target_type: "feature",
      p_target_id: f.id,
      p_action: "publish",
    })
    if (!error) enqueued++
  }

  revalidatePath("/[locale]/admin/pinterest", "page")
  return { success: true, enqueued }
}

// ── Auto-create boards ───────────────────────────────────────────────────
// Iterates pinterest_boards rows with board_id IS NULL and creates each
// on Pinterest via POST /boards, using the seeded board_name (which
// comes from the underlying space or category). Stamps the returned
// Pinterest board id back on the row. Safe to run repeatedly — rows
// with a board_id already set are skipped.
export async function createMissingBoardsAction(): Promise<{
  success: boolean
  created: number
  adopted: number
  skipped: number
  failures: { name: string; reason: string }[]
  error?: string
}> {
  await assertAdmin()
  const supabase = createServiceRoleSupabaseClient()

  const { data: rows, error } = await supabase
    .from("pinterest_boards")
    .select("id, board_name, spaces(name), categories(name)")
    .is("board_id", null)
    .eq("is_active", true)
    .order("board_name")
  if (error) return { success: false, created: 0, adopted: 0, skipped: 0, failures: [], error: error.message }

  // Fetch every existing board on the account first so we can adopt
  // matches by name and skip a doomed POST for boards that already
  // exist (Pinterest 400 "Try a different name" is the common case
  // when someone had created a few boards manually before running this).
  let existingByName: Map<string, string>
  try {
    const existing = await listBoards()
    existingByName = new Map(existing.map((b) => [b.name.trim().toLowerCase(), b.boardId]))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, created: 0, adopted: 0, skipped: 0, failures: [], error: `List existing boards failed: ${message}` }
  }

  let created = 0
  let adopted = 0
  let skipped = 0
  const failures: { name: string; reason: string }[] = []
  for (const row of rows ?? []) {
    const displayName = row.board_name
      ?? (row as { spaces?: { name?: string | null } | null }).spaces?.name
      ?? (row as { categories?: { name?: string | null } | null }).categories?.name
    if (!displayName) {
      skipped++
      continue
    }

    // Adopt: same account already has a board by this name.
    const existingId = existingByName.get(displayName.trim().toLowerCase())
    if (existingId) {
      const { error: upErr } = await supabase
        .from("pinterest_boards")
        .update({ board_id: existingId, board_name: displayName })
        .eq("id", row.id)
      if (upErr) failures.push({ name: displayName, reason: upErr.message })
      else adopted++
      continue
    }

    // Otherwise create fresh.
    try {
      const result = await createBoard({
        name: displayName,
        description: `Curated ${displayName.toLowerCase()} inspiration from arcolist.com — the platform for exceptional architecture & interior design.`,
        privacy: "PUBLIC",
      })
      const { error: upErr } = await supabase
        .from("pinterest_boards")
        .update({ board_id: result.boardId, board_name: result.name })
        .eq("id", row.id)
      if (upErr) failures.push({ name: displayName, reason: upErr.message })
      else created++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      failures.push({ name: displayName, reason: message })
    }
  }

  revalidatePath("/[locale]/admin/pinterest", "page")
  return { success: true, created, adopted, skipped, failures }
}

// ── Reconcile orphan pins on Pinterest ──────────────────────────────────
// Lists every pin on the connected account and deletes anything that
// isn't referenced by projects.pinterest_pin_id or
// project_features.pinterest_pin_id. Used after a duplicate-publish
// bug leaves orphaned pins on Pinterest that our DB no longer knows
// about (a repeat publish overwrote the stored id, but the old pin
// stayed live on Pinterest).
export async function reconcileOrphansAction(): Promise<{
  success: boolean
  pinterestPins: number
  known: number
  deleted: number
  failures: number
  error?: string
}> {
  await assertAdmin()
  const supabase = createServiceRoleSupabaseClient()

  const knownIds = new Set<string>()
  const { data: projectPins } = await supabase
    .from("projects").select("pinterest_pin_id").not("pinterest_pin_id", "is", null)
  for (const row of projectPins ?? []) if (row.pinterest_pin_id) knownIds.add(row.pinterest_pin_id)
  const { data: featurePins } = await supabase
    .from("project_features").select("pinterest_pin_id").not("pinterest_pin_id", "is", null)
  for (const row of featurePins ?? []) if (row.pinterest_pin_id) knownIds.add(row.pinterest_pin_id)

  let pinterestPins: { pinId: string }[]
  try {
    pinterestPins = await listPins()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, pinterestPins: 0, known: knownIds.size, deleted: 0, failures: 0, error: message }
  }

  let deleted = 0
  let failures = 0
  for (const p of pinterestPins) {
    if (knownIds.has(p.pinId)) continue
    try {
      await deletePin(p.pinId)
      deleted++
    } catch {
      failures++
    }
  }

  revalidatePath("/[locale]/admin/pinterest", "page")
  return { success: true, pinterestPins: pinterestPins.length, known: knownIds.size, deleted, failures }
}

// ── Disconnect ───────────────────────────────────────────────────────────
// Clears the stored tokens. Cron will start failing with "run OAuth
// bootstrap" errors until the admin reconnects via /oauth/start.
export async function disconnectPinterestAction(): Promise<{ success: boolean; error?: string }> {
  await assertAdmin()
  const supabase = createServiceRoleSupabaseClient()
  const { error } = await supabase
    .from("pinterest_auth")
    .update({
      access_token: null,
      refresh_token: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
      scope: null,
    })
    .eq("id", 1)
  if (error) return { success: false, error: error.message }
  revalidatePath("/[locale]/admin/pinterest", "page")
  return { success: true }
}
