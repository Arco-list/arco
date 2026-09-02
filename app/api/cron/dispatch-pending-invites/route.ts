import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { dispatchPendingInvitesForProject } from "@/lib/invites/dispatch-professional-invite"

/**
 * Contributor-invite catch-up.
 *
 * `dispatchPendingInvitesForProject` was only ever reachable from
 * `dispatchPendingInvitesAction`, which the project editor calls in the
 * moment after a successful publish. Any other route to a published
 * project — an admin approval, a credit added later through a path that
 * does not dispatch, a swallowed exception around the dispatcher — left
 * the credit sitting with a valid address and no invite, permanently and
 * with nothing surfacing it. Eight credits on one project were stuck
 * that way for a week before the `invite_dispatched_at` column made it
 * visible.
 *
 * A one-shot at publish time is the wrong shape for something that must
 * not silently not-happen. This sweeps for the end state instead — a
 * published project carrying an undispatched, addressable credit — so
 * the send converges no matter which path created it.
 *
 * Safe to run repeatedly: the helper skips credits that already carry
 * `invite_dispatched_at`, skips @arcolist.com placeholders, and applies
 * the 30-day cold-recipient window so a firm credited on several
 * projects is not stacked with chains.
 *
 * Auth: Vercel Cron passes `Authorization: Bearer ${CRON_SECRET}`.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Projects touched per run. The dispatcher sends real email, so a
 *  backlog drains over several runs rather than in one burst. */
const MAX_PROJECTS_PER_RUN = 10

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const header = request.headers.get("authorization") ?? ""
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : ""
  const queryToken = request.nextUrl.searchParams.get("secret") ?? ""
  if (bearer !== expected && queryToken !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // `dryRun=1` reports what would be sent without sending it — the way
  // to inspect a backlog before letting it out.
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"

  try {
    const supabase = createServiceRoleSupabaseClient()

    // Candidate credits: addressable, still awaiting a response, never
    // dispatched. The project-status filter is applied after the join
    // because PostgREST cannot express it inline.
    const { data: pending, error } = await supabase
      .from("project_professionals")
      .select("id, project_id, invited_email, projects!inner(id, status)")
      .eq("is_project_owner", false)
      .eq("status", "invited")
      .is("invite_dispatched_at", null)
      .not("invited_email", "is", null)
      .neq("invited_email", "")

    if (error) throw new Error(error.message)

    const projectIds = Array.from(
      new Set(
        (pending ?? [])
          .filter((r: any) => {
            const s = r.projects?.status
            return s === "published" || s === "completed"
          })
          .map((r: any) => r.project_id as string),
      ),
    )

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        pendingCredits: (pending ?? []).length,
        projectsWithPending: projectIds.length,
        projectIds: projectIds.slice(0, MAX_PROJECTS_PER_RUN),
      })
    }

    let dispatched = 0
    let skipped = 0
    for (const projectId of projectIds.slice(0, MAX_PROJECTS_PER_RUN)) {
      try {
        const r = await dispatchPendingInvitesForProject(supabase, projectId)
        dispatched += r.dispatched
        skipped += r.skipped
      } catch (err) {
        // One bad project must not strand the rest of the backlog.
        logger.error("cron-dispatch-pending-invites project failed", { projectId }, err as Error)
      }
    }

    if (dispatched > 0) {
      logger.info("cron-dispatch-pending-invites sent", {
        scope: "contributor-invites", dispatched, skipped, projects: projectIds.length,
      })
    }

    return NextResponse.json({ ok: true, dispatched, skipped, projectsConsidered: projectIds.length })
  } catch (err) {
    logger.error("cron-dispatch-pending-invites failed", {}, err as Error)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
