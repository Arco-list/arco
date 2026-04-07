import { logger } from "@/lib/logger";

const APOLLO_BASE_URL = "https://api.apollo.io";

function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    throw new Error("Missing APOLLO_API_KEY environment variable");
  }
  return key;
}

interface ApolloRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
}

async function apolloRequest<T = unknown>(
  options: ApolloRequestOptions
): Promise<T> {
  const { method, path, body } = options;
  const apiKey = getApiKey();
  const url = `${APOLLO_BASE_URL}${path}`;

  logger.info("Apollo API request", {
    method,
    path,
  });

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      logger.error("Apollo API error response", {
        method,
        path,
        status: response.status,
        statusText: response.statusText,
        errorText,
      });
      throw new ApolloApiError(
        `Apollo API ${method} ${path} failed: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    // DELETE requests may return empty body
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return {} as T;
    }

    const data = await response.json();

    logger.debug("Apollo API response", {
      method,
      path,
      status: response.status,
    });

    return data as T;
  } catch (error) {
    if (error instanceof ApolloApiError) {
      throw error;
    }
    logger.error(
      "Apollo API network error",
      { method, path },
      error as Error
    );
    throw new ApolloApiError(
      `Apollo API ${method} ${path} network error: ${(error as Error).message}`,
      0,
      (error as Error).message
    );
  }
}

class ApolloApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string
  ) {
    super(message);
    this.name = "ApolloApiError";
  }
}

// ── Contact endpoints ──────────────────────────────────────────────────

interface ApolloContact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  title?: string;
  phone_numbers?: Array<{ raw_number: string }>;
  city?: string;
  country?: string;
  website_url?: string;
  [key: string]: unknown;
}

/**
 * Get contact details by Apollo contact ID.
 */
async function getContact(contactId: string): Promise<ApolloContact> {
  const data = await apolloRequest<{ contact: ApolloContact }>({
    method: "GET",
    path: `/api/v1/contacts/${contactId}`,
  });
  return data.contact;
}

/**
 * Update a contact's fields (e.g. stage, status, custom fields).
 */
async function updateContact(
  contactId: string,
  updates: Record<string, unknown>
): Promise<ApolloContact> {
  const data = await apolloRequest<{ contact: ApolloContact }>({
    method: "PUT",
    path: `/api/v1/contacts/${contactId}`,
    body: updates,
  });
  return data.contact;
}

// ── Contact stage endpoints ───────────────────────────────────────────

interface ApolloContactStage {
  id: string;
  name: string;
  display_order: number;
}

/**
 * Fetch all contact stages from Apollo.
 */
async function getContactStages(): Promise<ApolloContactStage[]> {
  const data = await apolloRequest<{ contact_stages: ApolloContactStage[] }>({
    method: "GET",
    path: "/api/v1/contact_stages",
  });
  return data.contact_stages ?? [];
}

/**
 * Cached stage name → ID mapping. Populated on first use.
 */
let stageMapCache: Record<string, string> | null = null;

async function getStageMap(): Promise<Record<string, string>> {
  if (stageMapCache) return stageMapCache;
  const stages = await getContactStages();
  stageMapCache = {};
  for (const s of stages) {
    stageMapCache[s.name.toLowerCase()] = s.id;
  }
  return stageMapCache;
}

/**
 * Update a contact's stage in Apollo by stage name (e.g. "Prospect", "Contacted").
 * Silently skips if the stage name is not found in Apollo.
 */
export async function updateContactStage(
  contactId: string,
  stageName: string
): Promise<void> {
  const map = await getStageMap();
  const stageId = map[stageName.toLowerCase()];
  if (!stageId) {
    logger.warn("Apollo stage not found, skipping update", { stageName });
    return;
  }
  await updateContact(contactId, { contact_stage_id: stageId });
  logger.info("Updated Apollo contact stage", { contactId, stageName, stageId });
}

// ── Account (company) stage endpoints ─────────────────────────────────

interface ApolloAccountStage {
  id: string;
  name: string;
  display_order: number;
}

/**
 * Fetch all account stages from Apollo.
 */
async function getAccountStages(): Promise<ApolloAccountStage[]> {
  const data = await apolloRequest<{ account_stages: ApolloAccountStage[] }>({
    method: "GET",
    path: "/api/v1/account_stages",
  });
  return data.account_stages ?? [];
}

let accountStageMapCache: Record<string, string> | null = null;

async function getAccountStageMap(): Promise<Record<string, string>> {
  if (accountStageMapCache) return accountStageMapCache;
  const stages = await getAccountStages();
  accountStageMapCache = {};
  for (const s of stages) {
    accountStageMapCache[s.name.toLowerCase()] = s.id;
  }
  return accountStageMapCache;
}

/**
 * Update an account's stage in Apollo by stage name.
 * Looks up the account by contact's account_id.
 */
export async function updateAccountStage(
  contactId: string,
  stageName: string
): Promise<void> {
  // First get the contact to find their account_id
  const contact = await getContact(contactId);
  const accountId = (contact as any).account_id;
  if (!accountId) {
    logger.warn("No account_id on contact, skipping account stage update", { contactId });
    return;
  }

  const map = await getAccountStageMap();
  const stageId = map[stageName.toLowerCase()];
  if (!stageId) {
    logger.warn("Apollo account stage not found, skipping update", { stageName });
    return;
  }

  await apolloRequest({
    method: "PUT",
    path: `/api/v1/accounts/${accountId}`,
    body: { account_stage_id: stageId },
  });
  logger.info("Updated Apollo account stage", { contactId, accountId, stageName, stageId });
}

/**
 * Search for an Apollo account by domain. Returns the account ID if found.
 */
export async function findAccountByDomain(domain: string): Promise<string | null> {
  try {
    const data = await apolloRequest<{ accounts: Array<{ id: string; domain?: string }> }>({
      method: "POST",
      path: "/api/v1/accounts/search",
      body: {
        q_organization_domains: domain,
        page: 1,
        per_page: 1,
      },
    });
    const account = data.accounts?.[0];
    return account?.id ?? null;
  } catch (err) {
    logger.error("Failed to search Apollo account by domain", { domain }, err as Error);
    return null;
  }
}

/**
 * Update an Apollo account's stage by account ID directly.
 */
export async function updateAccountStageById(
  accountId: string,
  stageName: string
): Promise<void> {
  const map = await getAccountStageMap();
  const stageId = map[stageName.toLowerCase()];
  if (!stageId) {
    logger.warn("Apollo account stage not found, skipping update", { stageName });
    return;
  }

  await apolloRequest({
    method: "PUT",
    path: `/api/v1/accounts/${accountId}`,
    body: { account_stage_id: stageId },
  });
  logger.info("Updated Apollo account stage by ID", { accountId, stageName, stageId });
}

// ── Sequence (emailer campaign) endpoints ──────────────────────────────

/**
 * Remove a contact from an Apollo sequence.
 */
export async function removeContactFromSequence(
  sequenceId: string,
  contactId: string
): Promise<void> {
  await apolloRequest({
    method: "DELETE",
    path: `/api/v1/emailer_campaigns/${sequenceId}/remove_contact`,
    body: { contact_id: contactId },
  });

  logger.info("Removed contact from Apollo sequence", {
    sequenceId,
    contactId,
  });
}
