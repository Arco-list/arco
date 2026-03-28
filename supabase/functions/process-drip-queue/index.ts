import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_EMAIL = "Arco <noreply@arcolist.com>";

// Email templates (must match email-service.ts)
function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 0 32px;">
<img src="https://www.arcolist.com/arco-logo-square.png" alt="Arco" width="40" height="40" style="display:block;border-radius:8px;" />
</td></tr>
<tr><td style="padding:0 0 32px;">
${content}
</td></tr>
<tr><td style="padding:24px 0 0;border-top:1px solid #e8e8e6;">
<p style="margin:0;font-size:12px;color:#a1a1a0;line-height:1.5;">
<img src="https://www.arcolist.com/arco-logo-email.png" alt="Arco" width="36" height="10" style="display:inline-block;vertical-align:middle;opacity:0.4;margin-right:6px;" />Arco Global BV \u00b7 The professional network architects trust.
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
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#016D75;border-radius:3px;"><a href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:400;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${text}</a></td></tr></table>`;
}

const TEMPLATES: Record<string, (vars: Record<string, string>, projects?: any[]) => { subject: string; html: string }> = {
  "welcome-homeowner": (vars) => ({
    subject: "Welcome to Arco",
    html: baseLayout(`
      ${heading("Welcome to Arco")}
      ${body(`${vars.firstname ? `Hi ${vars.firstname},` : "Hi,"}<br><br>Thanks for joining Arco — the curated architecture platform where great projects and the professionals behind them get the recognition they deserve.`)}
      ${body("Here's what you can do:")}
      ${body(`<strong>Browse projects</strong> — Explore completed architecture and interior design projects from across the Netherlands.<br><br><strong>Discover professionals</strong> — Find architects, interior designers, and builders credited on real work.<br><br><strong>Save your favorites</strong> — Bookmark projects and professionals to revisit later.`)}
      ${button("Explore projects", "https://www.arcolist.com/projects")}
    `),
  }),
  "discover-projects": (vars, projects) => ({
    subject: "Discover projects on Arco",
    html: baseLayout(`
      ${heading("Projects worth exploring")}
      ${body(`${vars.firstname ? `Hi ${vars.firstname},` : "Hi,"}<br><br>Arco is home to a growing collection of architecture and interior design projects — from modern villas to thoughtful renovations.`)}
      ${projects?.length ? projects.map((p: any) => `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
<tr><td style="font-size:0;line-height:0;"><a href="https://www.arcolist.com/projects/${p.slug}" target="_blank"><img src="${p.image}" alt="${p.title}" width="520" style="display:block;width:100%;height:auto;border-radius:8px;" /></a></td></tr>
<tr><td style="padding:10px 0 0;"><a href="https://www.arcolist.com/projects/${p.slug}" target="_blank" style="text-decoration:none;"><p style="margin:0 0 2px;font-size:15px;font-weight:400;color:#1c1c1a;">${p.title}</p>${p.location ? `<p style="margin:0;font-size:14px;font-weight:400;color:#a1a1a0;">${p.location}</p>` : ""}</a></td></tr>
</table>`).join("") : ""}
      ${body("Browse by style, location, building type, and more. Every project credits the professionals who made it happen.")}
      ${button("Browse all projects", "https://www.arcolist.com/projects")}
    `),
  }),
  "find-professionals": (vars) => ({
    subject: "Find the right professional on Arco",
    html: baseLayout(`
      ${heading("Find your team")}
      ${body(`${vars.firstname ? `Hi ${vars.firstname},` : "Hi,"}<br><br>Looking for an architect or interior designer? On Arco, every professional is credited on real projects — so you can judge them by the work they've delivered, not just what they promise.`)}
      ${body("Browse professionals by service, location, and the projects they've worked on. Save the ones you like and reach out when you're ready.")}
      ${button("Discover professionals", "https://www.arcolist.com/professionals")}
    `),
  }),
};

Deno.serve(async (req) => {
  // Allow both POST (cron) and GET (manual trigger)
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!resendApiKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Missing configuration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch due emails (send_at <= now, not yet sent or cancelled)
  const { data: dueEmails, error: fetchError } = await supabase
    .from("email_drip_queue")
    .select("*")
    .lte("send_at", new Date().toISOString())
    .is("sent_at", null)
    .is("cancelled_at", null)
    .order("send_at", { ascending: true })
    .limit(50);

  if (fetchError) {
    console.error("Failed to fetch drip queue:", fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Pre-fetch featured projects for discover-projects emails
  let featuredProjects: { title: string; image: string; slug: string; location?: string }[] = [];
  const needsProjects = (dueEmails ?? []).some(e => e.template === "discover-projects");
  if (needsProjects) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, slug, location, address_city")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(3);

    for (const p of projects ?? []) {
      const { data: photo } = await supabase
        .from("project_photos")
        .select("url")
        .eq("project_id", (p as any).id)
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (photo?.url) {
        featuredProjects.push({
          title: p.title ?? "Project",
          image: photo.url,
          slug: p.slug ?? "",
          location: (p as any).address_city ?? p.location ?? undefined,
        });
      }
    }
  }

  let sent = 0;
  let failed = 0;

  for (const item of dueEmails ?? []) {
    const template = TEMPLATES[item.template];
    if (!template) {
      console.warn(`Unknown template: ${item.template}`);
      continue;
    }

    const vars = (item.variables as Record<string, string>) ?? {};
    const projects = item.template === "discover-projects" ? featuredProjects : undefined;
    const { subject, html } = template(vars, projects);

    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: item.email,
          subject,
          html,
        }),
      });

      if (response.ok) {
        await supabase
          .from("email_drip_queue")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", item.id);
        sent++;
        console.log(`Sent ${item.template} to ${item.email}`);
      } else {
        const errorText = await response.text();
        console.error(`Failed to send ${item.template} to ${item.email}: ${errorText}`);
        failed++;
      }
    } catch (err) {
      console.error(`Error sending ${item.template} to ${item.email}:`, err);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ processed: (dueEmails ?? []).length, sent, failed }),
    { headers: { "Content-Type": "application/json" } }
  );
});
