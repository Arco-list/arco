"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerActionSupabaseClient } from "@/lib/supabase/server";
import { logger, sanitizeForLogging } from "@/lib/logger";

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

  // Create or update the company record
  const { data: existingCompany, error: existingCompanyError } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
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

  if (existingCompany) {
    const { error: updateCompanyError } = await supabase
      .from("companies")
      .update({
        name: companyName,
        website: domain,
        email,
        phone,
      })
      .eq("id", existingCompany.id);

    if (updateCompanyError) {
      logger.db(
        "update",
        "companies",
        "Failed to update existing company",
        { userId: user.id, payload: sanitizeForLogging({ companyName, domain, email, phone }) },
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
      })
      .select("id")
      .single();

    if (insertCompanyError) {
      logger.db(
        "insert",
        "companies",
        "Failed to create company",
        { userId: user.id, payload: sanitizeForLogging({ companyName, domain, email, phone }) },
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

  const servicesOffered = primaryService ? [primaryService] : null;

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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  revalidatePath("/homeowner");

  return { success: true };
}
