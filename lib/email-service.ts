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

/**
 * Languages supported by email templates. Mirrors i18n/config.ts `locales`.
 * When adding a locale: add the tag here, extend the renderer switches in
 * individual templates, and add a resolver branch below if needed.
 */
export type EmailLocale = 'nl' | 'en'
const DEFAULT_LOCALE: EmailLocale = 'en'

/**
 * Resolve the language an email should be sent in given whichever
 * identifier the send site has.
 *
 * Priority:
 *   1. If `userId` is known → read profiles.preferred_language. Falls
 *      through on null so newly signed-up users (no preference yet)
 *      still get a country-based guess if a company is linked.
 *   2. If we can discover a user by `email` (transactional sends where
 *      the recipient is already an Arco account) → same as (1).
 *   3. If `companyId` is known → companies.country (NL/BE → nl, else
 *      fall through to TLD).
 *   4. Email TLD (.nl/.be → nl, else en).
 *   5. Default → en.
 *
 * Returns DEFAULT_LOCALE if nothing resolves. Never throws — on DB
 * errors we log and fall through to the default so a temporary Supabase
 * blip can't stop a transactional email from sending.
 */
export async function resolveRecipientLanguage(opts: {
  userId?: string | null
  companyId?: string | null
  email?: string | null
}): Promise<EmailLocale> {
  const { createServiceRoleSupabaseClient } = await import('@/lib/supabase/server')
  const supabase = createServiceRoleSupabaseClient()

  const asLocale = (v: unknown): EmailLocale | null =>
    v === 'nl' || v === 'en' ? v : null

  // (1) Direct user id
  if (opts.userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', opts.userId)
        .maybeSingle()
      const hit = asLocale(data?.preferred_language)
      if (hit) return hit
    } catch (err) {
      console.warn('[resolveRecipientLanguage] profile lookup by userId failed', err)
    }
  }

  // (2) Lookup by email — the recipient might already have an Arco
  // account even when the send site only has a raw email address (team
  // invites, professional-invite, etc.)
  if (opts.email) {
    try {
      const { data: authResult } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const user = authResult?.users.find(
        (u) => u.email?.toLowerCase() === opts.email!.toLowerCase(),
      )
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('id', user.id)
          .maybeSingle()
        const hit = asLocale(data?.preferred_language)
        if (hit) return hit
      }
    } catch (err) {
      console.warn('[resolveRecipientLanguage] profile lookup by email failed', err)
    }
  }

  // (3) Company country
  if (opts.companyId) {
    try {
      const { data } = await supabase
        .from('companies')
        .select('country')
        .eq('id', opts.companyId)
        .maybeSingle()
      const country = (data?.country ?? '').toUpperCase().trim()
      if (country === 'NL' || country === 'BE' || country === 'NETHERLANDS' || country === 'BELGIUM') {
        return 'nl'
      }
      // Non-Dutch country — fall through to TLD only if TLD adds signal,
      // otherwise the country is authoritative (German company → 'en').
      if (country.length > 0) return DEFAULT_LOCALE
    } catch (err) {
      console.warn('[resolveRecipientLanguage] company country lookup failed', err)
    }
  }

  // (4) Email TLD — only signal left
  if (opts.email) {
    const domain = opts.email.split('@')[1]?.toLowerCase() ?? ''
    if (domain.endsWith('.nl') || domain.endsWith('.be')) return 'nl'
  }

  return DEFAULT_LOCALE
}

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
  | 'auth-confirm-signup'
  | 'auth-magic-link'
  | 'auth-recovery'
  | 'auth-email-change'
  | 'auth-invite'

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

