import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_EMAIL = "Arco <noreply@arcolist.com>";

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

// ─── Email templates ─────────────────────────────────────────────────────────

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 0 32px;">
<img src="https://www.arcolist.com/arco-logo-email.png" alt="Arco" width="56" height="15" style="display:block;" />
</td></tr>
<tr><td style="padding:0 0 32px;">
${content}
</td></tr>
<tr><td style="padding:24px 0 0;border-top:1px solid #e8e8e6;">
<p style="margin:0;font-size:12px;color:#a1a1a0;line-height:1.5;">
Arco Global BV · The professional network architects trust.
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:400;color:#1c1c1a;font-family:Georgia,'Times New Roman',serif;">${text}</h1>`;
}

function body(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;font-weight:300;line-height:1.6;color:#4a4a48;">${text}</p>`;
}

function button(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background:#016D75;border-radius:3px;">
<a href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:400;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${text}</a>
</td></tr>
</table>`;
}

function codeBlock(code: string): string {
  return `<div style="margin:24px 0;padding:16px;background:#f5f5f4;border-radius:4px;text-align:center;">
    <span style="font-size:32px;font-weight:500;letter-spacing:0.3em;color:#1c1c1a;font-family:monospace;">${code}</span>
  </div>`;
}

function getEmailContent(actionType: string, firstName: string, confirmationUrl: string, token?: string): { subject: string; html: string } {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  switch (actionType) {
    case "magiclink":
      return {
        subject: token ? `${token} is your Arco sign-in code` : "Sign in to Arco",
        html: baseLayout(`
          ${heading("Sign in to Arco")}
          ${body(`${greeting}<br><br>Use this code to sign in to your Arco account:`)}
          ${token ? codeBlock(token) : ""}
          ${body("Or click the button below to sign in directly:")}
          ${button("Sign in", confirmationUrl)}
          ${body('<span style="color:#a1a1a0;font-size:13px;">This code expires in 10 minutes. If you didn\'t request this, you can safely ignore this email.</span>')}
        `),
      };

    case "signup":
      return {
        subject: "Confirm your Arco account",
        html: baseLayout(`
          ${heading("Welcome to Arco")}
          ${body(`${greeting}<br><br>Thanks for signing up. Confirm your email to get started.`)}
          ${button("Confirm email", confirmationUrl)}
          ${body('<span style="color:#a1a1a0;font-size:13px;">This link expires in 24 hours.</span>')}
        `),
      };

    case "recovery":
      return {
        subject: "Reset your Arco password",
        html: baseLayout(`
          ${heading("Reset your password")}
          ${body(`${greeting}<br><br>We received a request to reset your password. Click below to choose a new one.`)}
          ${button("Reset password", confirmationUrl)}
          ${body('<span style="color:#a1a1a0;font-size:13px;">This link expires in 10 minutes. If you didn\'t request this, your password remains unchanged.</span>')}
        `),
      };

    case "email":
      return {
        subject: "Confirm your new email address",
        html: baseLayout(`
          ${heading("Confirm email change")}
          ${body(`${greeting}<br><br>Click below to confirm your new email address.`)}
          ${button("Confirm email", confirmationUrl)}
          ${body('<span style="color:#a1a1a0;font-size:13px;">If you didn\'t request this change, please contact support.</span>')}
        `),
      };

    case "invite":
      return {
        subject: "You're invited to Arco",
        html: baseLayout(`
          ${heading("You're invited")}
          ${body(`${greeting}<br><br>You've been invited to join Arco. Click below to accept and create your account.`)}
          ${button("Accept invitation", confirmationUrl)}
        `),
      };

    case "reauthentication":
      return {
        subject: "Confirm your identity on Arco",
        html: baseLayout(`
          ${heading("Confirm your identity")}
          ${body(`${greeting}<br><br>For security, please confirm your identity to continue.`)}
          ${button("Confirm", confirmationUrl)}
          ${body('<span style="color:#a1a1a0;font-size:13px;">This link expires in 10 minutes.</span>')}
        `),
      };

    default:
      return {
        subject: "Action required on Arco",
        html: baseLayout(`
          ${heading("Action required")}
          ${body(`${greeting}<br><br>Click below to continue.`)}
          ${button("Continue", confirmationUrl)}
        `),
      };
  }
}

// ─── Edge Function handler ───────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
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

  // Build the confirmation URL and render email
  const confirmationUrl = buildConfirmationUrl(email_data);
  const firstName = user.user_metadata?.first_name || "";
  const { subject, html } = getEmailContent(actionType, firstName, confirmationUrl, email_data.token);

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: user.email,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Resend API error: ${response.status} ${errorText}`);
      return new Response(
        JSON.stringify({ error: { http_code: response.status, message: errorText } }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log(`Email sent via Resend: ${actionType} to ${user.email} (id: ${result.id})`);
    return new Response(JSON.stringify({}), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Failed to send email via Resend:", err);
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: "Failed to send email" } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
