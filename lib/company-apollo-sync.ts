import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  findAccountByDomain,
  createAccount,
  updateAccountStageById,
} from "@/lib/apollo-client";
import { logger } from "@/lib/logger";

/**
 * Apollo ACCOUNT stage — single source of truth.
 *
 * This module is the ONLY writer of Apollo account stages. Contact
 * stages (per person) are still written by the prospect flows; the
 * account (company) stage is always computed here from Arco state so
 * two writers can never fight over the same field (the old behavior:
 * company-status sync and prospect-status sync both wrote the account
 * stage, last writer won).
 *
 * Resolution — post-claim lifecycle wins, Sales funnel overlays the
 * pre-claim window, static company status only shows when untouched:
 *
 *   deactivated              -> Deactivated
 *   unlisted                 -> Unlisted
 *   listed                   -> Listed
 *   created (claimed)        -> Created
 *   invited                  -> Invited
 *   pre-claim + signup       -> Signup
 *   pre-claim + visit        -> Visitor
 *   pre-claim + email sent   -> Contacted
 *   pre-claim, untouched     -> Prospect     (matches the Sales row)
 *
 * Showcased (company status 'prospected') is deliberately NOT an Apollo
 * stage — it describes how the company entered the funnel (we built a
 * page for it), not its outreach state. On Sales those companies start
 * as Prospect like any other pre-claim row, so Apollo mirrors that.
 *
 * Full-mirror: when the company's domain has no account in the Apollo
 * workspace we CREATE one (organic signups like NEST/ARHK), so every
 * Arco company is represented. Freemail domains are skipped — matching
 * "gmail.com" would attach the stage to a nonsense account.
 *
 * Call sites: company status changes (admin actions, project approval,
 * dashboard publish) AND prospect funnel transitions (sequence send,
 * landing visit, signup match) — both funnels converge here.
 */

const LIFECYCLE_STAGE: Record<string, string> = {
  deactivated: "Deactivated",
  unlisted: "Unlisted",
  listed: "Listed",
  created: "Created",
  invited: "Invited",
};

// Pre-claim funnel overlay, ranked. 'company' / 'active' are excluded
// on purpose: they only occur when the company itself is created/listed,
// which the lifecycle branch already covers (and covered more reliably —
// see the July 11 prospect-status corruption).
const FUNNEL_RANK: Record<string, number> = {
  contacted: 1,
  visitor: 2,
  signup: 3,
};
const FUNNEL_STAGE = ["", "Contacted", "Visitor", "Signup"];

export function resolveApolloAccountStage(
  companyStatus: string,
  prospectStatuses: string[],
): string {
  const lifecycle = LIFECYCLE_STAGE[companyStatus];
  if (lifecycle) return lifecycle;

  let best = 0;
  for (const s of prospectStatuses) {
    const rank = FUNNEL_RANK[s] ?? 0;
    if (rank > best) best = rank;
  }
  if (best > 0) return FUNNEL_STAGE[best];

  // Untouched pre-claim (added / prospected / legacy unclaimed):
  // mirror the Sales row's starting status.
  return "Prospect";
}

/** Domains that identify a mailbox provider, not a company — matching
 *  or creating an Apollo account on these would be meaningless. */
const FREEMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.nl",
  "outlook.com",
  "live.com",
  "live.nl",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
  "aol.com",
  "ziggo.nl",
  "kpnmail.nl",
  "xs4all.nl",
]);

/**
 * Extract domain from a URL (e.g. "https://www.example.com/about" → "example.com").
 */
function urlDomain(url: string): string {
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

/**
 * Sync an Arco company to Apollo as an account stage (see module doc
 * for the resolution rules). Creates the Apollo account when the domain
 * has none yet; caches apollo_account_id on the companies table.
 */
export async function syncCompanyToApollo(companyId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select("id, name, status, domain, website, email, apollo_account_id")
    .eq("id", companyId)
    .single();

  if (error || !company) {
    logger.error("[apollo-sync] Company not found", { companyId, error: error?.message });
    return;
  }

  // Funnel overlay input: every prospect status linked to this company.
  const { data: prospectRows } = await supabase
    .from("prospects")
    .select("status")
    .eq("company_id", companyId);

  const status = (company as { status: string }).status;
  const stageName = resolveApolloAccountStage(
    status,
    (prospectRows ?? []).map((p) => (p as { status: string }).status),
  );

  // Try the cached apollo_account_id first
  let apolloAccountId = (company as { apollo_account_id?: string | null }).apollo_account_id ?? null;
  logger.info("[apollo-sync] Account stage sync", { companyId, status, stageName, cachedApolloId: apolloAccountId });

  if (!apolloAccountId) {
    // Prefer website domain over the domain field (domain field can be stale)
    const c = company as { website?: string | null; domain?: string | null; email?: string | null; name: string };
    const domain = (c.website ? urlDomain(c.website) : null)
      ?? c.domain?.toLowerCase()
      ?? (c.email?.includes("@") ? c.email.split("@")[1].toLowerCase() : null);

    if (!domain) {
      logger.warn("[apollo-sync] No domain available", { companyId });
      return;
    }
    if (FREEMAIL_DOMAINS.has(domain)) {
      logger.warn("[apollo-sync] Freemail domain, skipping", { companyId, domain });
      return;
    }

    apolloAccountId = await findAccountByDomain(domain);

    // Full-mirror: no account yet -> create one so organic companies
    // (direct signups) are represented in Apollo too.
    if (!apolloAccountId) {
      apolloAccountId = await createAccount(c.name, domain);
    }
    if (!apolloAccountId) {
      logger.warn("[apollo-sync] No Apollo account found or created", { companyId, domain });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase
      .from("companies")
      .update({ apollo_account_id: apolloAccountId } as any)
      .eq("id", companyId);
  }

  try {
    await updateAccountStageById(apolloAccountId, stageName);
    logger.info("[apollo-sync] Account stage synced", { companyId, apolloAccountId, status, stageName });
  } catch (err) {
    logger.error("[apollo-sync] Failed to update stage", { companyId, apolloAccountId }, err as Error);
  }
}