function baseLayout(content: string, logoBaseUrl?: string, locale: EmailLocale = 'en'): string {
  const base = logoBaseUrl || DEFAULT_LOGO_BASE
  const tagline = locale === 'nl'
    ? 'Het professionele netwerk dat architecten vertrouwen.'
    : 'The professional network architects trust.'
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
<p style="margin:0;font-size:12px;font-weight:300;color:#a1a1a0;line-height:1;">${tagline}</p>
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
  // Matches .arco-h4 in globals.css: 15px / Sans / 500 / line-height 1.3.
  return `<h4 style="margin:0 0 6px;font-size:15px;font-weight:500;line-height:1.3;color:#1c1c1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${text}</h4>`
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
 * Rewrite a Supabase storage URL to use the on-the-fly image transform
 * endpoint, returning a URL that delivers a pre-cropped image at the
 * requested dimensions. For non-Supabase URLs the original is returned
 * unchanged (with a cache-busting query param if it has none — see below).
 *
 * Why we need this for email: the website's .discover-card-image-wrap uses
 * `aspect-ratio: 4/3` + `object-fit: cover` to crop. Almost no email client
 * supports `aspect-ratio`, and Gmail in particular strips
 * `position: absolute` from inline styles, which kills the standard
 * padding-bottom:75% workaround as well. The only reliable way to ship a
 * cropped image to email is to deliver an actually-cropped image.
 *
 * Supabase Pro has image transforms enabled at /storage/v1/render/image/...
 * which accept `width`, `height`, and `resize=cover`. Verified working on
 * this project (ogvobdcrectqsegqrquz) on 2026-04-07.
 *
 * The cache-busting `?e=v1` query param on non-transformed URLs is
 * unrelated and exists because Gmail's image proxy occasionally serves
 * stale empty responses for query-less Supabase URLs.
 */
function emailImageUrl(
  url: string | null | undefined,
  transform?: { width: number; height: number },
): string | null {
  if (!url) return null

  const SUPABASE_OBJECT_PREFIX = '/storage/v1/object/public/'
  if (transform && url.includes(SUPABASE_OBJECT_PREFIX)) {
    const transformed = url.replace(SUPABASE_OBJECT_PREFIX, '/storage/v1/render/image/public/')
    const sep = transformed.includes('?') ? '&' : '?'
    return `${transformed}${sep}width=${transform.width}&height=${transform.height}&resize=cover`
  }

  if (url.includes('?')) return url
  return `${url}?e=v1`
}

/**
 * Render a small circular company icon. Falls back to a circular grey
 * monogram (matching the website's .pro-card-logo-placeholder style) when
 * the company has no usable raster logo. SVG logos are skipped because
 * most webmail clients refuse to render them inline.
 *
 * For non-SVG Supabase logos we route through the image transform endpoint
 * to deliver a perfectly cropped square at 2× the display size (retina-ready
 * for the 36px display).
 */
function companyIcon(
  companyName: string,
  logoUrl: string | null | undefined,
  size = 36,
): string {
  const isUsable = logoUrl && !logoUrl.toLowerCase().endsWith('.svg')
  // Request 2× the display size so the icon is sharp on retina mail clients.
  const safeUrl = isUsable
    ? emailImageUrl(logoUrl, { width: size * 2, height: size * 2 })
    : null
  if (safeUrl) {
    return `<img src="${safeUrl}" alt="${companyName}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;" />`
  }

  // Fallback: circular grey background with the first letter centred,
  // matching the website's .pro-card-logo-placeholder. (Earlier version
  // used a black rounded-square tile to match the favicon, but the visual
  // language for the *card* fallback should match the *card placeholder*
  // on the site, which is a circle on the soft surface colour.)
  const initial = companyName.trim().charAt(0).toUpperCase() || 'A'
  const fontSize = Math.round(size * 0.42)
  return `<table cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="width:${size}px;height:${size}px;border-radius:50%;background:#f5f5f4;color:#6b6b68;text-align:center;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:${fontSize}px;font-weight:500;line-height:${size}px;">${initial}</td>
  </tr></table>`
}

/**
 * Render a clickable company "card" — icon + name + optional subtitle, with
 * an optional hero image above. Used by every email that wants to spotlight
 * a specific company. The hero is only included when a URL is supplied.
 *
 * Hero rendering strategy:
 * - Supabase storage URL → routed through the render endpoint with
 *   `resize=cover` so we get an actually-cropped 4:3 image (matches the
 *   website's discover card exactly).
 * - External URL (e.g. a project's own website) → rendered at full
 *   width with native aspect ratio. Imperfect, but every email client
 *   shows it cleanly with no grey filler. We fall back gracefully
 *   instead of trying CSS tricks Gmail strips.
 */
function companyCard(opts: {
  name: string
  href: string
  logoUrl?: string | null
  heroUrl?: string | null
  subtitle?: string | null
}): string {
  const { name, href, logoUrl, heroUrl, subtitle } = opts
  // Hero target: 420×315 (4:3) at 2× = 840×630 for retina sharpness.
  const heroSafeUrl = emailImageUrl(heroUrl, { width: 840, height: 630 })
  const isSupabaseHero =
    !!heroUrl && heroUrl.includes('/storage/v1/object/public/')
  const heroBlock = heroSafeUrl
    ? isSupabaseHero
      ? // Supabase: pre-cropped 4:3 from the render endpoint, fixed dimensions.
        `<div style="width:100%;max-width:420px;">
          <img src="${heroSafeUrl}" alt="${name}" width="420" height="315" style="display:block;width:100%;max-width:420px;height:auto;border-radius:3px;" />
        </div>`
      : // External: render at full width with native aspect ratio.
        `<div style="width:100%;max-width:420px;">
          <img src="${heroSafeUrl}" alt="${name}" width="420" style="display:block;width:100%;max-width:420px;height:auto;border-radius:3px;" />
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

function lb(vars: EmailVariables, content: string, locale: EmailLocale = 'en'): string {
  return baseLayout(content, vars._logoBaseUrl, locale)
}

function renderProjectLive(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const fallbackTitle = locale === 'nl' ? 'Je project' : 'Your project'
  const projectName = vars.project_title || vars.Project_title || vars.project_name || fallbackTitle
  const copy = locale === 'nl'
    ? {
        subject: `${projectName} staat live op Arco`,
        h1: `${projectName} is live`,
        hi: (name?: string) => (name ? `Hoi ${name},` : 'Hoi,'),
        intro: 'Goed nieuws — je project is gepubliceerd en zichtbaar op Arco.',
        credits: 'Je gecrediteerde professionals zijn nu zichtbaar op de projectpagina.',
        button: 'Bekijk project',
      }
    : {
        subject: `${projectName} is now live on Arco`,
        h1: `${projectName} is live`,
        hi: (name?: string) => (name ? `Hi ${name},` : 'Hi,'),
        intro: 'Great news — your project is now published and visible on Arco.',
        credits: 'Your credited professionals will now be visible on the project page.',
        button: 'View project',
      }
  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(`${copy.hi(vars.firstname)}<br><br>${copy.intro}`)}
      ${projectCard(vars)}
      ${body(copy.credits)}
      ${vars.project_link ? button(copy.button, vars.project_link) : ''}
    `, locale),
  }
}

function renderProjectRejected(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const fallbackTitle = locale === 'nl' ? 'Je project' : 'Your project'
  const projectName = vars.project_title || vars.Project_title || vars.project_name || fallbackTitle
  const copy = locale === 'nl'
    ? {
        subject: `Update over ${projectName}`,
        h1: 'Project-update',
        hi: (name?: string) => (name ? `Hoi ${name},` : 'Hoi,'),
        intro: `We hebben je project beoordeeld en het is nu niet goedgekeurd.`,
        reasonLabel: 'Reden',
        resubmit: 'Je kunt je project aanpassen en opnieuw ter beoordeling aanbieden.',
        button: 'Ga naar dashboard',
      }
    : {
        subject: `Update on ${projectName}`,
        h1: 'Project update',
        hi: (name?: string) => (name ? `Hi ${name},` : 'Hi,'),
        intro: `We've reviewed your project and it wasn't approved at this time.`,
        reasonLabel: 'Reason',
        resubmit: 'You can update your project and resubmit it for review.',
        button: 'Go to dashboard',
      }
  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(`${copy.hi(vars.firstname)}<br><br>${copy.intro}`)}
      ${projectCard(vars)}
      ${vars.rejection_reason ? body(`<strong>${copy.reasonLabel}:</strong> ${vars.rejection_reason}`) : ''}
      ${body(copy.resubmit)}
      ${vars.dashboard_link ? button(copy.button, vars.dashboard_link) : ''}
    `, locale),
  }
}

function renderProfessionalInvite(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const projectFallback = locale === 'nl' ? 'een project' : 'a project'
  const ownerFallback = locale === 'nl' ? 'Een architect' : 'An architect'
  const projectName = vars.project_title || vars.project_name || projectFallback
  const ownerLabel = vars.company_name || vars.project_owner || ownerFallback
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
  const copy = locale === 'nl'
    ? {
        subject: `${ownerLabel} heeft je gecrediteerd op ${projectName}`,
        h1: 'Je bent gecrediteerd',
        intro: `${ownerLabel} heeft je bedrijf toegevoegd aan een project op Arco.`,
        accept: 'Accepteer de uitnodiging om dit project te tonen op je bedrijfspagina.',
        button: 'Bekijk uitnodiging',
      }
    : {
        subject: `${ownerLabel} credited you on ${projectName}`,
        h1: "You've been credited",
        intro: `${ownerLabel} added your company to a project on Arco.`,
        accept: 'Accept the invitation to showcase this project on your company page.',
        button: 'View invitation',
      }
  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${inviterBadge}
      ${body(copy.intro)}
      ${projectLink ? linkedProjectCard(vars, projectLink) : projectCard(vars)}
      ${body(copy.accept)}
      ${vars.confirmUrl ? button(copy.button, vars.confirmUrl) : ''}
    `, locale),
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

