import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const LOOPS_API_URL = "https://app.loops.so/api/v1/transactional";

// Loops.so transactional template IDs
const TEMPLATES = {
  magicLink: "cmh0ohx7k0fhk5h0ib2mhouvl",
  // Add more templates here as needed:
  // recovery: "your_recovery_template_id",
};

// Email action types that should send an email
const ACTIONABLE_TYPES = new Set([
  "magiclink",
  "signup",
  "email",
  "recovery",
  "invite",
  "reauthentication",
]);

// Notification types we skip (no email needed from us)
const NOTIFICATION_TYPES = new Set([
  "password_changed_notification",
  "email_changed_notification",
  "phone_changed_notification",
  "identity_linked_notification",
  "identity_unlinked_notification",
  "mfa_factor_enrolled_notification",
  "mfa_factor_unenrolled_notification",
]);

interface AuthHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      first_name?: string;
      last_name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function buildConfirmationUrl(emailData: AuthHookPayload["email_data"]): string {
  const { site_url, token_hash, email_action_type, redirect_to } = emailData;

  // Map action types to the verification "type" parameter Supabase expects
  const typeMap: Record<string, string> = {
    magiclink: "magiclink",
    signup: "signup",
    email: "email",
    recovery: "recovery",
    invite: "invite",
    reauthentication: "reauthentication",
  };

  const type = typeMap[email_action_type] || email_action_type;
  const base = `${site_url}/auth/v1/verify`;
  const params = new URLSearchParams({
    token: token_hash,
    type,
    redirect_to: redirect_to || site_url,
  });

  return `${base}?${params.toString()}`;
}

function getTemplateId(actionType: string): string {
  // For now, all actionable email types use the same magic link template.
  // Add specific templates here as you create them in Loops.so.
  return TEMPLATES.magicLink;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const loopsApiKey = Deno.env.get("LOOPS_API_KEY");
  if (!loopsApiKey) {
    console.error("LOOPS_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: "Email service not configured" } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

  // Read the raw payload
  const payload = await req.text();
  let data: AuthHookPayload;

  // Verify webhook signature if secret is configured
  if (hookSecret) {
    try {
      const secret = hookSecret.replace("v1,whsec_", "");
      const wh = new Webhook(secret);
      const headers = Object.fromEntries(req.headers);
      data = wh.verify(payload, headers) as AuthHookPayload;
    } catch (err) {
      console.error("Webhook verification failed:", err);
      return new Response(
        JSON.stringify({ error: { http_code: 401, message: "Invalid webhook signature" } }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
  } else {
    // No secret configured — parse payload directly (development only)
    console.warn("SEND_EMAIL_HOOK_SECRET not set — skipping signature verification");
    data = JSON.parse(payload);
  }

  const { user, email_data } = data;
  const actionType = email_data.email_action_type;

  console.log(`Auth email hook: ${actionType} for ${user.email}`);

  // Skip notification-only types
  if (NOTIFICATION_TYPES.has(actionType)) {
    console.log(`Skipping notification type: ${actionType}`);
    return new Response(JSON.stringify({}), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate it's an actionable type
  if (!ACTIONABLE_TYPES.has(actionType)) {
    console.warn(`Unknown email action type: ${actionType} — skipping`);
    return new Response(JSON.stringify({}), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build the confirmation URL and select template
  const confirmationUrl = buildConfirmationUrl(email_data);
  const transactionalId = getTemplateId(actionType);

  try {
    const response = await fetch(LOOPS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loopsApiKey}`,
      },
      body: JSON.stringify({
        email: user.email,
        transactionalId,
        addToAudience: true,
        dataVariables: {
          token: email_data.token,
          confirmationUrl,
          firstName: user.user_metadata?.first_name || "",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Loops API error: ${response.status} ${errorText}`);
      return new Response(
        JSON.stringify({ error: { http_code: response.status, message: errorText } }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    if (!result.success) {
      console.error("Loops email failed:", result.message);
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: result.message } }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Email sent via Loops: ${actionType} to ${user.email}`);
    return new Response(JSON.stringify({}), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Failed to send email via Loops:", err);
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: "Failed to send email" } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
