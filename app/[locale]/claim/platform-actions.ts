"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { loadClaimContext, type ClaimContext } from "@/lib/claim/context"
import { issueClaimToken } from "@/lib/claim/claim-token"
import { storeClaimEmailCode, validateClaimEmailCode } from "@/lib/claim/email-verification"
import { generateVerificationCode } from "@/lib/verification"
import { sendDomainVerificationEmail } from "@/lib/email-service"
import { checkRateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

/**
 * Server actions for the PLATFORM channel of the /claim funnel — the
 * tokenless entry, with verification FLIPPED into the company step:
 * the visitor proves the domain with a one-time code to an @domain
 * mailbox, and that verification mints the same signed claim token the
 * e-mail channels deliver. From there the funnel converges onto the
 * token machinery: the account step is the standard one (codeless for
 * the verified address, OTP for any other), OAuth survives via the
 * token in the URL, and the commit is completeClaimAction /
 * finalizeClaimSignedInAction.
 *
 * Nothing is written before the code checks out: an unproven visitor
 * picking a company in search must not be able to edit its record.
 */

const BLOCKED_EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "icloud.com"]

function domainFromWebsite(input: string | null | undefined): string | null {
  if (!input) return null
  try {
    const url = input.startsWith("http") ? input : `https://${input}`
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase() || null
  } catch {
    return null
  }
}

/**
 * Public context for a picked, unclaimed company. Everything returned is
 * on the public company page already — except companies.email, which is
 * ops data: contactLocal is blanked so the tokenless path can't fish for
 * the address the imports hold.
 */
export async function loadPlatformCompanyAction(
  companyId: string,
): Promise<{ ok: true; ctx: ClaimContext } | { ok: false; error: string }> {
  const ctx = await loadClaimContext({ companyId, creditId: null, email: "" })
  if (!ctx) return { ok: false, error: "Company not found." }
  if (ctx.company.ownerId) return { ok: false, error: "This company has already been claimed." }
  return { ok: true, ctx: { ...ctx, company: { ...ctx.company, contactLocal: "" } } }
}

/** The authoritative proof domain for an existing company: its stored
 *  domain, else its website's. The client's value only counts when the
 *  row carries neither — it can never swap the anchor from under a
 *  picked company. */
async function resolveProofDomain(
  companyId: string | null,
  clientDomain: string | null,
): Promise<{ domain: string | null; error?: string }> {
  let domain = clientDomain?.trim().toLowerCase() || null
  if (companyId) {
    const svc = createServiceRoleSupabaseClient()
    const { data: company } = await svc
      .from("companies")
      .select("id, owner_id, domain, website")
      .eq("id", companyId)
      .maybeSingle()
    if (!company) return { domain: null, error: "Company not found." }
    if (company.owner_id) return { domain: null, error: "This company has already been claimed." }
    domain = company.domain?.toLowerCase() ?? domainFromWebsite(company.website) ?? domain
  }
  if (!domain) return { domain: null, error: "A company website is required for verification." }
  if (BLOCKED_EMAIL_DOMAINS.includes(domain)) {
    return { domain: null, error: "Use your company's own domain, not a personal e-mail provider." }
  }
  return { domain }
}

export async function sendPlatformDomainCodeAction(input: {
  companyId: string | null
  domain: string | null
  emailLocal: string
  companyName: string
}): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const local = input.emailLocal.trim().toLowerCase().replace(/@.*$/, "")
  if (!local || /[^a-z0-9._+-]/.test(local)) {
    return { ok: false, error: "Enter a valid e-mail address." }
  }

  const { domain, error } = await resolveProofDomain(input.companyId, input.domain)
  if (!domain) return { ok: false, error: error ?? "A company website is required for verification." }

  const email = `${local}@${domain}`
  // 3 codes per 15 minutes per mailbox — same budget as the modal's
  // domain verify, keyed on the address since there is no user yet.
  const rl = await checkRateLimit(`platform-domain:${email}`, {
    limit: 3,
    window: 900,
    prefix: "@arco/claim-domain-verify",
  })
  if (!rl.success) return { ok: false, error: "Too many codes requested — try again in a few minutes." }

  const code = generateVerificationCode()
  if (!(await storeClaimEmailCode(email, domain, code))) {
    return { ok: false, error: "Could not generate a code. Please try again." }
  }
  const sent = await sendDomainVerificationEmail(email, {
    code,
    businessname: input.companyName || domain,
  })
  if (!sent.success) {
    return { ok: false, error: sent.message || "Could not send the code. Please try again." }
  }
  return { ok: true, email }
}

export type PlatformVerifyInput = {
  code: string
  emailLocal: string
  companyId: string | null
  /** Google establishment pick, when the company is new. */
  place: {
    name: string
    placeId: string
    formattedAddress: string | null
    city: string | null
    country: string | null
    stateRegion: string | null
    phone: string | null
    website: string | null
    domain: string | null
  } | null
  name: string
  website: string | null
  domain: string | null
}