function renderTeamInvite(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const companyFallback = locale === 'nl' ? 'een bedrijf' : 'a company'
  const companyName = vars.company_name || companyFallback
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
  const copy = locale === 'nl'
    ? {
        subject: `Je bent uitgenodigd om lid te worden van ${companyName} op Arco`,
        h1: 'Uitnodiging voor team',
        intro: `Je bent uitgenodigd om lid te worden van <strong>${companyName}</strong> op Arco.`,
        accept: 'Accepteer de uitnodiging om samen te werken aan het profiel en de projecten van je bedrijf.',
        button: 'Accepteer uitnodiging',
      }
    : {
        subject: `You're invited to join ${companyName} on Arco`,
        h1: 'Team invitation',
        intro: `You've been invited to join <strong>${companyName}</strong> on Arco.`,
        accept: "Accept the invitation to collaborate on your company's profile and projects.",
        button: 'Accept invitation',
      }
  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${inviterBadge}
      ${body(copy.intro)}
      ${body(copy.accept)}
      ${vars.confirmUrl ? button(copy.button, vars.confirmUrl) : ''}
    `, locale),
  }
}

function renderDomainVerification(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const businessFallback = locale === 'nl' ? 'je bedrijf' : 'your company'
  const business = vars.businessname || businessFallback
  const copy = locale === 'nl'
    ? {
        subject: `${vars.code} is je Arco domein-verificatiecode`,
        h1: 'Verifieer je domein',
        intro: `Gebruik deze code om eigendom van <strong>${business}</strong> te verifiëren:`,
        expires: 'Deze code verloopt over 10 minuten.',
        ignore: 'Heb je dit niet aangevraagd? Dan kun je deze email negeren.',
      }
    : {
        subject: `${vars.code} is your Arco domain verification code`,
        h1: 'Verify your domain',
        intro: `Use this code to verify ownership of <strong>${business}</strong>:`,
        expires: 'This code expires in 10 minutes.',
        ignore: "If you didn't request this, you can safely ignore this email.",
      }
  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(copy.intro)}
      <div style="margin:24px 0;padding:16px;background:#f5f5f4;border-radius:4px;text-align:center;">
        <span style="font-size:32px;font-weight:500;letter-spacing:0.3em;color:#1c1c1a;font-family:monospace;">${vars.code || '------'}</span>
      </div>
      ${body(copy.expires)}
      ${body(`<span style="color:#a1a1a0;font-size:13px;">${copy.ignore}</span>`)}
    `, locale),
  }
}

// ─── Homeowner Welcome Series ────────────────────────────────────────────────

