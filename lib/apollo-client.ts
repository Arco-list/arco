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

export class ApolloApiError extends Error {
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

export interface ApolloContact {
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
export async function getContact(contactId: string): Promise<ApolloContact> {
  const data = await apolloRequest<{ contact: ApolloContact }>({
    method: "GET",
    path: `/api/v1/contacts/${contactId}`,
  });
  return data.contact;
}

/**
 * Update a contact's fields (e.g. stage, status, custom fields).
 */
export async function updateContact(
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
