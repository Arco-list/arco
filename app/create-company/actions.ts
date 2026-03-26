"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerActionSupabaseClient } from "@/lib/supabase/server";
import { logger, sanitizeForLogging } from "@/lib/logger";
import { claimPendingInvitesAction } from "@/app/new-project/actions";
import { claimPendingTeamInvitesAction } from "@/app/dashboard/team/actions";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateVerificationCode, storeVerificationCode, validateVerificationCode } from "@/lib/verification";
import { sendDomainVerificationEmail } from "@/lib/email-service";
import { enrichCompanyAction } from "@/app/dashboard/edit/enrich-company-actions";

const createCompanySchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required"),
  domain: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return `https://${trimmed}`;
    }),
  email: z.string().trim().email("Enter a valid company email"),
  phone: z.string().trim().min(5, "Enter a valid phone number"),
  primaryService: z.string().trim().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export type CreateCompanyResult = {
  success: boolean;
  error?: string;
};

export async function createCompanyAction(input: CreateCompanyInput): Promise<CreateCompanyResult> {
  const parseResult = createCompanySchema.safeParse(input);

  if (!parseResult.success) {
    const message = parseResult.error.errors.map((err) => err.message).join(", ");
    return { success: false, error: message };
  }

  const { companyName, domain, email, phone, primaryService } = parseResult.data;

  const supabase = await createServerActionSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    logger.auth("create-company", "Failed to fetch authenticated user", undefined, authError);
    return { success: false, error: "Unable to verify your session." };
  }

  if (!user) {
    return { success: false, error: "You must be signed in to create a company." };
  }

  // Fetch current profile to inspect user types
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    logger.db(
      "select",
      "profiles",
      "Failed to load profile before promoting to professional",
      { userId: user.id },
      profileError
    );
    return { success: false, error: "Unable to load your profile." };
  }

  const currentTypes = Array.isArray(profile?.user_types) ? profile?.user_types ?? [] : [];
  const desiredTypes = Array.from(new Set(["client", ...currentTypes, "professional"]));

  // Convert primaryService slug to category ID
  let primaryServiceId: string | null = null;
  if (primaryService) {
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", primaryService)
      .eq("is_active", true)
      .maybeSingle();

    primaryServiceId = category?.id ?? null;
  }

  // Create or update the company record
  const { data: existingCompany, error: existingCompanyError } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existingCompanyError) {
    logger.db(
      "select",
      "companies",
      "Failed to check existing company",
      { userId: user.id },
      existingCompanyError
    );
    return { success: false, error: "Unable to verify existing company." };
  }

  let companyId = existingCompany?.id ?? null;

  // Check for an enriched unlisted company matching this user's email domain
  // (created when the professional was invited via Google Places)
  if (!existingCompany) {
    const userDomain = user.email?.split("@")[1]?.toLowerCase()
    if (userDomain) {
      const { data: unlistedMatch } = await supabase
        .from("companies")
        .select("id")
        .eq("status", "unlisted")
        .or(`domain.ilike.%${userDomain}%,email.ilike.%@${userDomain}`)
        .limit(1)
        .maybeSingle()

      if (unlistedMatch) {
        // Claim this unlisted company: transfer ownership and merge user-provided fields
        const { error: claimError } = await supabase
          .from("companies")
          .update({
            owner_id: user.id,
            name: companyName,
            website: domain || undefined,
            email,
            phone,
            primary_service_id: primaryServiceId || null,
          })
          .eq("id", unlistedMatch.id)

        if (claimError) {
          logger.db("update", "companies", "Failed to claim unlisted company", { userId: user.id, companyId: unlistedMatch.id }, claimError)
        } else {
          companyId = unlistedMatch.id
          logger.info("Claimed enriched unlisted company", { scope: "create-company", userId: user.id, companyId: unlistedMatch.id })
        }
      }
    }
  }

  if (existingCompany) {
    const { error: updateCompanyError } = await supabase
      .from("companies")
      .update({
        name: companyName,
        website: domain,
        email,
        phone,
        primary_service_id: primaryServiceId || null,
      })
      .eq("id", existingCompany.id);

    if (updateCompanyError) {
      logger.db(
        "update",
        "companies",
        "Failed to update existing company",
        { userId: user.id, payload: sanitizeForLogging({ companyName, domain, email, phone, primaryServiceId }) },
        updateCompanyError
      );
      return { success: false, error: "Unable to update your company details." };
    }
  } else {
    const { data: newCompany, error: insertCompanyError } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        owner_id: user.id,
        website: domain,
        email,
        phone,
        primary_service_id: primaryServiceId || null,
      })
      .select("id")
      .single();

    if (insertCompanyError) {
      logger.db(
        "insert",
        "companies",
        "Failed to create company",
        { userId: user.id, payload: sanitizeForLogging({ companyName, domain, email, phone, primaryServiceId }) },
        insertCompanyError
      );
      return { success: false, error: "Unable to create your company." };
    }

    companyId = newCompany.id;
  }

  // Ensure professional profile exists
  const { data: professional, error: professionalError } = await supabase
    .from("professionals")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (professionalError) {
    logger.db(
      "select",
      "professionals",
      "Failed to load professional profile",
      { userId: user.id },
      professionalError
    );
    return { success: false, error: "Unable to load your professional profile." };
  }

  // Also save primary service to professionals.services_offered for backwards compatibility
  const servicesOffered = primaryServiceId ? [primaryServiceId] : null;

  if (professional) {
    const { error: updateProfessionalError } = await supabase
      .from("professionals")
      .update({
        company_id: companyId,
        title: companyName,
        services_offered: servicesOffered,
      })
      .eq("id", professional.id);

    if (updateProfessionalError) {
      logger.db(
        "update",
        "professionals",
        "Failed to update professional profile",
        { userId: user.id },
        updateProfessionalError
      );
      return { success: false, error: "Unable to update your professional profile." };
    }
  } else {
    const { error: insertProfessionalError } = await supabase.from("professionals").insert({
      title: companyName,
      user_id: user.id,
      company_id: companyId,
      services_offered: servicesOffered,
    });

    if (insertProfessionalError) {
      logger.db(
        "insert",
        "professionals",
        "Failed to create professional profile",
        { userId: user.id },
        insertProfessionalError
      );
      return { success: false, error: "Unable to create your professional profile." };
    }
  }

  // Promote user to professional in profiles
  const { error: updateProfileError } = await supabase
    .from("profiles")
    .update({ user_types: desiredTypes })
    .eq("id", user.id);

  if (updateProfileError) {
    logger.db(
      "update",
      "profiles",
      "Failed to update user types after Create Company",
      { userId: user.id, desiredTypes },
      updateProfileError
    );
    return { success: false, error: "Unable to update your account type." };
  }

  // Claim any pending project invites matching this user's email
  try {
    const claimResult = await claimPendingInvitesAction(user.id)
    if (claimResult.claimedCount > 0) {
      logger.info("Claimed pending project invites", {
        scope: "create-company",
        userId: user.id,
        claimedCount: claimResult.claimedCount
      })
    }
  } catch (claimError) {
    // Non-fatal error - log but don't fail the company creation
    logger.warn("Failed to claim pending invites", {
      scope: "create-company",
      userId: user.id,
      error: getErrorMessage(claimError)
    })
  }

  // Claim any pending team invites matching this user's email
  try {
    const teamResult = await claimPendingTeamInvitesAction(user.id)
    if (teamResult.claimedCount > 0) {
      logger.info("Claimed pending team invites", {
        scope: "create-company",
        userId: user.id,
        claimedCount: teamResult.claimedCount
      })
    }
  } catch (claimError) {
    logger.warn("Failed to claim pending team invites", {
      scope: "create-company",
      userId: user.id,
      error: getErrorMessage(claimError)
    })
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  revalidatePath("/homeowner");

  return { success: true };
}