function renderWelcomeHomeowner(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const copy = locale === 'nl'
    ? {
        subject: 'Welkom bij Arco',
        h1: 'Welkom bij Arco',
        hi: (name?: string) => (name ? `Hoi ${name},` : 'Hoi,'),
        intro: 'Bedankt voor je aanmelding bij Arco — het platform waar gerealiseerde projecten en de professionals erachter de erkenning krijgen die ze verdienen.',
        projectsHeading: 'Bekijk projecten',
        projectsIntro: 'Ontdek afgeronde architectuur- en interieurontwerpprojecten uit heel Nederland.',
        projectsButton: 'Bekijk projecten',
        professionalsHeading: 'Ontdek professionals',
        professionalsIntro: 'Vind architecten, interieurontwerpers en aannemers en de projecten die ze hebben gerealiseerd.',
        professionalsButton: 'Ontdek professionals',
      }
    : {
        subject: 'Welcome to Arco',
        h1: 'Welcome to Arco',
        hi: (name?: string) => (name ? `Hi ${name},` : 'Hi,'),
        intro: 'Thanks for joining Arco — the curated architecture platform where great projects and the professionals behind them get the recognition they deserve.',
        projectsHeading: 'Browse projects',
        projectsIntro: 'Explore completed architecture and interior design projects from across the Netherlands.',
        projectsButton: 'Browse projects',
        professionalsHeading: 'Discover professionals',
        professionalsIntro: 'Find architects, interior designers, and builders credited on real work.',
        professionalsButton: 'Discover professionals',
      }

  // Featured projects (cron pre-fetches; fallback for admin preview).
  const projects = (vars.projects as any[] | undefined) ?? [
    { title: "Villa Oisterwijk", subtitle: "Modern villa · Oisterwijk", image: "https://marcovanveldhuizen.nl/cms/wp-content/uploads/2022/12/MARCO-VAN-VELDHUIZEN_OISTERWIJK-3501-HR-min.jpg", slug: "villa-oisterwijk" },
    { title: "Penthouse Amsterdam", subtitle: "Penthouse · Amsterdam", image: "https://wolterinck.com/wp-content/uploads/2023/11/Wolterinck_Private_Project_Appartment_Amsterdam-08.jpg", slug: "penthouse-amsterdam" },
    { title: "Bos Villa", subtitle: "Villa · Hilversum", image: "https://www.engelarchitecten.nl/wp-content/uploads/2023/03/01_Engel_BosVilla.jpg", slug: "bos-villa" },
    { title: "Family Home Utrecht", subtitle: "Renovation · Utrecht", image: "https://www.engelarchitecten.nl/wp-content/uploads/2023/03/01_Engel_BosVilla.jpg", slug: "family-home-utrecht" },
  ]

  // 2×2 grid card. Image keeps a fixed aspect ratio via height, full-width
  // inside its cell. Title + subtitle stack underneath.
  const projectCard = (p: any) => p ? `
    <a href="https://www.arcolist.com/projects/${p.slug}" target="_blank" style="text-decoration:none;color:inherit;display:block;">
      <img src="${p.image}" alt="${p.title ?? ''}" width="220" height="160" style="display:block;width:100%;height:160px;object-fit:cover;border-radius:3px;" />
      <p style="margin:10px 0 2px;font-size:14px;font-weight:500;color:#1c1c1a;line-height:1.3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${p.title ?? ''}</p>
      ${p.subtitle ? `<p style="margin:0;font-size:12px;font-weight:300;color:#a1a1a0;line-height:1.4;">${p.subtitle}</p>` : ''}
    </a>` : ''

  const projectsBlock = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;">
      <tr>
        <td style="width:50%;padding:0 6px 12px 0;vertical-align:top;">${projectCard(projects[0])}</td>
        <td style="width:50%;padding:0 0 12px 6px;vertical-align:top;">${projectCard(projects[1])}</td>
      </tr>
      <tr>
        <td style="width:50%;padding:12px 6px 0 0;vertical-align:top;">${projectCard(projects[2])}</td>
        <td style="width:50%;padding:12px 0 0 6px;vertical-align:top;">${projectCard(projects[3])}</td>
      </tr>
    </table>
  `

  // Featured professionals (cron pre-fetches; fallback for admin preview).
  const professionals = (vars.professionals as any[] | undefined) ?? [
    { name: "Wolterinck", service: "Interior Designer", city: "Laren", slug: "wolterinck", logo: null, image: "https://wolterinck.com/wp-content/uploads/2023/11/Wolterinck_Private_Project_Appartment_Amsterdam-08.jpg" },
    { name: "Engel Architecten", service: "Architect", city: "Hilversum", slug: "engel-architecten", logo: null, image: "https://www.engelarchitecten.nl/wp-content/uploads/2023/03/01_Engel_BosVilla.jpg" },
    { name: "Marco van Veldhuizen", service: "Architect", city: "Oisterwijk", slug: "marco-van-veldhuizen", logo: null, image: "https://marcovanveldhuizen.nl/cms/wp-content/uploads/2022/12/MARCO-VAN-VELDHUIZEN_OISTERWIJK-3501-HR-min.jpg" },
    { name: "Studio Piet Boon", service: "Interior Designer", city: "Oostzaan", slug: "studio-piet-boon", logo: null, image: null },
  ]

  // Card layout mirrors the /professionals discover card:
  //   1. 4:3 hero image (cover/hero photo), full card width
  //   2. Info row: 34×34 round logo on the left, stacked title + subtitle
  //   3. .discover-card-title: 15px sans 400 #1c1c1a
  //   4. .discover-card-sub:   13px sans #a1a1a0 — "Service · City"
  //
  // The info row is laid out with a 2-cell table so Gmail honours the
  // logo-left / text-right layout (flex is stripped).
  const professionalCard = (p: any) => {
    if (!p) return ''
    const initial = (p.name ?? '?').charAt(0).toUpperCase()

    // 4:3 image block. Width will be ~220px after the 2-column 50% grid
    // inside the 440px email body; height = 220 × (3/4) ≈ 165.
    const imageHtml = p.image
      ? `<img src="${p.image}" alt="${p.name ?? ''}" width="220" height="165" style="display:block;width:100%;height:165px;object-fit:cover;border-radius:3px;background:#f5f5f4;" />`
      : `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:165px;background:#f5f5f4;border-radius:3px;"></td></tr></table>`

    // Logo (34×34 round). Gmail respects border-radius:50% on <img>.
    const logoHtml = p.logo
      ? `<img src="${p.logo}" alt="" width="34" height="34" style="display:block;width:34px;height:34px;border-radius:50%;object-fit:cover;background:#f5f5f4;" />`
      : `<table cellpadding="0" cellspacing="0"><tr><td style="width:34px;height:34px;background:#f5f5f4;border-radius:50%;text-align:center;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:500;color:#6b6b68;">${initial}</td></tr></table>`

    // Subtitle: "Service · City" — matches the discover card format.
    const parts: string[] = []
    if (p.service) parts.push(p.service)
    if (p.city) parts.push(p.city)
    const subtitle = parts.join(' · ')

    return `
    <a href="https://www.arcolist.com/professionals/${p.slug}" target="_blank" style="text-decoration:none;color:inherit;display:block;">
      ${imageHtml}
      <table cellpadding="0" cellspacing="0" style="margin:12px 0 0;width:100%;">
        <tr>
          <td style="width:34px;padding-right:10px;vertical-align:middle;">${logoHtml}</td>
          <td style="vertical-align:middle;">
            <p style="margin:0 0 2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:400;line-height:1.3;color:#1c1c1a;">${p.name}</p>
            ${subtitle ? `<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:400;line-height:1.4;color:#a1a1a0;">${subtitle}</p>` : ''}
          </td>
        </tr>
      </table>
    </a>`
  }

  const professionalsBlock = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;">
      <tr>
        <td style="width:50%;padding:0 6px 12px 0;vertical-align:top;">${professionalCard(professionals[0])}</td>
        <td style="width:50%;padding:0 0 12px 6px;vertical-align:top;">${professionalCard(professionals[1])}</td>
      </tr>
      <tr>
        <td style="width:50%;padding:12px 6px 0 0;vertical-align:top;">${professionalCard(professionals[2])}</td>
        <td style="width:50%;padding:12px 0 0 6px;vertical-align:top;">${professionalCard(professionals[3])}</td>
      </tr>
    </table>
  `

  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(`${copy.hi(vars.firstname)}<br><br>${copy.intro}`)}

      <div style="margin:36px 0 0;">
        ${heading4(copy.projectsHeading)}
        <p style="margin:0;font-size:14px;font-weight:300;color:#4a4a48;line-height:1.5;">${copy.projectsIntro}</p>
      </div>
      ${projectsBlock}

      <div style="margin:24px 0 0;text-align:center;">
        ${button(copy.projectsButton, 'https://www.arcolist.com/projects')}
      </div>

      <div style="margin:48px 0 0;height:1px;background:#e8e8e6;"></div>

      <div style="margin:36px 0 0;">
        ${heading4(copy.professionalsHeading)}
        <p style="margin:0;font-size:14px;font-weight:300;color:#4a4a48;line-height:1.5;">${copy.professionalsIntro}</p>
      </div>
      ${professionalsBlock}

      <div style="margin:24px 0 0;text-align:center;">
        ${button(copy.professionalsButton, 'https://www.arcolist.com/professionals')}
      </div>
    `, locale),
  }
}

function renderDiscoverProjects(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const copy = locale === 'nl'
    ? {
        subject: 'Ontdek projecten op Arco',
        h1: 'Projecten om te ontdekken',
        hi: (name?: string) => (name ? `Hoi ${name},` : 'Hoi,'),
        intro: 'Arco verzamelt een groeiende collectie architectuur- en interieurontwerpprojecten — van moderne villa\'s tot doordachte renovaties.',
        outro: 'Filter op stijl, locatie, type en meer. Elk project vermeldt de professionals die eraan hebben gewerkt.',
        button: 'Bekijk alle projecten',
      }
    : {
        subject: 'Discover projects on Arco',
        h1: 'Projects worth exploring',
        hi: (name?: string) => (name ? `Hi ${name},` : 'Hi,'),
        intro: 'Arco is home to a growing collection of architecture and interior design projects — from modern villas to thoughtful renovations.',
        outro: 'Browse by style, location, building type, and more. Every project credits the professionals who made it happen.',
        button: 'Browse all projects',
      }

  // Real sends pass `projects` via the drip-queue variables (same shape as
  // welcome-homeowner). The hardcoded list is the sample-data fallback for
  // admin preview sends.
  const projects = (vars.projects as Array<{ title: string; image: string; slug: string; location?: string }> | undefined) ?? [
    { title: "Villa Oisterwijk", image: "https://marcovanveldhuizen.nl/cms/wp-content/uploads/2022/12/MARCO-VAN-VELDHUIZEN_OISTERWIJK-3501-HR-min.jpg", slug: "villa-oisterwijk", location: "Oisterwijk" },
  ]
  const projectsHtml = projects.map(p =>
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
<tr><td style="font-size:0;line-height:0;"><a href="https://www.arcolist.com/projects/${p.slug}" target="_blank"><img src="${p.image}" alt="${p.title}" width="420" height="315" style="display:block;width:100%;max-width:420px;height:auto;max-height:315px;object-fit:cover;border-radius:3px;" /></a></td></tr>
<tr><td style="padding:10px 0 0;"><a href="https://www.arcolist.com/projects/${p.slug}" target="_blank" style="text-decoration:none;"><p style="margin:0 0 2px;font-size:15px;font-weight:400;color:#1c1c1a;">${p.title}</p><p style="margin:0;font-size:14px;font-weight:400;color:#a1a1a0;">${p.location}</p></a></td></tr>
</table>`
  ).join("")

  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(`${copy.hi(vars.firstname)}<br><br>${copy.intro}`)}
      ${projectsHtml}
      ${body(copy.outro)}
      ${button(copy.button, 'https://www.arcolist.com/projects')}
    `, locale),
  }
}

function renderFindProfessionals(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const copy = locale === 'nl'
    ? {
        subject: 'Vind de juiste professional op Arco',
        h1: 'Stel je team samen',
        hi: (name?: string) => (name ? `Hoi ${name},` : 'Hoi,'),
        intro: 'Op zoek naar een architect of interieurontwerper? Op Arco heeft elke professional credits op echte projecten — zo kun je ze beoordelen op wat ze hebben opgeleverd, niet alleen op wat ze beloven.',
        outro: 'Filter op dienst, locatie en de projecten waar ze aan hebben gewerkt. Sla je favorieten op en neem contact op wanneer je er klaar voor bent.',
        button: 'Ontdek professionals',
      }
    : {
        subject: 'Find the right professional on Arco',
        h1: 'Find your team',
        hi: (name?: string) => (name ? `Hi ${name},` : 'Hi,'),
        intro: 'Looking for an architect or interior designer? On Arco, every professional is credited on real projects — so you can judge them by the work they\'ve delivered, not just what they promise.',
        outro: 'Browse professionals by service, location, and the projects they\'ve worked on. Save the ones you like and reach out when you\'re ready.',
        button: 'Discover professionals',
      }

  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(`${copy.hi(vars.firstname)}<br><br>${copy.intro}`)}
      ${body(copy.outro)}
      ${button(copy.button, 'https://www.arcolist.com/professionals')}
    `, locale),
  }
}

