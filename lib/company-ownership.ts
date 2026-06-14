import type { SupabaseClient } from "@supabase/supabase-js"

import { logger } from "@/lib/logger"

/**
 * Ensure that the new-model owner link exists in `company_contacts` after
 * a company has been claimed or created, and demote any prior owner row.
 *
 * This is the bridge between the legacy "owner = companies.owner_id +
 * professionals row" world and the new "owner = company_contacts row with
 * role='owner'" world. Call it everywhere `companies.owner_id` is set or
 * changed for a user, alongside the legacy writes.
 *
 * Assumes `handle_new_user` has already created a `persons` row for this
 * auth user (true for all signups after migration 176). If somehow it
 * hasn't, the function logs and no-ops rather than throwing.
 */
export async function ensureCompanyOwnerContact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", "public", any>,
  companyId: string,
  userId: string,
): Promise<void> {
  const { data: person, error: personError } = await supabase
    .from("persons")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle()

  if (personError) {
    logger.warn("[company-ownership] failed to look up person", { userId, error: personError.message })
    return
  }
  if (!person) {
    logger.warn("[company-ownership] no person row for auth user — skipping owner-contact sync", { userId })
    return
  }

  // Demote any other contact currently holding role='owner' on this
  // company so the partial unique index (one owner per company) accepts
  // our upsert. Skips the current person to avoid round-tripping their
  // own row through 'admin'.
  await supabase
    .from("company_contacts")
    .update({ role: "admin" })
    .eq("company_id", companyId)
    .eq("role", "owner")
    .neq("person_id", person.id)

  // Upsert (company_id, person_id) → owner/active. Matches the table's
  // UNIQUE (company_id, person_id) constraint.
  const { error: upsertError } = await supabase
    .from("company_contacts")
    .upsert(
      {
        company_id: companyId,
        person_id: person.id,
        role: "owner",
        status: "active",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "company_id,person_id" },
    )

  if (upsertError) {
    logger.warn("[company-ownership] failed to upsert owner contact", {
      companyId,
      personId: person.id,
      error: upsertError.message,
    })
  }
}