// ---------------------------------------------------------------------------
// Claim an existing unowned company
// ---------------------------------------------------------------------------

export type ClaimCompanyResult = { success: boolean; error?: string }

export async function claimCompanyAction(input: {
  companyId: string
  domain?: string
}): Promise<ClaimCompanyResult> {
  const { companyId, domain } = input

  const supabase = await createServerActionSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "You must be signed in." }

  // Verify the company exists and has no owner
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, owner_id, name")
    .eq("id", companyId)
    .single()

  if (companyError || !company) return { success: false, error: "Company not found." }
  if (company.owner_id) return { success: false, error: "This company already has an owner." }

  // Claim: set owner_id, mark verified
  const { error: claimError } = await supabase
    .from("companies")
    .update({
      owner_id: user.id,
      is_verified: true,
      ...(domain ? { domain } : {}),
    })
    .eq("id", companyId)

  if (claimError) {
    logger.db("update", "companies", "Failed to claim company", { userId: user.id, companyId }, claimError)
    return { success: false, error: "Unable to claim this company." }
  }

  // Fetch current profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()

  const currentTypes = Array.isArray(profile?.user_types) ? profile?.user_types ?? [] : []
  const desiredTypes = Array.from(new Set(["client", ...currentTypes, "professional"]))

  // Ensure professional (team member) row exists
  const { data: professional } = await supabase
    .from("professionals")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (professional) {
    await supabase
      .from("professionals")
      .update({ company_id: companyId, title: company.name })
      .eq("id", professional.id)
  } else {
    await supabase.from("professionals").insert({
      title: company.name,
      user_id: user.id,
      company_id: companyId,
    })
  }

  // Promote user to professional
  await supabase
    .from("profiles")
    .update({ user_types: desiredTypes })
    .eq("id", user.id)

  // Claim pending invites (non-fatal)
  try { await claimPendingInvitesAction(user.id) } catch {}
  try { await claimPendingTeamInvitesAction(user.id) } catch {}

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/company")
  revalidatePath("/dashboard/listings")
  revalidatePath("/homeowner")

  return { success: true }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

