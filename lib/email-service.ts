'use server'

// Lazy-initialize Resend to avoid crashing at module load if RESEND_API_KEY is missing
let _resend: import('resend').Resend | null = null
function getResend() {
  if (!_resend) {
    const { Resend } = require('resend')
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend!
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Arco <automated@arcolist.com>'

export type EmailTemplate =
  | 'project-live'
  | 'project-rejected'
  | 'professional-invite'
  | 'team-invite'
  | 'domain-verification'
  | 'welcome-homeowner'
  | 'discover-projects'
  | 'find-professionals'
  | 'introduction-request'
  | 'prospect-intro'
  | 'prospect-followup'
  | 'prospect-final'

export interface EmailVariables {
  firstname?: string
  Project_name?: string
  Project_title?: string
  project_name?: string
  project_title?: string
  project_link?: string
  project_image?: string
  project_type?: string
  company_name?: string
  /** Public URL to the company logo. Rendered via companyIcon() — non-SVG only. */
  company_logo_url?: string | null
  project_owner?: string
  project_location?: string
  service_category?: string
  professional_name?: string
  dashboard_link?: string
  rejection_reason?: string
  confirmUrl?: string
  code?: string
  businessname?: string
  client_name?: string
  client_email?: string
  message_preview?: string
  [key: string]: any
}

interface EmailResponse {
  success: boolean
  message?: string
  messageId?: string
}

// ─── Email HTML templates ────────────────────────────────────────────────────

const DEFAULT_LOGO_BASE = 'https://www.arcolist.com'

function baseLayout(content: string, logoBaseUrl?: string): string {
  const base = logoBaseUrl || DEFAULT_LOGO_BASE
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<!-- Logo -->
<tr><td style="padding:0 0 32px;">
<img src="${base}/arco-logo-square.png" alt="Arco" width="40" height="40" style="display:block;border-radius:8px;" />
</td></tr>
<!-- Content -->
<tr><td style="padding:0 0 32px;">
${content}
</td></tr>
<!-- Footer -->
<tr><td style="padding:32px 0 0;border-top:1px solid #e8e8e6;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:8px;">
<img src="${base}/arco-logo-email.png" alt="Arco" width="40" height="11" style="display:block;opacity:0.5;" />
</td>
<td style="vertical-align:middle;">
<p style="margin:0;font-size:12px;font-weight:300;color:#a1a1a0;line-height:1;">The professional network architects trust.</p>
</td>
</tr></table>
<p style="margin:10px 0 0;font-size:10px;color:#c4c4c2;line-height:1.4;">
Arco Global BV · KvK 94568189 · Amsterdam, Netherlands
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

function heading4(text: string): string {
  return `<h4 style="margin:0 0 6px;font-size:18px;font-weight:400;color:#1c1c1a;font-family:Georgia,'Times New Roman',serif;">${text}</h4>`
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

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e8e8e6;margin:24px 0;" />`
}

// ─── Company icon + card helpers ─────────────────────────────────────────────
//
// Used by every email that references a company (prospect-intro/followup/final,
// professional-invite, team-invite). Centralised here so the fallback logic and
// the email-client image hacks live in one place.

/**
 * Some email clients (Gmail's image proxy in particular) cache and sometimes
 * mis-handle Supabase storage URLs that lack a query string — they get served
 * once, then a stale or empty proxy hit replaces them. Appending a stable
 * version param defeats that and is harmless when the upstream ignores it.
 * This is the *email-only* equivalent of cache-busting; we don't do this on
 * the website itself.
 */
function emailImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.includes('?')) return url // already has a query string, leave it
  return `${url}?e=v1`
}

/**
 * Render a small circular company icon. Falls back to a monogram tile (the
 * first letter on a soft surface background, rounded square to match the
 * Arco favicon style) when the company has no usable raster logo. SVG logos
 * are skipped because most webmail clients refuse to render them inline.
 */
function companyIcon(
  companyName: string,
  logoUrl: string | null | undefined,
  size = 36,
): string {
  const safeUrl = logoUrl && !logoUrl.toLowerCase().endsWith('.svg') ? emailImageUrl(logoUrl) : null
  if (safeUrl) {
    return `<img src="${safeUrl}" alt="${companyName}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;" />`
  }
  // Monogram fallback — first letter, soft surface, rounded square (matches the favicon)
  const initial = companyName.trim().charAt(0).toUpperCase() || 'A'
  // Heuristic font sizing: ~55% of the tile so the letter feels balanced.
  const fontSize = Math.round(size * 0.55)
  return `<table cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.22)}px;background:#1c1c1a;color:#ffffff;text-align:center;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:${fontSize}px;font-weight:500;line-height:${size}px;">${initial}</td>
  </tr></table>`
}

/**
 * Render a clickable company "card" — icon + name + optional subtitle, with
 * an optional hero image above. Used by every email that wants to spotlight
 * a specific company. The hero is only included when a URL is supplied.
 */
function companyCard(opts: {
  name: string
  href: string
  logoUrl?: string | null
  heroUrl?: string | null
  subtitle?: string | null
}): string {
  const { name, href, logoUrl, heroUrl, subtitle } = opts
  const heroSafeUrl = emailImageUrl(heroUrl)
  // Email-safe 4:3 frame matching the website's .discover-card-image-wrap.
  // The website uses `aspect-ratio: 4/3` + `object-fit: cover`, but most
  // email clients ignore `aspect-ratio`. The padding-bottom:75% trick is
  // the cross-client standard: a wrapper with 0 height + 75% bottom-padding
  // is exactly 4:3 (75% = 3/4) regardless of width, and the image inside
  // is absolutely positioned to fill it with `object-fit: cover` so it's
  // cropped, not stretched. Width/height attrs are still set so non-CSS
  // clients (Outlook 2016) at least know the intrinsic dimensions.
  const heroBlock = heroSafeUrl
    ? `<div style="width:100%;max-width:420px;">
        <div style="position:relative;width:100%;padding-bottom:75%;border-radius:3px;overflow:hidden;background:#f0f0ee;">
          <img src="${heroSafeUrl}" alt="${name}" width="420" height="315" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block;border-radius:3px;" />
        </div>
      </div>`
    : ''

  return `<a href="${href}" target="_blank" style="display:block;text-decoration:none;margin:24px 0;">
    ${heroBlock}
    <table cellpadding="0" cellspacing="0" style="${heroBlock ? 'margin-top:12px;' : ''}"><tr>
      <td style="vertical-align:middle;padding-right:10px;">
        ${companyIcon(name, logoUrl)}
      </td>
      <td style="vertical-align:middle;">
        <p style="margin:0;font-size:15px;font-weight:400;color:#1c1c1a;line-height:1.3;">${name}</p>
        ${subtitle ? `<p style="margin:2px 0 0;font-size:13px;font-weight:300;color:#a1a1a0;line-height:1.3;">${subtitle}</p>` : ''}
      </td>
    </tr></table>
  </a>`
}

function projectCard(vars: EmailVariables): string {
  const title = vars.project_title || vars.project_name || ''
  const subtitle = [vars.project_type, vars.project_location].filter(Boolean).join(' · ')
  const image = vars.project_image
  if (!title) return ''
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
${image ? `<tr><td style="font-size:0;line-height:0;"><img src="${image}" alt="${title}" width="420" height="315" style="display:block;width:100%;max-width:420px;height:auto;max-height:315px;object-fit:cover;border-radius:3px;" /></td></tr>` : ''}
<tr><td style="padding:14px 0 0;">
<p style="margin:0 0 4px;font-size:15px;font-weight:400;color:#1c1c1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${title}</p>
${subtitle ? `<p style="margin:0;font-size:14px;font-weight:400;color:#a1a1a0;">${subtitle}</p>` : ''}
</td></tr>
</table>`
}

// ─── Template renderers ──────────────────────────────────────────────────────

function lb(vars: EmailVariables, content: string): string {
  return baseLayout(content, vars._logoBaseUrl)
}

function renderProjectLive(vars: EmailVariables): { subject: string; html: string } {
  const projectName = vars.project_title || vars.Project_title || vars.project_name || 'Your project'
  return {
    subject: `${projectName} is now live on Arco`,
    html: lb(vars, `
      ${heading(`${projectName} is live`)}
      ${body(`${vars.firstname ? `Hi ${vars.firstname},` : 'Hi,'}<br><br>Great news — your project is now published and visible on Arco.`)}
      ${projectCard(vars)}
      ${body('Your credited professionals will now be visible on the project page.')}
      ${vars.project_link ? button('View project', vars.project_link) : ''}
    `),
  }
}

function renderProjectRejected(vars: EmailVariables): { subject: string; html: string } {
  const projectName = vars.project_title || vars.Project_title || vars.project_name || 'Your project'
  return {
    subject: `Update on ${projectName}`,
    html: lb(vars, `
      ${heading('Project update')}
      ${body(`${vars.firstname ? `Hi ${vars.firstname},` : 'Hi,'}<br><br>We've reviewed your project and it wasn't approved at this time.`)}
      ${projectCard(vars)}
      ${vars.rejection_reason ? body(`<strong>Reason:</strong> ${vars.rejection_reason}`) : ''}
      ${body('You can update your project and resubmit it for review.')}
      ${vars.dashboard_link ? button('Go to dashboard', vars.dashboard_link) : ''}
    `),
  }
}

function renderProfessionalInvite(vars: EmailVariables): { subject: string; html: string } {
  const projectName = vars.project_title || vars.project_name || 'a project'
  const ownerLabel = vars.company_name || vars.project_owner || 'An architect'
  const projectLink = vars.project_link
  // Inviting-company badge: small icon + name on a single line, above the
  // project card. Only renders if we know the company name.
  const inviterBadge = vars.company_name
    ? `<table cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
        <td style="vertical-align:middle;padding-right:10px;">
          ${companyIcon(vars.company_name, vars.company_logo_url, 32)}
        </td>
        <td style="vertical-align:middle;">
          <p style="margin:0;font-size:14px;font-weight:400;color:#1c1c1a;line-height:1.3;">${vars.company_name}</p>
        </td>
      </tr></table>`
    : ''
  return {
    subject: `${ownerLabel} credited you on ${projectName}`,
    html: lb(vars, `
      ${heading('You\'ve been credited')}
      ${inviterBadge}
      ${body(`${ownerLabel} added your company to a project on Arco.`)}
      ${projectLink ? linkedProjectCard(vars, projectLink) : projectCard(vars)}
      ${body('Accept the invitation to showcase this project on your company page.')}
      ${vars.confirmUrl ? button('View invitation', vars.confirmUrl) : ''}
    `),
  }
}

function linkedProjectCard(vars: EmailVariables, projectLink: string): string {
  const title = vars.project_title || vars.project_name || ''
  const subtitle = [vars.project_type, vars.project_location].filter(Boolean).join(' · ')
  const image = vars.project_image
  if (!title) return ''
  return `<a href="${projectLink}" target="_blank" style="text-decoration:none;color:inherit;display:block;">
<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
${image ? `<tr><td style="font-size:0;line-height:0;"><img src="${image}" alt="${title}" width="420" height="315" style="display:block;width:100%;max-width:420px;height:auto;max-height:315px;object-fit:cover;border-radius:3px;" /></td></tr>` : ''}
<tr><td style="padding:14px 0 0;">
<p style="margin:0 0 4px;font-size:15px;font-weight:400;color:#1c1c1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${title}</p>
${subtitle ? `<p style="margin:0;font-size:14px;font-weight:400;color:#a1a1a0;">${subtitle}</p>` : ''}
</td></tr>
</table></a>`
}

function renderTeamInvite(vars: EmailVariables): { subject: string; html: string } {
  const companyName = vars.company_name || 'a company'
  // Inviting-company badge — same shape as professional-invite for consistency.
  const inviterBadge = vars.company_name
    ? `<table cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
        <td style="vertical-align:middle;padding-right:10px;">
          ${companyIcon(vars.company_name, vars.company_logo_url, 32)}
        </td>
        <td style="vertical-align:middle;">
          <p style="margin:0;font-size:14px;font-weight:400;color:#1c1c1a;line-height:1.3;">${vars.company_name}</p>
        </td>
      </tr></table>`
    : ''
  return {
    subject: `You're invited to join ${companyName} on Arco`,
    html: lb(vars, `
      ${heading('Team invitation')}
      ${inviterBadge}
      ${body(`You've been invited to join <strong>${companyName}</strong> on Arco.`)}
      ${body('Accept the invitation to collaborate on your company\'s profile and projects.')}
      ${vars.confirmUrl ? button('Accept invitation', vars.confirmUrl) : ''}
    `),
  }
}

function renderDomainVerification(vars: EmailVariables): { subject: string; html: string } {
  return {
    subject: `${vars.code} is your Arco domain verification code`,
    html: lb(vars, `
      ${heading('Verify your domain')}
      ${body(`Use this code to verify ownership of <strong>${vars.businessname || 'your company'}</strong>:`)}
      <div style="margin:24px 0;padding:16px;background:#f5f5f4;border-radius:4px;text-align:center;">
        <span style="font-size:32px;font-weight:500;letter-spacing:0.3em;color:#1c1c1a;font-family:monospace;">${vars.code || '------'}</span>
      </div>
      ${body('This code expires in 10 minutes.')}
      ${body('<span style="color:#a1a1a0;font-size:13px;">If you didn\'t request this, you can safely ignore this email.</span>')}
    `),
  }
}

// ─── Homeowner Welcome Series ────────────────────────────────────────────────

function renderWelcomeHomeowner(vars: EmailVariables): { subject: string; html: string } {
  // Sample projects (in production these come from dataVariables)
  const projects = (vars.projects as any[] | undefined) ?? [
    { title: "Villa Oisterwijk", subtitle: "Modern villa · Oisterwijk", image: "https://marcovanveldhuizen.nl/cms/wp-content/uploads/2022/12/MARCO-VAN-VELDHUIZEN_OISTERWIJK-3501-HR-min.jpg", slug: "villa-oisterwijk" },
    { title: "Penthouse Amsterdam", subtitle: "Penthouse · Amsterdam", image: "https://wolterinck.com/wp-content/uploads/2023/11/Wolterinck_Private_Project_Appartment_Amsterdam-08.jpg", slug: "penthouse-amsterdam" },
    { title: "Bos Villa", subtitle: "Villa · Hilversum", image: "https://www.engelarchitecten.nl/wp-content/uploads/2023/03/01_Engel_BosVilla.jpg", slug: "bos-villa" },
  ]
  const center = projects[0]
  const left = projects[1]
  const right = projects[2]

  // All three images use the same height (281px) — narrow side images crop horizontally via object-fit
  const imgHeight = 281
  const projectsBlock = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;">
      <tr>
        <td style="width:14%;padding-right:8px;font-size:0;line-height:0;vertical-align:top;">
          ${left ? `<a href="https://www.arcolist.com/projects/${left.slug}" target="_blank"><img src="${left.image}" alt="" width="73" height="${imgHeight}" style="display:block;width:100%;height:${imgHeight}px;object-fit:cover;border-radius:3px;" /></a>` : ''}
        </td>
        <td style="width:72%;font-size:0;line-height:0;vertical-align:top;">
          ${center ? `<a href="https://www.arcolist.com/projects/${center.slug}" target="_blank" style="text-decoration:none;color:inherit;display:block;">
            <img src="${center.image}" alt="${center.title}" width="375" height="${imgHeight}" style="display:block;width:100%;height:${imgHeight}px;object-fit:cover;border-radius:3px;" />
          </a>` : ''}
        </td>
        <td style="width:14%;padding-left:8px;font-size:0;line-height:0;vertical-align:top;">
          ${right ? `<a href="https://www.arcolist.com/projects/${right.slug}" target="_blank"><img src="${right.image}" alt="" width="73" height="${imgHeight}" style="display:block;width:100%;height:${imgHeight}px;object-fit:cover;border-radius:3px;" /></a>` : ''}
        </td>
      </tr>
    </table>
    ${center ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 0;"><tr><td style="padding:0 0 0 14.5%;">
      <p style="margin:0 0 2px;font-size:15px;font-weight:400;color:#1c1c1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${center.title}</p>
      <p style="margin:0;font-size:13px;font-weight:300;color:#a1a1a0;">${center.subtitle}</p>
    </td></tr></table>` : ''}
  `

  // Sample professionals (in production from dataVariables)
  const professionals = (vars.professionals as any[] | undefined) ?? [
    { name: "Wolterinck", service: "Interior Designer", projectCount: 12, slug: "wolterinck", logo: null, initial: "W" },
    { name: "Engel Architecten", service: "Architect", projectCount: 8, slug: "engel-architecten", logo: null, initial: "E" },
    { name: "Marco van Veldhuizen", service: "Architect", projectCount: 4, slug: "marco-van-veldhuizen", logo: null, initial: "M" },
  ]

  const professionalCard = (p: any) => {
    const iconHtml = p.logo
      ? `<img src="${p.logo}" alt="${p.name}" width="80" height="80" style="display:block;width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto;" />`
      : `<table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="width:80px;height:80px;background:#f5f5f4;border-radius:50%;text-align:center;vertical-align:middle;font-size:26px;font-weight:500;color:#6b6b68;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${p.initial}</td></tr></table>`
    return `
    <a href="https://www.arcolist.com/professionals/${p.slug}" target="_blank" style="text-decoration:none;color:inherit;display:block;text-align:center;">
      <p style="margin:0 0 12px;font-size:10px;font-weight:500;color:#a1a1a0;letter-spacing:0.08em;text-transform:uppercase;">${p.service}</p>
      <div style="margin:0 0 14px;">${iconHtml}</div>
      <p style="margin:0 0 4px;font-size:14px;font-weight:500;color:#1c1c1a;line-height:1.3;">${p.name}</p>
      <p style="margin:0;font-size:12px;font-weight:300;color:#a1a1a0;">${p.projectCount} project${p.projectCount === 1 ? '' : 's'}</p>
    </a>`
  }

  const professionalsBlock = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
      <tr>
        <td style="width:33.33%;padding:0 8px;vertical-align:top;">${professionals[0] ? professionalCard(professionals[0]) : ''}</td>
        <td style="width:33.33%;padding:0 8px;vertical-align:top;">${professionals[1] ? professionalCard(professionals[1]) : ''}</td>
        <td style="width:33.33%;padding:0 8px;vertical-align:top;">${professionals[2] ? professionalCard(professionals[2]) : ''}</td>
      </tr>
    </table>
  `

  return {
    subject: 'Welcome to Arco',
    html: lb(vars, `
      ${heading('Welcome to Arco')}
      ${body(`${vars.firstname ? `Hi ${vars.firstname},` : 'Hi,'}<br><br>Thanks for joining Arco — the curated architecture platform where great projects and the professionals behind them get the recognition they deserve.`)}

      <div style="margin:36px 0 0;">
        ${heading4('Browse projects')}
        <p style="margin:0;font-size:14px;font-weight:300;color:#4a4a48;line-height:1.5;">Explore completed architecture and interior design projects from across the Netherlands.</p>
      </div>
      ${projectsBlock}

      <div style="margin:24px 0 0;text-align:center;">
        ${button('Browse projects', 'https://www.arcolist.com/projects')}
      </div>

      <div style="margin:48px 0 0;height:1px;background:#e8e8e6;"></div>

      <div style="margin:36px 0 0;">
        ${heading4('Discover professionals')}
        <p style="margin:0;font-size:14px;font-weight:300;color:#4a4a48;line-height:1.5;">Find architects, interior designers, and builders credited on real work.</p>
      </div>
      ${professionalsBlock}

      <div style="margin:24px 0 0;text-align:center;">
        ${button('Discover professionals', 'https://www.arcolist.com/professionals')}
      </div>
    `),
  }
}

function renderDiscoverProjects(vars: EmailVariables): { subject: string; html: string } {
  // Preview projects (used in admin preview; real sends use dynamic data from Edge Function)
  const previewProjects = [
    { title: "Villa Oisterwijk", image: "https://marcovanveldhuizen.nl/cms/wp-content/uploads/2022/12/MARCO-VAN-VELDHUIZEN_OISTERWIJK-3501-HR-min.jpg", slug: "villa-oisterwijk", location: "Oisterwijk" },
  ]
  const projectsHtml = previewProjects.map(p =>
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
<tr><td style="font-size:0;line-height:0;"><a href="https://www.arcolist.com/projects/${p.slug}" target="_blank"><img src="${p.image}" alt="${p.title}" width="420" height="315" style="display:block;width:100%;max-width:420px;height:auto;max-height:315px;object-fit:cover;border-radius:3px;" /></a></td></tr>
<tr><td style="padding:10px 0 0;"><a href="https://www.arcolist.com/projects/${p.slug}" target="_blank" style="text-decoration:none;"><p style="margin:0 0 2px;font-size:15px;font-weight:400;color:#1c1c1a;">${p.title}</p><p style="margin:0;font-size:14px;font-weight:400;color:#a1a1a0;">${p.location}</p></a></td></tr>
</table>`
  ).join("")

  return {
    subject: 'Discover projects on Arco',
    html: lb(vars, `
      ${heading('Projects worth exploring')}
      ${body(`${vars.firstname ? `Hi ${vars.firstname},` : 'Hi,'}<br><br>Arco is home to a growing collection of architecture and interior design projects — from modern villas to thoughtful renovations.`)}
      ${projectsHtml}
      ${body('Browse by style, location, building type, and more. Every project credits the professionals who made it happen.')}
      ${button('Browse all projects', 'https://www.arcolist.com/projects')}
    `),
  }
}

