"use server"

import { revalidatePath } from "next/cache"
import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { sendTransactionalEmail } from "@/lib/email-service"
import { getCompanyEmailRecipients } from "@/lib/companies/company-email-recipients"
import { checkRateLimit } from "@/lib/rate-limit"

export type SendIntroductionResult = {
  success: boolean
  error?: string
}

export async function sendIntroductionRequestAction(input: {
  companyId: string
  message: string
}): Promise<SendIntroductionResult> {
  const { companyId, message } = input

  if (!message.trim() || message.trim().length < 10) {
    return { success: false, error: "Please write a message (at least 10 characters)." }
  }

  const supabase = await createServerActionSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in." }

  // Rate limit: 5 introductions per hour
  const rl = await checkRateLimit(user.id, {
    limit: 5,
    window: 3600,
    prefix: "@arco/introduction",
  })
  if (!rl.success) {
    return { success: false, error: "Too many requests. Please try again later." }
  }

  // Get sender profile
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone")
    .eq("id", user.id)
    .maybeSingle()

  const senderName = [senderProfile?.first_name, senderProfile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || user.email?.split("@")[0] || "A client"

  // Use service role for cross-user operations
  const serviceSupabase = createServiceRoleSupabaseClient()

  // Get company + owner info
  const { data: company } = await serviceSupabase
    .from("companies")
    .select("id, name, owner_id, email")
    .eq("id", companyId)
    .maybeSingle()

  if (!company) return { success: false, error: "Company not found." }

  // The in-app message still addresses the owner; the email fans out
  // to every team contact with the company-mail toggle on.
  const recipientId = company.owner_id ?? user.id

  // Insert message using service role to bypass RLS
  const { error: insertError } = await serviceSupabase
    .from("messages")
    .insert({
      sender_id: user.id,
      recipient_id: recipientId,
      company_id: companyId,
      content: message.trim(),
      subject: `Introduction request from ${senderName}`,
      message_type: "introduction",
      is_read: false,
      sender_email: user.email || null,
      sender_phone: senderProfile?.phone || null,
    } as any)

  if (insertError) {
    console.error("Failed to insert message:", insertError)
    return { success: false, error: "Failed to send message." }
  }

  // Send email notification to every company-mail receiver (team page
  // toggle; falls back to the owner, then the company address).
  const recipients = await getCompanyEmailRecipients(companyId)
  for (const recipient of recipients) {
    try {
      await sendTransactionalEmail(
        recipient.email,
        "introduction-request",
        {
          firstname: company.name,
          client_name: senderName,
          client_email: user.email || "",
          message_preview: message.trim().slice(0, 200),
          dashboard_link: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.arcolist.com"}/dashboard/inbox`,
        },
        // Prefer the recipient's preferred_language; fall back to the
        // company country for contacts without an account.
        { userId: recipient.userId, companyId },
      )
    } catch (err) {
      console.error("Failed to send introduction email:", err)
    }
  }

  revalidatePath("/dashboard/inbox")
  revalidatePath("/homeowner")
  return { success: true }
}
