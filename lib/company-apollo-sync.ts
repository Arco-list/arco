import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { findAccountByDomain, updateAccountStageById } from "@/lib/apollo-client";
import { logger } from "@/lib/logger";

/**
 * Map Arco company status → Apollo account stage name.
 */
const COMPANY_STATUS_TO_APOLLO_STAGE: Record<string, string> = {
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

/**
 * Sync "invited" companies (draft with no owner) to Apollo.
 * These are auto-created from project invites.
 */
export async function syncInvitedCompanyToApollo(companyId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select("id, status, owner_id, domain, website, email, apollo_account_id")
    .eq("id", companyId)
    .single();

  if (error || !company) return;

  // Invited = draft/unlisted with no owner
  const isInvited = ((company as any).status === "draft" || (company as any).status === "unlisted") && !(company as any).owner_id;
  const stageName = isInvited ? "Invited" : COMPANY_STATUS_TO_APOLLO_STAGE[(company as any).status];
  if (!stageName) return;

  let apolloAccountId = (company as any).apollo_account_id as string | null;

  if (!apolloAccountId) {
    const domain = (company as any).domain
      ?? ((company as any).website ? urlDomain((company as any).website) : null)
      ?? ((company as any).email?.includes("@") ? (company as any).email.split("@")[1] : null);

    if (!domain) return;
    apolloAccountId = await findAccountByDomain(domain);
    if (!apolloAccountId) return;

    await supabase
      .from("companies")
      .update({ apollo_account_id: apolloAccountId } as any)
      .eq("id", companyId);
  }

  try {
    await updateAccountStageById(apolloAccountId, stageName);
  } catch (err) {
    logger.error("Failed to sync invited company to Apollo", { companyId }, err as Error);
  }
}
