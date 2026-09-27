import "server-only"

import { logger } from "@/lib/logger"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

import type { OutboundSituationId } from "./templates"

/**
 * Which mail does this company get?
 *
 * One reading of the state, ranked by what we can actually show them.
 * The admin picks the tone and, where a state admits more than one ask,
 * which ask — everything else is a fact and is read here.
 *
 * TWO OUTPUTS, NOT ONE. The credit decides what /claim renders; the
 * situation decides what the mail says. They come apart in the case
 * that matters most: a firm with an open credit who already visited
 * once gets the invite LANDING (the project and roster, the strongest
 * proof we have) and the visitor COPY ("you were almost there").
 * Collapsing them into one field would force a choice between a weaker
 * page and a wrong opening.
 *
 * THE TOKEN IS ALWAYS CHANNEL 'outbound'. What the landing shows comes
 * from the creditId travelling with it, not from the channel — so a
 * hand-written mail can lead with somebody's project without the
 * arrival being counted as Invites. Channel answers "who did the work
 * of getting them here", and here that answer is always outbound.
 *
 * SIBLING OF resolveClaimChannel, deliberately not a replacement. That
 * one answers the same question for automated senders and knows nothing
 * about ownership, because an owned company is never in those campaigns.
 * Outbound can be aimed at anyone, ownership included, so it needs the
 * wider ladder.
 */

export type OutboundSituationResolution = {
  situation: OutboundSituationId
  /** Other asks that are equally valid here. Empty when the state
   *  leaves nothing to choose. */
  alternatives: OutboundSituationId[]
  /** The credit to hang the token on, which is what puts the project
   *  and the roster on the landing. Null when there is none. */
  creditId: string | null
  /** Populates the mail's own context; also what the popup shows. */
  companyName: string | null
  /**
   * The two facts the ladder above actually turns on, passed back so
   * the popup can show its work. An admin who can see "Prospected ·
   * Showcase" knows why the mail says what it says — and can spot a
   * wrong reading before it goes out, which a bare situation label
   * hides.
   */
  status: string | null
  /** True when `status` came from the prospect rather than the company
   *  — the popup colours the pill from the matching map. */
  statusIsProspect: boolean
  channel: "invite" | "showcase" | "outreach"
  /** Already live — used by the popup to explain its own choice. */
  listed: boolean
  owned: boolean
  /**
   * The copy this mail opens with: the admin's override when one was
   * saved, otherwise the version that ships in code. Always present —
   * every situation has a written mail, so the popup never opens on an
   * empty box or waits on the model to fill one.
   */
  storedSubject: string
  storedBody: string
}

/** Attach the admin-edited copy, if any. One place rather than seven,
 *  so a new branch cannot forget to look it up. */
async function withStored(
  base: Omit<OutboundSituationResolution, "storedSubject" | "storedBody">,
): Promise<OutboundSituationResolution> {
  const { loadStoredTemplate } = await import("./stored-templates")
  const { OUTBOUND_SITUATIONS } = await import("./templates")
  const shipped = OUTBOUND_SITUATIONS[base.situation]
  const stored = await loadStoredTemplate(base.situation)
  return {
    ...base,
    storedSubject: stored.subject || shipped.subject,
    storedBody: stored.body ?? shipped.body,
  }
}

export async function resolveOutboundSituation(
  companyId: string,
  email?: string | null,
  prospectId?: string | null,
): Promise<OutboundSituationResolution> {
  const svc = createServiceRoleSupabaseClient()

  const { data: company, error } = await svc
    .from("companies")
    .select("id, name, status, owner_id")
    .eq("id", companyId)
    .maybeSingle()

  // A failed read here is not a smaller answer, it is a WRONG one: no
  // row means owned=false, which routes an owner to a claim link for a
  // page they already hold. Say so rather than degrade quietly — this
  // went unnoticed once already, because a mistyped column name fails
  // exactly like a company that does not exist.
  if (error) {
    logger.error("Could not read company state for an outbound mail", { companyId }, error as unknown as Error)
  }

  const row = (company ?? null) as { name?: string | null; status?: string | null; owner_id?: string | null } | null
  const companyName = row?.name ?? null
  const owned = Boolean(row?.owner_id)

  // SALES OWNS THE STAGE. companies.status says what the page is;
  // prospects.status says where this contact stands, and that is the
  // pill the admin has been looking at all day. A contact reading
  // Visitor in the funnel must not read Added here — and 251 prospects
  // sit on 'visitor' whose companies are still 'added'.
  let prospectStatus: string | null = null
  const prospectQuery = svc.from("prospects").select("status")
  const { data: prospect } = prospectId
    ? await prospectQuery.eq("id", prospectId).maybeSingle()
    : email
      ? await prospectQuery.eq("company_id", companyId).ilike("email", email.trim()).maybeSingle()
      : { data: null }
  prospectStatus = (prospect as { status?: string | null } | null)?.status ?? null

  const status = prospectStatus ?? row?.status ?? null
  const statusIsProspect = prospectStatus !== null
  const listed = row?.status === "listed"

  // ── Already theirs: nothing to claim, so nothing to mint ──────────
  if (owned) {
    if (!listed) {
      return await withStored({
        situation: "owned_unlisted", alternatives: [], creditId: null,
        companyName, status, statusIsProspect, channel: "outreach", listed, owned,
      })
    }
    // Live and theirs. Two asks, both honest, and the state does not
    // choose between them — so the popup does, by showing both.
    return await withStored({
      situation: "listed_projects",
      alternatives: ["listed_pros"],
      creditId: null,
      companyName,
      status,
      statusIsProspect,
      channel: "outreach",
      listed,
      owned,
    })
  }

  // ── The claim ladder, strongest proof first ───────────────────────
  const { data: credit } = await svc
    .from("project_professionals")
    .select("id, projects!inner(status)")
    .eq("company_id", companyId)
    .eq("is_project_owner", false)
    .eq("status", "invited")
    .in("projects.status", ["published", "completed"])
    .limit(1)
    .maybeSingle()

  const { data: ownWork } = await svc
    .from("project_professionals")
    .select("project_id, projects!inner(status)")
    .eq("company_id", companyId)
    .eq("is_project_owner", true)
    .eq("projects.status", "published")
    .limit(1)
    .maybeSingle()

  // Have they already been to /claim? Sales has tracked this as a stage
  // far longer than claim_arrivals has existed, so its answer comes
  // first — the table only started collecting this session, and without
  // this the 251 contacts already marked Visitor would all be written
  // to as if they had never heard of us.
  let visited = prospectStatus === "visitor"
  if (!visited && email) {
    const { data: arrival } = await (svc as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown }> }
          }
        }
      }
    })
      .from("claim_arrivals")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .limit(1)
      .maybeSingle()
    visited = Boolean(arrival)
  }

  // The landing follows the proof; the copy follows the history. A
  // returning visitor still gets the project page when a credit exists.
  const creditId = (credit as { id?: string } | null)?.id ?? null
  const channel: "invite" | "showcase" | "outreach" = credit ? "invite" : ownWork ? "showcase" : "outreach"
  if (visited) {
    return await withStored({ situation: "visitor", alternatives: [], creditId, companyName, status, statusIsProspect, channel, listed, owned })
  }
  const situation: OutboundSituationId = credit ? "invited" : ownWork ? "showcase" : "outreach"
  return await withStored({ situation, alternatives: [], creditId, companyName, status, statusIsProspect, channel, listed, owned })
}