function renderIntroductionRequest(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const clientFallback = locale === 'nl' ? 'Een klant' : 'A client'
  const clientName = vars.client_name || clientFallback
  const copy = locale === 'nl'
    ? {
        subject: `${clientName} heeft een kennismaking aangevraagd op Arco`,
        h1: 'Nieuwe kennismakingsaanvraag',
        hi: (name?: string) => (name ? `Hoi ${name},` : 'Hoi,'),
        intro: `<strong>${clientName}</strong> is geïnteresseerd in een samenwerking en heeft een bericht gestuurd via Arco.`,
        emailLabel: 'Email',
        button: 'Bekijk bericht',
      }
    : {
        subject: `${clientName} requested an introduction on Arco`,
        h1: 'New introduction request',
        hi: (name?: string) => (name ? `Hi ${name},` : 'Hi,'),
        intro: `<strong>${clientName}</strong> is interested in working with you and sent a message via Arco.`,
        emailLabel: 'Email',
        button: 'View message',
      }
  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(`${copy.hi(vars.firstname)}<br><br>${copy.intro}`)}
      <div style="margin:20px 0;padding:16px;background:#f5f5f4;border-radius:4px;">
        <p style="margin:0;font-size:14px;color:#4a4a48;line-height:1.6;white-space:pre-wrap;">${vars.message_preview || ''}</p>
      </div>
      ${vars.client_email ? body(`<strong>${copy.emailLabel}:</strong> ${vars.client_email}`) : ''}
      ${vars.dashboard_link ? button(copy.button, vars.dashboard_link) : ''}
    `, locale),
  }
}

function renderProspectIntro(vars: EmailVariables, locale: EmailLocale = 'nl'): { subject: string; html: string } {
  const companyName = vars.company_name || (locale === 'nl' ? 'Uw bedrijf' : 'Your company')
  const companyPageUrl = vars.company_page_url || 'https://www.arcolist.com/professionals'
  const claimUrl = vars.claim_url || 'https://www.arcolist.com/businesses/professionals'
  const card = companyCard({
    name: companyName,
    href: companyPageUrl,
    logoUrl: vars.logo_url,
    heroUrl: vars.hero_image_url,
    subtitle: vars.company_subtitle ?? null,
  })

  const copy = locale === 'en'
    ? {
        subject: `A stage for ${companyName}`,
        h1: `A stage for ${companyName}`,
        intro: `I'm Niek, founder of Arco — a new professional network where leading architects publish their best work and recommend the craftspeople they work with.`,
        livePreview: `We've put ${companyName} live on Arco with a company and project page to show what it looks like:`,
        claimCta: `Want to be on Arco? Claim your page and get full control over your profile, add projects, and become visible to clients looking for a professional to deliver their project.`,
        button: `Claim ${companyName}`,
        opt_out: `Prefer we remove the page? Let me know by replying to this email.`,
        signoffRole: 'Founder, Arco',
      }
    : {
        subject: `Een podium voor ${companyName}`,
        h1: `Een podium voor ${companyName}`,
        intro: `Ik ben Niek, oprichter van Arco — een nieuw professioneel netwerk waar toonaangevende architecten hun beste werk publiceren en de vakmensen waarmee ze samenwerken aanbevelen.`,
        livePreview: `We hebben ${companyName} live gezet op Arco met een bedrijfs- en projectpagina om te laten zien hoe het eruitziet:`,
        claimCta: `Wil je op Arco? Claim je pagina en krijg volledige controle over je profiel, voeg projecten toe en word zichtbaar voor opdrachtgevers die een professional zoeken om hun project te realiseren.`,
        button: `Claim ${companyName}`,
        opt_out: `Wil je liever dat we de pagina verwijderen? Laat het me weten door op deze email te reageren.`,
        signoffRole: 'Oprichter, Arco',
      }

  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(copy.intro)}
      ${body(copy.livePreview)}
      ${card}
      ${body(copy.claimCta)}
      ${button(copy.button, claimUrl)}
      ${body(copy.opt_out)}
      <p style="margin:0;font-size:15px;font-weight:300;line-height:1.6;color:#4a4a48;">
        Niek van Leeuwen<br/>
        <span style="color:#a1a1a0;">${copy.signoffRole}</span>
      </p>
    `, locale),
  }
}

function renderProspectFollowup(vars: EmailVariables, locale: EmailLocale = 'nl'): { subject: string; html: string } {
  const companyName = vars.company_name || (locale === 'nl' ? 'Uw bedrijf' : 'Your company')
  const companyPageUrl = vars.company_page_url || 'https://www.arcolist.com/professionals'
  const claimUrl = vars.claim_url || 'https://www.arcolist.com/businesses/professionals'
  const card = companyCard({
    name: companyName,
    href: companyPageUrl,
    logoUrl: vars.logo_url,
    heroUrl: vars.hero_image_url,
    subtitle: vars.company_subtitle ?? null,
  })

  const copy = locale === 'en'
    ? {
        subject: `${companyName} on Arco`,
        h1: `${companyName} on Arco`,
        intro: `A few days ago I created a company and project page for ${companyName} on Arco. Just checking in to see if you saw it.`,
        valueProp: `On your page, clients can view your work and reach out directly. All you need to do is claim it — takes less than two minutes, and listing is free.`,
        afterClaim: `Once claimed, you can edit your profile, add projects, and become visible to clients across the Netherlands.`,
        button: `Claim ${companyName}`,
        questions: `Questions? Just reply to this email, happy to help.`,
        signoffRole: 'Founder, Arco',
      }
    : {
        subject: `${companyName} op Arco`,
        h1: `${companyName} op Arco`,
        intro: `Een paar dagen geleden heb ik een bedrijfs- en projectpagina voor ${companyName} aangemaakt op Arco. Ik wilde even checken of je het gezien hebt.`,
        valueProp: `Op je pagina kunnen opdrachtgevers je werk bekijken en direct contact opnemen. Het enige wat je hoeft te doen is je pagina claimen — het kost minder dan twee minuten en publiceren is gratis.`,
        afterClaim: `Na het claimen kun je je profiel aanpassen, projecten toevoegen en zichtbaar worden voor opdrachtgevers in heel Nederland.`,
        button: `Claim ${companyName}`,
        questions: `Vragen? Reageer op deze email, ik help je graag.`,
        signoffRole: 'Oprichter, Arco',
      }

  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(copy.intro)}
      ${card}
      ${body(copy.valueProp)}
      ${body(copy.afterClaim)}
      ${button(copy.button, claimUrl)}
      ${body(copy.questions)}
      <p style="margin:0;font-size:15px;font-weight:300;line-height:1.6;color:#4a4a48;">
        Niek van Leeuwen<br/>
        <span style="color:#a1a1a0;">${copy.signoffRole}</span>
      </p>
    `, locale),
  }
}

