import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { findAccountByDomain, updateAccountStageById } from "@/lib/apollo-client";
import { logger } from "@/lib/logger";

/**
 * Map Arco company status → Apollo account stage name.
 *
 * Every status the admin can set via /admin/companies must be present
 * here, otherwise the sync silently no-ops for that transition (the
 * `stageName` lookup falls through and we return before touching Apollo).
 *
 * "Invited" is included even though it's currently rendered as a virtual
 * status derived from project_professionals links — if a future change
 * promotes it to a real company_status enum value the sync will pick it
 * up automatically.
 */
const COMPANY_STATUS_TO_APOLLO_STAGE: Record<string, string> = {
  unclaimed: "Unclaimed",
  prospected: "Prospected",
  invited: "Invited",
  draft: "Draft",
  listed: "Listed",
  unlisted: "Unlisted",
  deactivated: "Deactivated",
};

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
 * Sync an Arco company's status to Apollo as an account stage.
 * Matches the company to an Apollo account by domain.
 * Caches the apollo_account_id on the companies table for future syncs.
 */
export async function syncCompanyToApollo(companyId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select("id, status, domain, website, email, apollo_account_id")
    .eq("id", companyId)
    .single();

  if (error || !company) {
    logger.debug("Company not found for Apollo sync", { companyId });
    return;
  }

  const status = (company as any).status;
  const stageName = COMPANY_STATUS_TO_APOLLO_STAGE[status];
  if (!stageName) {
    logger.debug("No Apollo stage mapping for company status", { companyId, status });
    return;
  }

  // Try to get cached apollo_account_id first
  let apolloAccountId = (company as any).apollo_account_id as string | null;

  // If not cached, search Apollo by domain
  if (!apolloAccountId) {
    const domain = (company as any).domain
      ?? ((company as any).website ? urlDomain((company as any).website) : null)
      ?? ((company as any).email?.includes("@") ? (company as any).email.split("@")[1] : null);

    if (!domain) {
      logger.debug("No domain available for Apollo account lookup", { companyId });
      return;
    }

    apolloAccountId = await findAccountByDomain(domain);

    if (!apolloAccountId) {
      logger.debug("No Apollo account found for domain", { companyId, domain });
      return;
    }

    // Cache the apollo_account_id
    await supabase
      .from("companies")
      .update({ apollo_account_id: apolloAccountId } as any)
      .eq("id", companyId);
  }

  // Update the Apollo account stage
  try {
    await updateAccountStageById(apolloAccountId, stageName);
    logger.info("Synced company status to Apollo account stage", {
      companyId,
      apolloAccountId,
      status,
      stageName,
    });
  } catch (err) {
    logger.error("Failed to sync company to Apollo", { companyId, apolloAccountId }, err as Error);
  }
}