/**
 * The pivot of the flipped flow: a valid code proves the mailbox on the
 * company domain, which authorises the company-step write (the ratchet
 * the token channels get from their e-mailed proof) and mints the
 * platform claim token. The client then navigates to the tokened URL
 * and the funnel continues as a normal token channel.
 */
export async function verifyPlatformDomainAndStartClaimAction(
  input: PlatformVerifyInput,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Company name is required." }

  const clientDomain = input.domain ?? input.place?.domain ?? domainFromWebsite(input.website)
  const { domain, error } = await resolveProofDomain(input.companyId, clientDomain)
  if (!domain) return { ok: false, error: error ?? "A company website is required for verification." }

  const local = input.emailLocal.trim().toLowerCase().replace(/@.*$/, "")
  const email = `${local}@${domain}`
  if (!(await validateClaimEmailCode(email, domain, input.code))) {
    return { ok: false, error: "Invalid or expired code." }
  }

  const svc = createServiceRoleSupabaseClient()
  const website = input.place?.website
    ?? (input.website ? `https://${input.website.replace(/^https?:\/\//, "")}` : null)

  let companyId = input.companyId

  // Domain dedupe for the create path: the domain just proven may
  // already carry an Arco row the search didn't surface (misspelled
  // name, Google registration under another name). An unclaimed match
  // is silently ADOPTED — the write and token land on it, no duplicate
  // row. A claimed match is a hard stop: that page is managed.
  if (!companyId) {
    const { data: candidates } = await svc
      .from("companies")
      .select("id, owner_id, domain, website, email")
      .or(`domain.ilike.%${domain}%,email.ilike.%@${domain},website.ilike.%${domain}%`)
      .limit(10)
    const matches = (candidates ?? []).filter((c) =>
      c.domain?.toLowerCase() === domain
      || domainFromWebsite(c.website) === domain
      || c.email?.toLowerCase().endsWith(`@${domain}`))
    const unclaimedMatch = matches.find((c) => !c.owner_id)
    const claimedMatch = matches.find((c) => c.owner_id)
    if (unclaimedMatch) {
      companyId = unclaimedMatch.id
    } else if (claimedMatch) {
      return {
        ok: false,
        error: "This domain already has a claimed page on Arco. Work there? Ask the colleague who manages the page to invite you as a team member.",
      }
    }
  }

  if (companyId) {
    // Existing unclaimed row: pin the proven identity (name + domain).
    // Location and services follow on the token company step — the
    // same ratchet write every token channel uses.
    const { error: writeError } = await svc
      .from("companies")
      .update({
        name,
        domain,
        ...(website ? { website } : {}),
      })
      .eq("id", companyId)
      .is("owner_id", null)
    if (writeError) {
      logger.error("claim: platform identity write failed", { companyId }, writeError as unknown as Error)
      return { ok: false, error: "Could not save. Please try again." }
    }
  } else {
    // New company: the verified identity becomes an unclaimed row (an
    // abandoner still leaves a correct, contactable record — the
    // funnel's ratchet philosophy), and the token rides on it. The
    // establishment's address comes along when Places supplied one.
    // A Google pick is REQUIRED and must be Dutch: the manual path is
    // off (NL-only marketplace for now), and the client-side country
    // restriction on the search must not be bypassable by a crafted
    // request.
    if (!input.place) {
      return { ok: false, error: "Select your company from the search results." }
    }
    if (input.place.country && !/^(netherlands|nederland)$/i.test(input.place.country.trim())) {
      return { ok: false, error: "Arco is currently open to companies in the Netherlands only." }
    }
    const { data: created, error: insertError } = await svc
      .from("companies")
      .insert({
        name,
        domain,
        website,
        status: "added",
        // Column default is 'manual' — that would file self-serve
        // platform entrants under the Showcase channel. They are the
        // definition of direct.
        source: "direct",
        audience: "homeowner",
        phone: input.place?.phone ?? null,
        address: input.place?.formattedAddress ?? null,
        city: input.place?.city ?? null,
        state_region: input.place?.stateRegion ?? null,
        country: input.place?.country ?? null,
        google_place_id: input.place?.placeId || null,
      })
      .select("id")
      .single()
    if (insertError || !created) {
      logger.error("claim: platform company insert failed", {}, insertError as unknown as Error)
      return { ok: false, error: "Could not create your company. Please try again." }
    }
    companyId = created.id
  }

  // Mint the STRONGEST channel the data supports — the same ranking the
  // e-mail senders use. A platform entrant with a pending credit gets
  // the invite experience (project card, roster, credit flips live at
  // the commit → Listed); one with own published work gets showcase.
  // Only a company with nothing on the platform stays on plain
  // platform copy — outreach copy is for cold e-mail, not for someone
  // already standing in the funnel.
  const { resolveClaimChannel } = await import("@/lib/claim/resolve-channel")
  const resolved = await resolveClaimChannel(companyId)
  const { token } = await issueClaimToken({
    companyId,
    creditId: resolved.channel === "invite" ? resolved.creditId : null,
    email,
    channel: resolved.channel === "outreach" ? "platform" : resolved.channel,
  })
  return { ok: true, token }
}