function renderProspectFinal(vars: EmailVariables, locale: EmailLocale = 'nl'): { subject: string; html: string } {
  const companyName = vars.company_name || (locale === 'nl' ? 'Uw bedrijf' : 'Your company')
  const claimUrl = vars.claim_url || 'https://www.arcolist.com/businesses/professionals'
  const companyPageUrl = vars.company_page_url || 'https://www.arcolist.com/professionals'
  const card = companyCard({
    name: companyName,
    href: companyPageUrl,
    logoUrl: vars.logo_url,
    heroUrl: vars.hero_image_url,
    subtitle: vars.company_subtitle ?? null,
  })

  const copy = locale === 'en'
    ? {
        subject: `Claim ${companyName} on Arco`,
        h1: `Claim ${companyName} on Arco`,
        intro: `This is my last message about your page on Arco. I understand you're busy — so I'll keep it brief.`,
        valueProp: `Your company page with projects is ready. One click to claim, two minutes to customise. After that you're discoverable by clients looking for a professional.`,
        button: `Claim ${companyName}`,
        opt_out: `Not interested? No problem — reply to this email and I'll remove your page. No further messages.`,
        signoffRole: 'Founder, Arco',
      }
    : {
        subject: `Claim ${companyName} op Arco`,
        h1: `Claim ${companyName} op Arco`,
        intro: `Dit is mijn laatste bericht over je pagina op Arco. Ik begrijp dat je het druk hebt — daarom maak ik het kort.`,
        valueProp: `Je bedrijfspagina met projecten staat klaar. Eén klik om te claimen, twee minuten om aan te passen. Daarna ben je vindbaar voor opdrachtgevers die een professional zoeken.`,
        button: `Claim ${companyName}`,
        opt_out: `Geen interesse? Geen probleem — reageer op deze email en ik verwijder je pagina. Geen verdere berichten.`,
        signoffRole: 'Oprichter, Arco',
      }

  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(copy.intro)}
      ${card}
      ${body(copy.valueProp)}
      ${button(copy.button, claimUrl)}
      ${body(copy.opt_out)}
      <p style="margin:0;font-size:15px;font-weight:300;line-height:1.6;color:#4a4a48;">
        Niek van Leeuwen<br/>
        <span style="color:#a1a1a0;">${copy.signoffRole}</span>
      </p>
    `, locale),
  }
}

// ── Auth email templates ─────────────────────────────────────────────────
// Sent via the Supabase Auth Hook (POST /api/auth/send-email) instead of
// Supabase's built-in mailer. Uses the same heading/body/button helpers
// as other transactional emails for a consistent design.

function renderAuthConfirmSignup(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const code = vars.code
  const copy = locale === 'nl'
    ? {
        subject: code ? `${code} is je Arco-verificatiecode` : 'Bevestig je Arco-account',
        h1: 'Welkom bij Arco',
        intro: (name?: string) => `${name ? `Hoi ${name},` : 'Hoi,'}<br><br>Bedankt voor je aanmelding. Gebruik deze code om je e-mailadres te bevestigen:`,
        or: 'Of klik op de knop hieronder:',
        button: 'Bevestig e-mailadres',
        expiry: 'Deze code verloopt over 24 uur.',
      }
    : {
        subject: code ? `${code} is your Arco verification code` : 'Confirm your Arco account',
        h1: 'Welcome to Arco',
        intro: (name?: string) => `${name ? `Hi ${name},` : 'Hi,'}<br><br>Thanks for signing up. Use this code to confirm your email:`,
        or: 'Or click the button below:',
        button: 'Confirm email',
        expiry: 'This code expires in 24 hours.',
      }

  const url = vars.confirmUrl ?? '#'
  const codeBlock = code
    ? `<div style="margin:24px 0;padding:16px;background:#f5f5f4;border-radius:4px;text-align:center;">
        <span style="font-size:32px;font-weight:500;letter-spacing:0.3em;color:#1c1c1a;font-family:monospace;">${code}</span>
      </div>`
    : ''
  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(copy.intro(vars.firstname))}
      ${codeBlock}
      ${codeBlock ? body(copy.or) : ''}
      ${button(copy.button, url)}
      ${body(`<span style="color:#a1a1a0;font-size:13px;">${copy.expiry}</span>`)}
    `, locale),
  }
}

