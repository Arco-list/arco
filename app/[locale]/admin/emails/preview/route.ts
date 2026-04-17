import { NextRequest, NextResponse } from 'next/server'
import { renderEmailTemplate, type EmailLocale, type EmailTemplate } from '@/lib/email-service'

const TEST_VARS = {
  firstname: 'Niek',
  project_title: 'Villa Oisterwijk',
  project_name: 'Villa Oisterwijk',
  project_owner: 'Marco van Veldhuizen',
  project_type: 'Villa',
  project_location: 'Oisterwijk',
  project_link: 'https://arcolist.com/projects/villa-oisterwijk',
  project_image: 'https://marcovanveldhuizen.nl/cms/wp-content/uploads/2022/12/MARCO-VAN-VELDHUIZEN_OISTERWIJK-3501-HR-min.jpg',
  service_category: 'Villa',
  dashboard_link: 'https://arcolist.com/dashboard',
  confirmUrl: 'https://arcolist.com/dashboard/listings',
  rejection_reason: 'The project photos do not meet our quality guidelines. Please upload higher resolution images and resubmit.',
  company_name: 'Marco van Veldhuizen',
  code: '847291',
  businessname: 'Studio Architectuur',
  company_page_url: 'https://arcolist.com/professionals/marco-van-veldhuizen',
  claim_url: 'https://arcolist.com/businesses/professionals?inviteEmail=info@marcovanveldhuizen.nl',
  hero_image_url: 'https://marcovanveldhuizen.nl/cms/wp-content/uploads/2022/12/MARCO-VAN-VELDHUIZEN_OISTERWIJK-3501-HR-min.jpg',
  logo_url: 'https://ogvobdcrectqsegqrquz.supabase.co/storage/v1/object/public/company-logos/marco-van-veldhuizen.png',
  company_subtitle: 'Architect · Naarden',
}

// Auth email templates (mirror of Edge Function templates for preview purposes)
function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 0 32px;">
<img src="/arco-logo-square.png" alt="Arco" width="40" height="40" style="display:block;border-radius:8px;" />
</td></tr>
<tr><td style="padding:0 0 32px;">
${content}
</td></tr>
<tr><td style="padding:24px 0 0;border-top:1px solid #e8e8e6;">
<p style="margin:0;font-size:12px;color:#a1a1a0;line-height:1.5;">
<img src="/arco-logo-email.png" alt="Arco" width="36" height="10" style="display:inline-block;vertical-align:middle;opacity:0.4;margin-right:6px;" />Arco Global BV · The professional network architects trust.
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:400;color:#1c1c1a;font-family:Georgia,'Times New Roman',serif;">${text}</h1>`
}

function body(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;font-weight:300;line-height:1.6;color:#4a4a48;">${text}</p>`
}

function button(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background:#016D75;border-radius:3px;">
<a href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:400;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${text}</a>
</td></tr>
</table>`
}

function codeBlock(code: string): string {
  return `<div style="margin:24px 0;padding:16px;background:#f5f5f4;border-radius:4px;text-align:center;">
<span style="font-size:32px;font-weight:500;letter-spacing:0.3em;color:#1c1c1a;font-family:monospace;">${code}</span>
</div>`
}

const AUTH_TEMPLATES: Record<string, { subject: string; html: string }> = {
  "magic-link": {
    subject: "847291 is your Arco sign-in code",
    html: baseLayout(`
      ${heading("Sign in to Arco")}
      ${body("Hi Niek,<br><br>Use this code to sign in to your Arco account:")}
      ${codeBlock("847291")}
      ${body("Or click the button below to sign in directly:")}
      ${button("Sign in", "https://arcolist.com")}
      ${body('<span style="color:#a1a1a0;font-size:13px;">This code expires in 10 minutes. If you didn\'t request this, you can safely ignore this email.</span>')}
    `),
  },
  "signup": {
    subject: "847291 is your Arco verification code",
    html: baseLayout(`
      ${heading("Welcome to Arco")}
      ${body("Hi Niek,<br><br>Thanks for signing up. Use this code to confirm your email:")}
      ${codeBlock("847291")}
      ${body("Or click the button below:")}
      ${button("Confirm email", "https://arcolist.com")}
      ${body('<span style="color:#a1a1a0;font-size:13px;">This code expires in 24 hours.</span>')}
    `),
  },
  "password-reset": {
    subject: "Reset your Arco password",
    html: baseLayout(`
      ${heading("Reset your password")}
      ${body("Hi Niek,<br><br>We received a request to reset your password. Click below to choose a new one.")}
      ${button("Reset password", "https://arcolist.com")}
      ${body('<span style="color:#a1a1a0;font-size:13px;">This link expires in 10 minutes. If you didn\'t request this, your password remains unchanged.</span>')}
    `),
  },
}

export async function GET(request: NextRequest) {
  const template = request.nextUrl.searchParams.get('template')
  if (!template) return new NextResponse('Template not found', { status: 404 })

  const origin = request.nextUrl.origin

  // Optional ?locale=nl / ?locale=en — lets the admin preview both
  // languages side by side. Ignored (undefined → renderer default) for
  // templates that don't branch on locale yet.
  const rawLocale = request.nextUrl.searchParams.get('locale')
  const locale: EmailLocale | undefined =
    rawLocale === 'nl' || rawLocale === 'en' ? rawLocale : undefined

  // ?meta=1 → return JSON { subject } instead of the rendered HTML. The
  // preview popup header fetches this to show the real (locale-aware)
  // subject without having to parse the HTML response or hit Resend.
  const wantsMeta = request.nextUrl.searchParams.get('meta') === '1'

  // Check auth templates first
  if (AUTH_TEMPLATES[template]) {
    if (wantsMeta) {
      return NextResponse.json({ subject: AUTH_TEMPLATES[template].subject })
    }
    // Replace relative paths with origin for preview
    const html = AUTH_TEMPLATES[template].html
      .replace(/src="\/arco-logo/g, `src="${origin}/arco-logo`)
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Then check app transactional templates
  const vars: Record<string, any> = { ...TEST_VARS }

  // For templates that render live featured projects/professionals, pull
  // the same data the cron uses for real sends so the preview matches
  // what a real recipient would see. Without this the renderer falls back
  // to its hardcoded sample arrays and the preview looks wrong
  // (e.g. grey initials instead of actual company logos).
  if (template === 'welcome-homeowner' || template === 'discover-projects') {
    try {
      const { fetchFeaturedProjectsForEmail, fetchFeaturedProfessionalsForEmail } = await import(
        '@/lib/email-featured-data'
      )
      const projectLimit = template === 'welcome-homeowner' ? 4 : 3
      const [projects, professionals] = await Promise.all([
        fetchFeaturedProjectsForEmail(projectLimit),
        template === 'welcome-homeowner'
          ? fetchFeaturedProfessionalsForEmail()
          : Promise.resolve([] as Awaited<ReturnType<typeof fetchFeaturedProfessionalsForEmail>>),
      ])
      if (projects.length > 0) vars.projects = projects
      if (template === 'welcome-homeowner' && professionals.length > 0) {
        vars.professionals = professionals
      }
    } catch (err) {
      console.error('[emails/preview] Failed to load featured data:', err)
    }
  }

  const result = await renderEmailTemplate(template as EmailTemplate, vars, origin, locale)
  if (!result) return new NextResponse('Template not found', { status: 404 })

  if (wantsMeta) {
    return NextResponse.json({ subject: result.subject })
  }

  return new NextResponse(result.html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