// ---------------------------------------------------------------------------
// Domain verification actions
// ---------------------------------------------------------------------------

export type SendVerificationResult = { success: boolean; error?: string }

export async function sendDomainVerificationAction(input: {
  domain: string
  email: string
  companyName: string
}): Promise<SendVerificationResult> {
  const { domain, email, companyName } = input

  const supabase = await createServerActionSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "You must be signed in." }

  // Validate that the email belongs to the claimed domain
  const emailDomain = email.split("@")[1]?.toLowerCase()
  if (!emailDomain || emailDomain !== domain.toLowerCase()) {
    return { success: false, error: "Email must belong to the company domain." }
  }

  // Rate limit: 3 codes per 15 minutes
  const rl = await checkRateLimit(user.id, {
    limit: 3,
    window: 900,
    prefix: "@arco/domain-verify",
  })
  if (!rl.success) {
    return { success: false, error: "Too many attempts. Please wait a few minutes." }
  }

  const code = generateVerificationCode()
  const stored = await storeVerificationCode(user.id, domain, code)
  if (!stored) {
    return { success: false, error: "Unable to generate verification code." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle()

  const emailResult = await sendDomainVerificationEmail(email, {
    code,
    businessname: companyName,
  })

  if (!emailResult.success) {
    console.error("Domain verification email failed:", emailResult.message)
    return { success: false, error: emailResult.message || "Unable to send verification email. Please try again." }
  }

  return { success: true }
}

export type VerifyCodeResult = { success: boolean; verified?: boolean; error?: string }

export async function verifyDomainCodeAction(input: {
  domain: string
  code: string
}): Promise<VerifyCodeResult> {
  const { domain, code } = input

  const supabase = await createServerActionSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "You must be signed in." }

  const valid = await validateVerificationCode(user.id, domain, code)
  if (!valid) {
    return { success: false, error: "Invalid or expired code." }
  }

  return { success: true, verified: true }
}

// ---------------------------------------------------------------------------
// Create company from Google Places data
// ---------------------------------------------------------------------------

export type GooglePlaceData = {
  name: string
  placeId: string
  formattedAddress: string | null
  city: string | null
  country: string | null
  stateRegion: string | null
  phone: string | null
  website: string | null
  domain: string | null
  editorialSummary: string | null
  googleTypes: string[] | null
}

export type CreateCompanyFromPlacesResult = {
  success: boolean
  companyId?: string
  error?: string
}