function renderAuthMagicLink(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const code = vars.code
  const copy = locale === 'nl'
    ? {
        subject: code ? `${code} is je Arco-inlogcode` : 'Inloggen bij Arco',
        h1: 'Inloggen bij Arco',
        intro: (name?: string) => `${name ? `Hoi ${name},` : 'Hoi,'}<br><br>Gebruik deze code om in te loggen bij je Arco-account:`,
        or: 'Of klik op de knop hieronder om direct in te loggen:',
        button: 'Inloggen',
        expiry: 'Deze code is 10 minuten geldig. Als je dit niet hebt aangevraagd, kun je deze e-mail negeren.',
      }
    : {
        subject: code ? `${code} is your Arco sign-in code` : 'Sign in to Arco',
        h1: 'Sign in to Arco',
        intro: (name?: string) => `${name ? `Hi ${name},` : 'Hi,'}<br><br>Use this code to sign in to your Arco account:`,
        or: 'Or click the button below to sign in directly:',
        button: 'Sign in',
        expiry: "This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.",
      }

  const url = vars.confirmUrl ?? '#'
  const codeBlock = code
    ? `<div style="margin:24px 0;padding:16px;background:#f5f5f4;border-radius:4px;text-align:center;">
        <span style="font-size:32px;font-weight:500;letter-spacing:0.3em;color:#1c1c1a;font-family:monospace;">${code}</span>
      </div>`
    : ''
  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(copy.intro(vars.firstname))}
      ${codeBlock}
      ${body(copy.or)}
      ${button(copy.button, url)}
      ${body(`<span style="color:#a1a1a0;font-size:13px;">${copy.expiry}</span>`)}
    `, locale),
  }
}

function renderAuthRecovery(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const copy = locale === 'nl'
    ? {
        subject: 'Wachtwoord herstellen',
        h1: 'Wachtwoord herstellen',
        intro: (name?: string) => `${name ? `Hoi ${name},` : 'Hoi,'}<br><br>We hebben een verzoek ontvangen om je wachtwoord te herstellen. Klik hieronder om een nieuw wachtwoord in te stellen.`,
        button: 'Wachtwoord herstellen',
        expiry: 'Deze link verloopt over 10 minuten. Als je dit niet hebt aangevraagd, blijft je wachtwoord ongewijzigd.',
      }
    : {
        subject: 'Reset your Arco password',
        h1: 'Reset your password',
        intro: (name?: string) => `${name ? `Hi ${name},` : 'Hi,'}<br><br>We received a request to reset your password. Click below to choose a new one.`,
        button: 'Reset password',
        expiry: "This link expires in 10 minutes. If you didn't request this, your password remains unchanged.",
      }

  const url = vars.confirmUrl ?? '#'
  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(copy.intro(vars.firstname))}
      ${button(copy.button, url)}
      ${body(`<span style="color:#a1a1a0;font-size:13px;">${copy.expiry}</span>`)}
    `, locale),
  }
}