function renderFindProfessionals(vars: EmailVariables): { subject: string; html: string } {
  return {
    subject: 'Find the right professional on Arco',
    html: lb(vars, `
      ${heading('Find your team')}
      ${body(`${vars.firstname ? `Hi ${vars.firstname},` : 'Hi,'}<br><br>Looking for an architect or interior designer? On Arco, every professional is credited on real projects — so you can judge them by the work they\'ve delivered, not just what they promise.`)}
      ${body('Browse professionals by service, location, and the projects they\'ve worked on. Save the ones you like and reach out when you\'re ready.')}
      ${button('Discover professionals', 'https://www.arcolist.com/professionals')}
    `),
  }
}

function renderIntroductionRequest(vars: EmailVariables): { subject: string; html: string } {
  const clientName = vars.client_name || 'A client'
  return {
    subject: `${clientName} requested an introduction on Arco`,
    html: lb(vars, `
      ${heading('New introduction request')}
      ${body(`${vars.firstname ? `Hi ${vars.firstname},` : 'Hi,'}<br><br><strong>${clientName}</strong> is interested in working with you and sent a message via Arco.`)}
      <div style="margin:20px 0;padding:16px;background:#f5f5f4;border-radius:4px;">
        <p style="margin:0;font-size:14px;color:#4a4a48;line-height:1.6;white-space:pre-wrap;">${vars.message_preview || ''}</p>
      </div>
      ${vars.client_email ? body(`<strong>Email:</strong> ${vars.client_email}`) : ''}
      ${vars.dashboard_link ? button('View message', vars.dashboard_link) : ''}
    `),
  }
}

function renderProspectIntro(vars: EmailVariables): { subject: string; html: string } {
  const companyName = vars.company_name || 'Uw bedrijf'
  const companyPageUrl = vars.company_page_url || 'https://www.arcolist.com/professionals'
  const claimUrl = vars.claim_url || 'https://www.arcolist.com/businesses/professionals'
  const card = companyCard({
    name: companyName,
    href: companyPageUrl,
    logoUrl: vars.logo_url,
    heroUrl: vars.hero_image_url,
    subtitle: vars.company_subtitle ?? null,
  })

  return {
    subject: `Een podium voor ${companyName}`,
    html: baseLayout(`
      ${heading(`Een podium voor ${companyName}`)}
      ${body(`Ik ben Niek, oprichter van Arco — een nieuw professioneel netwerk waar toonaangevende architecten hun beste werk publiceren en de vakmensen waarmee ze samenwerken aanbevelen.`)}
      ${body(`We hebben ${companyName} live gezet op Arco met een bedrijfs- en projectpagina om te laten zien hoe het eruitziet:`)}
      ${card}
      ${body(`Wil je op Arco? Claim je pagina en krijg volledige controle over je profiel, voeg projecten toe en word zichtbaar voor opdrachtgevers die een professional zoeken om hun project te realiseren.`)}
      ${button(`Claim ${companyName}`, claimUrl)}
      ${body(`Wil je liever dat we de pagina verwijderen? Laat het me weten door op deze email te reageren.`)}
      <p style="margin:0;font-size:15px;font-weight:300;line-height:1.6;color:#4a4a48;">
        Niek van Leeuwen<br/>
        <span style="color:#a1a1a0;">Oprichter, Arco</span>
      </p>
    `),
  }
}

function renderProspectFollowup(vars: EmailVariables): { subject: string; html: string } {
  const companyName = vars.company_name || 'Uw bedrijf'
  const companyPageUrl = vars.company_page_url || 'https://www.arcolist.com/professionals'
  const claimUrl = vars.claim_url || 'https://www.arcolist.com/businesses/professionals'
  const card = companyCard({
    name: companyName,
    href: companyPageUrl,
    logoUrl: vars.logo_url,
    heroUrl: vars.hero_image_url,
    subtitle: vars.company_subtitle ?? null,
  })

  return {
    subject: `${companyName} op Arco`,
    html: baseLayout(`
      ${heading(`${companyName} op Arco`)}
      ${body(`Een paar dagen geleden heb ik een bedrijfs- en projectpagina voor ${companyName} aangemaakt op Arco. Ik wilde even checken of je het gezien hebt.`)}
      ${card}
      ${body(`Op je pagina kunnen opdrachtgevers je werk bekijken en direct contact opnemen. Het enige wat je hoeft te doen is je pagina claimen — het kost minder dan twee minuten en publiceren is gratis.`)}
      ${body(`Na het claimen kun je je profiel aanpassen, projecten toevoegen en zichtbaar worden voor opdrachtgevers in heel Nederland.`)}
      ${button(`Claim ${companyName}`, claimUrl)}
      ${body(`Vragen? Reageer op deze email, ik help je graag.`)}
      <p style="margin:0;font-size:15px;font-weight:300;line-height:1.6;color:#4a4a48;">
        Niek van Leeuwen<br/>
        <span style="color:#a1a1a0;">Oprichter, Arco</span>
      </p>
    `),
  }
}

function renderProspectFinal(vars: EmailVariables): { subject: string; html: string } {
  const companyName = vars.company_name || 'Uw bedrijf'
  const claimUrl = vars.claim_url || 'https://www.arcolist.com/businesses/professionals'
  const companyPageUrl = vars.company_page_url || 'https://www.arcolist.com/professionals'
  const card = companyCard({
    name: companyName,
    href: companyPageUrl,
    logoUrl: vars.logo_url,
    heroUrl: vars.hero_image_url,
    subtitle: vars.company_subtitle ?? null,
  })

  return {
    subject: `Claim ${companyName} op Arco`,
    html: baseLayout(`
      ${heading(`Claim ${companyName} op Arco`)}
      ${body(`Dit is mijn laatste bericht over je pagina op Arco. Ik begrijp dat je het druk hebt — daarom maak ik het kort.`)}
      ${card}
      ${body(`Je bedrijfspagina met projecten staat klaar. Eén klik om te claimen, twee minuten om aan te passen. Daarna ben je vindbaar voor opdrachtgevers die een professional zoeken.`)}
      ${button(`Claim ${companyName}`, claimUrl)}
      ${body(`Geen interesse? Geen probleem — reageer op deze email en ik verwijder je pagina. Geen verdere berichten.`)}
      <p style="margin:0;font-size:15px;font-weight:300;line-height:1.6;color:#4a4a48;">
        Niek van Leeuwen<br/>
        <span style="color:#a1a1a0;">Oprichter, Arco</span>
      </p>
    `),
  }
}

const TEMPLATE_RENDERERS: Record<EmailTemplate, (vars: EmailVariables) => { subject: string; html: string }> = {
  'project-live': renderProjectLive,
  'project-rejected': renderProjectRejected,
  'professional-invite': renderProfessionalInvite,
  'team-invite': renderTeamInvite,
  'domain-verification': renderDomainVerification,
  'welcome-homeowner': renderWelcomeHomeowner,
  'discover-projects': renderDiscoverProjects,
  'find-professionals': renderFindProfessionals,
  'introduction-request': renderIntroductionRequest,
  'prospect-intro': renderProspectIntro,
  'prospect-followup': renderProspectFollowup,
  'prospect-final': renderProspectFinal,
}

/**
 * Render an email template to HTML (for previews)
 */
export async function renderEmailTemplate(
  template: EmailTemplate,
  dataVariables?: EmailVariables,
  logoBaseUrl?: string
): Promise<{ subject: string; html: string } | null> {
  const renderer = TEMPLATE_RENDERERS[template]
  if (!renderer) return null
  const vars = { ...(dataVariables || {}), _logoBaseUrl: logoBaseUrl }
  return renderer(vars)
}

// ─── Send function ───────────────────────────────────────────────────────────

/**
 * Send a transactional email via Resend
 */
export async function sendTransactionalEmail(
  email: string,
  template: EmailTemplate,
  dataVariables?: EmailVariables
): Promise<EmailResponse> {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY environment variable is required')
    return { success: false, message: 'Email service not configured' }
  }

  const renderer = TEMPLATE_RENDERERS[template]
  if (!renderer) {
    console.error(`Template ${template} not found`)
    return { success: false, message: `Template ${template} not configured` }
  }

  const { subject, html } = renderer(dataVariables || {})

  try {
    const { data, error } = await getResend().emails.send({
      from: template.startsWith('prospect-') ? 'Niek van Leeuwen <niek@arcolist.com>' : FROM_EMAIL,
      to: email,
      subject,
      html,
      ...(template.startsWith('prospect-') ? { reply_to: 'niek@arcolist.com' } : {}),
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, message: error.message }
    }

    console.log(`Email sent: ${template} to ${email} (id: ${data?.id})`)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Email service error:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Network error sending email' }
  }
}

// ─── Convenience functions ───────────────────────────────────────────────────

export const sendProjectStatusEmail = async (
  email: string,
  status: 'live' | 'rejected',
  projectData: {
    firstname?: string
    project_title: string
    project_name?: string
    project_image?: string
    project_type?: string
    project_location?: string
    project_link?: string
    dashboard_link?: string
    rejection_reason?: string
  }
): Promise<EmailResponse> => {
  const template = status === 'live' ? 'project-live' : 'project-rejected'
  return sendTransactionalEmail(email, template, projectData)
}

export const sendProfessionalInviteEmail = async (
  email: string,
  inviteData: {
    project_owner: string
    company_name?: string
    project_name: string
    project_title: string
    project_image?: string
    project_type?: string
    project_location?: string
    project_link?: string
    confirmUrl: string
  }
): Promise<EmailResponse> => {
  return sendTransactionalEmail(email, 'professional-invite', inviteData)
}

export const sendDomainVerificationEmail = async (
  email: string,
  data: {
    code: string
    businessname: string
  }
): Promise<EmailResponse> => {
  return sendTransactionalEmail(email, 'domain-verification', data)
}

/**
 * Check if email belongs to existing professional user and generate appropriate URL
 */
export async function checkUserAndGenerateInviteUrl(
  email: string,
  projectId: string
): Promise<{ confirmUrl: string; isExistingProfessional: boolean }> {
  const { createServiceRoleSupabaseClient } = await import('@/lib/supabase/server')
  const { getSiteUrl } = await import('@/lib/utils')
  const supabase = createServiceRoleSupabaseClient()
  const baseUrl = getSiteUrl()

  const { data: { users: allUsers }, error: authError } = await supabase.auth.admin.listUsers()

  if (authError) {
    console.error('Failed to list users:', authError)
    const signupUrl = `${baseUrl}/businesses/professionals?redirectTo=${encodeURIComponent(`/create-company?projectInvite=${projectId}`)}&inviteEmail=${encodeURIComponent(email)}`
    return { confirmUrl: signupUrl, isExistingProfessional: false }
  }

  const user = allUsers?.find(u => u.email?.toLowerCase() === email.toLowerCase())

  if (!user) {
    const signupUrl = `${baseUrl}/businesses/professionals?redirectTo=${encodeURIComponent(`/create-company?projectInvite=${projectId}`)}&inviteEmail=${encodeURIComponent(email)}`
    return { confirmUrl: signupUrl, isExistingProfessional: false }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`id, user_types, professionals(id, company_id)`)
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return {
      confirmUrl: `${baseUrl}/businesses/professionals`,
      isExistingProfessional: false,
    }
  }

  const userTypes = profile.user_types || []
  const isProfessional = userTypes.includes('professional')
  const hasProfessionalRecord = profile.professionals
    ? (Array.isArray(profile.professionals) ? profile.professionals.length > 0 : true)
    : false

  if (isProfessional && hasProfessionalRecord) {
    return { confirmUrl: `${baseUrl}/dashboard/listings`, isExistingProfessional: true }
  } else {
    return {
      confirmUrl: `${baseUrl}/businesses/professionals`,
      isExistingProfessional: false,
    }
  }
}