export async function createCompanyFromPlacesAction(
  input: GooglePlaceData
): Promise<CreateCompanyFromPlacesResult> {
  const supabase = await createServerActionSupabaseClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "You must be signed in." }

  // Fetch current profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    logger.db("select", "profiles", "Failed to load profile", { userId: user.id }, profileError)
    return { success: false, error: "Unable to load your profile." }
  }

  const currentTypes = Array.isArray(profile?.user_types) ? profile?.user_types ?? [] : []
  const desiredTypes = Array.from(new Set(["client", ...currentTypes, "professional"]))

  // Check for existing company owned by this user
  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle()

  let companyId = existingCompany?.id ?? null

  // Check for unlisted company matching domain (claim flow)
  if (!existingCompany && input.domain) {
    const { data: unlistedMatch } = await supabase
      .from("companies")
      .select("id")
      .eq("status", "unlisted")
      .or(`domain.ilike.%${input.domain}%,email.ilike.%@${input.domain}`)
      .limit(1)
      .maybeSingle()

    if (unlistedMatch) {
      const { error: claimError } = await supabase
        .from("companies")
        .update({
          owner_id: user.id,
          name: input.name,
          website: input.website,
          domain: input.domain,
          phone: input.phone,
          address: input.formattedAddress,
          city: input.city,
          country: input.country,
          state_region: input.stateRegion,
          google_place_id: input.placeId,
          is_verified: true,
        })
        .eq("id", unlistedMatch.id)

      if (claimError) {
        logger.db("update", "companies", "Failed to claim unlisted company", { userId: user.id, companyId: unlistedMatch.id }, claimError)
      } else {
        companyId = unlistedMatch.id
        logger.info("Claimed enriched unlisted company via Places", { scope: "create-company", userId: user.id, companyId: unlistedMatch.id })
      }
    }
  }

  if (existingCompany) {
    // Update existing company with Places data
    const { error: updateError } = await supabase
      .from("companies")
      .update({
        name: input.name,
        website: input.website,
        domain: input.domain,
        phone: input.phone,
        address: input.formattedAddress,
        city: input.city,
        country: input.country,
        state_region: input.stateRegion,
        google_place_id: input.placeId,
        is_verified: true,
      })
      .eq("id", existingCompany.id)

    if (updateError) {
      logger.db("update", "companies", "Failed to update company from Places", { userId: user.id }, updateError)
      return { success: false, error: "Unable to update your company." }
    }
  } else if (!companyId) {
    // Insert new company
    const { data: newCompany, error: insertError } = await supabase
      .from("companies")
      .insert({
        name: input.name,
        owner_id: user.id,
        website: input.website,
        domain: input.domain,
        phone: input.phone,
        address: input.formattedAddress,
        city: input.city,
        country: input.country,
        state_region: input.stateRegion,
        google_place_id: input.placeId,
        is_verified: true,
        status: "draft",
      })
      .select("id")
      .single()

    if (insertError) {
      logger.db("insert", "companies", "Failed to create company from Places", { userId: user.id }, insertError)
      return { success: false, error: "Unable to create your company." }
    }

    companyId = newCompany.id
  }

  // Ensure professional (team member) row exists
  const { data: professional } = await supabase
    .from("professionals")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (professional) {
    const { error: updateProfError } = await supabase
      .from("professionals")
      .update({ company_id: companyId, title: input.name })
      .eq("id", professional.id)

    if (updateProfError) {
      logger.db("update", "professionals", "Failed to update professional", { userId: user.id }, updateProfError)
      return { success: false, error: "Unable to update your professional profile." }
    }
  } else {
    const { error: insertProfError } = await supabase.from("professionals").insert({
      title: input.name,
      user_id: user.id,
      company_id: companyId,
    })

    if (insertProfError) {
      logger.db("insert", "professionals", "Failed to create professional", { userId: user.id }, insertProfError)
      return { success: false, error: "Unable to create your professional profile." }
    }
  }

  // Promote user to professional
  const { error: updateProfileError } = await supabase
    .from("profiles")
    .update({ user_types: desiredTypes })
    .eq("id", user.id)

  if (updateProfileError) {
    logger.db("update", "profiles", "Failed to update user types", { userId: user.id }, updateProfileError)
    return { success: false, error: "Unable to update your account type." }
  }

  // Claim pending invites (non-fatal)
  try {
    await claimPendingInvitesAction(user.id)
  } catch (e) {
    logger.warn("Failed to claim pending invites", { scope: "create-company-places", userId: user.id, error: getErrorMessage(e) })
  }

  try {
    await claimPendingTeamInvitesAction(user.id)
  } catch (e) {
    logger.warn("Failed to claim pending team invites", { scope: "create-company-places", userId: user.id, error: getErrorMessage(e) })
  }

  // Fire AI enrichment (fire-and-forget)
  if (companyId) {
    enrichCompanyAction({
      companyId,
      companyName: input.name,
      website: input.website,
      domain: input.domain,
      editorialSummary: input.editorialSummary,
      googleTypes: input.googleTypes,
      city: input.city,
      country: input.country,
    }).catch((e) => {
      logger.warn("Failed to enrich company", { scope: "create-company-places", companyId, error: getErrorMessage(e) })
    })
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/company")
  revalidatePath("/dashboard/listings")
  revalidatePath("/homeowner")

  return { success: true, companyId: companyId ?? undefined }
}