function renderAuthEmailChange(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const copy = locale === 'nl'
    ? {
        subject: 'Bevestig je nieuwe e-mailadres',
        h1: 'Bevestig e-mailwijziging',
        intro: (name?: string) => `${name ? `Hoi ${name},` : 'Hoi,'}<br><br>Klik hieronder om je nieuwe e-mailadres te bevestigen.`,
        button: 'Bevestig e-mailadres',
        ignore: 'Als je deze wijziging niet hebt aangevraagd, neem dan contact op met support.',
      }
    : {
        subject: 'Confirm your new email address',
        h1: 'Confirm email change',
        intro: (name?: string) => `${name ? `Hi ${name},` : 'Hi,'}<br><br>Click below to confirm your new email address.`,
        button: 'Confirm email',
        ignore: "If you didn't request this change, please contact support.",
      }

  const url = vars.confirmUrl ?? '#'
  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(copy.intro(vars.firstname))}
      ${button(copy.button, url)}
      ${body(`<span style="color:#a1a1a0;font-size:13px;">${copy.ignore}</span>`)}
    `, locale),
  }
}

function renderAuthInvite(vars: EmailVariables, locale: EmailLocale = 'en'): { subject: string; html: string } {
  const copy = locale === 'nl'
    ? {
        subject: 'Je bent uitgenodigd voor Arco',
        h1: 'Je bent uitgenodigd',
        intro: (name?: string) => `${name ? `Hoi ${name},` : 'Hoi,'}<br><br>Je bent uitgenodigd om een account aan te maken op Arco. Klik hieronder om te beginnen.`,
        button: 'Account aanmaken',
      }
    : {
        subject: "You're invited to Arco",
        h1: "You're invited",
        intro: (name?: string) => `${name ? `Hi ${name},` : 'Hi,'}<br><br>You've been invited to create an account on Arco. Click below to get started.`,
        button: 'Create account',
      }

  const url = vars.confirmUrl ?? '#'
  return {
    subject: copy.subject,
    html: lb(vars, `
      ${heading(copy.h1)}
      ${body(copy.intro(vars.firstname))}
      ${button(copy.button, url)}
    `, locale),
  }
}

/**
 * Renderer signature. `locale` is optional today (all renderers return
 * English) so we can introduce it incrementally without touching every
 * template at once. Per-locale rollout happens in PR #2 (welcome
 * client emails) and PR #3 (prospect emails).
 */
type TemplateRenderer = (
  vars: EmailVariables,
  locale?: EmailLocale,
) => { subject: string; html: string }

const TEMPLATE_RENDERERS: Record<EmailTemplate, TemplateRenderer> = {
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
  'auth-confirm-signup': renderAuthConfirmSignup,
  'auth-magic-link': renderAuthMagicLink,
  'auth-recovery': renderAuthRecovery,
  'auth-email-change': renderAuthEmailChange,
  'auth-invite': renderAuthInvite,
}

/**
 * Render an email template to HTML (for previews). Accepts an optional
 * locale so the admin preview route can show both languages side by side
 * once translations land in PR #2/#3.
 */
export async function renderEmailTemplate(
  template: EmailTemplate,
  dataVariables?: EmailVariables,
  logoBaseUrl?: string,
  locale?: EmailLocale,
): Promise<{ subject: string; html: string } | null> {
  const renderer = TEMPLATE_RENDERERS[template]
  if (!renderer) return null
  const vars = { ...(dataVariables || {}), _logoBaseUrl: logoBaseUrl }
  return renderer(vars, locale)
}

// ─── Send function ───────────────────────────────────────────────────────────

/**
 * Send a transactional email via Resend.
 *
 * `opts.userId` / `opts.companyId` are used to resolve the recipient's
 * preferred language at send time (see resolveRecipientLanguage). Pass
 * whichever identifier the call site has:
 *   - Client flows (welcome series, project notifications, password
 *     reset) → `{ userId }`
 *   - Prospect flows (direct send + drip cron) → `{ companyId }`
 *   - Team invite, professional-invite → `{ userId }` when the recipient
 *     already has an account, else `{ companyId }` (or neither — the
 *     resolver falls back to the email TLD as a last guess).
 *
 * When `opts.locale` is passed explicitly, the resolver is skipped — the
 * admin preview route uses this to force a specific language.
 */
export interface SendEmailOptions {
  userId?: string | null
  companyId?: string | null
  /** Override — skip resolver and use this locale verbatim. */
  locale?: EmailLocale
}

export async function sendTransactionalEmail(
  email: string,
  template: EmailTemplate,
  dataVariables?: EmailVariables,
  opts: SendEmailOptions = {},
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

  const locale =
    opts.locale
    ?? (await resolveRecipientLanguage({
      userId: opts.userId,
      companyId: opts.companyId,
      email,
    }))

  const { subject, html } = renderer(dataVariables || {}, locale)

  try {
    const { data, error } = await getResend().emails.send({
      from: template.startsWith('prospect-') ? 'Niek van Leeuwen <niek@arcolist.com>' : FROM_EMAIL,
      to: email,
      subject,
      html,
      // Tag the send with the resolved locale so the admin/sent table
      // can display which language an email went out in without having
      // to reverse-engineer it from the subject line. Resend returns
      // tags on `emails.list()`.
      tags: [
        { name: 'template', value: template },
        { name: 'locale', value: locale },
      ],
      ...(template.startsWith('prospect-') ? { reply_to: 'niek@arcolist.com' } : {}),
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, message: error.message }
    }

    console.log(`Email sent: ${template} to ${email} [${locale}] (id: ${data?.id})`)
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
  },
  opts: SendEmailOptions = {},
): Promise<EmailResponse> => {
  const template = status === 'live' ? 'project-live' : 'project-rejected'
  return sendTransactionalEmail(email, template, projectData, opts)
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
  },
  opts: SendEmailOptions = {},
): Promise<EmailResponse> => {
  return sendTransactionalEmail(email, 'professional-invite', inviteData, opts)
}

export const sendDomainVerificationEmail = async (
  email: string,
  data: {
    code: string
    businessname: string
  },
  opts: SendEmailOptions = {},
): Promise<EmailResponse> => {
  return sendTransactionalEmail(email, 'domain-verification', data, opts)
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
