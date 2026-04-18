import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "standardwebhooks"
import { sendTransactionalEmail, resolveRecipientLanguage, type EmailTemplate } from "@/lib/email-service"

// Supabase Auth Hook secret — used to verify the webhook signature.
// Supabase HTTPS hooks use the Standard Webhooks spec: they sign the
// payload and send webhook-id, webhook-timestamp, webhook-signature headers.
const HOOK_SECRET = process.env.AUTH_HOOK_SECRET

// Map Supabase's email_action_type to our template names.
const ACTION_TO_TEMPLATE: Record<string, EmailTemplate> = {
  signup: "auth-confirm-signup",
  magiclink: "auth-magic-link",
  recovery: "auth-recovery",
  email_change: "auth-email-change",
  invite: "auth-invite",
}

export async function POST(req: NextRequest) {
  try {
    // Read the raw payload for signature verification
    const rawBody = await req.text()
    let body: any

    // Verify webhook signature using Standard Webhooks
    if (HOOK_SECRET) {
      try {
        const secret = HOOK_SECRET.replace("v1,whsec_", "")
        const wh = new Webhook(secret)
        const headers = Object.fromEntries(req.headers)
        body = wh.verify(rawBody, headers)
      } catch (err) {
        console.error("[auth-hook] Webhook signature verification failed:", err)
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
      }
    } else {
      console.warn("[auth-hook] AUTH_HOOK_SECRET not set — skipping signature verification")
      body = JSON.parse(rawBody)
    }

    const { user, email_data } = body

    if (!user?.email || !email_data) {
      console.error("[auth-hook] Missing user or email_data", body)
      return NextResponse.json({})
    }

    const actionType = email_data.email_action_type as string
    const template = ACTION_TO_TEMPLATE[actionType]

    if (!template) {
      console.warn(`[auth-hook] Unknown action type: ${actionType}`)
      return NextResponse.json({})
    }

    // Build the confirmation URL from the token_hash.
    // Supabase provides token_hash for link-based flows. The redirect URL
    // brings the user back to the app after clicking.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.arcolist.com"
    const redirectTo = email_data.redirect_to || siteUrl
    const tokenHash = email_data.token_hash as string | undefined
    const token = email_data.token as string | undefined

    let confirmUrl = redirectTo
    if (tokenHash) {
      // Supabase's verify endpoint handles the token exchange
      confirmUrl = `${siteUrl}/auth/confirm?token_hash=${tokenHash}&type=${actionType}&next=${encodeURIComponent(redirectTo)}`
    } else if (token) {
      confirmUrl = `${siteUrl}/auth/confirm?token=${token}&type=${actionType}&next=${encodeURIComponent(redirectTo)}`
    }

    // Resolve the recipient's preferred language
    const locale = await resolveRecipientLanguage({
      userId: user.id,
      email: user.email,
    })

    // Extract first name from user metadata
    const firstname =
      user.user_metadata?.first_name
      ?? user.user_metadata?.firstName
      ?? user.user_metadata?.name?.split(" ")[0]
      ?? undefined

    // For magic-link and reauthentication flows, Supabase provides an OTP
    // code in email_data.token that users can type instead of clicking a link.
    const code = (actionType === "magiclink" || actionType === "reauthentication")
      ? (email_data.token as string | undefined)
      : undefined

    const result = await sendTransactionalEmail(
      user.email,
      template,
      { firstname, confirmUrl, code },
      { locale },
    )

    if (!result.success) {
      console.error(`[auth-hook] Failed to send ${template} to ${user.email}:`, result.message)
    } else {
      console.log(`[auth-hook] Sent ${template} to ${user.email} [${locale}]`)
    }

    // Always return 200 so Supabase doesn't retry or block the auth flow.
    // Email delivery failures are logged but don't prevent account creation.
    return NextResponse.json({})
  } catch (err) {
    console.error("[auth-hook] Unexpected error:", err)
    return NextResponse.json({})
  }
}
