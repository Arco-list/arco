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

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Arco <noreply@arcolist.com>'

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
<tr><td style="padding:24px 0 0;border-top:1px solid #e8e8e6;">
<p style="margin:0;font-size:12px;color:#a1a1a0;line-height:1.5;">
<img src="${base}/arco-logo-email.png" alt="Arco" width="36" height="10" style="display:inline-block;vertical-align:middle;opacity:0.4;margin-right:6px;" />Arco Global BV · The professional network architects trust.
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

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e8e8e6;margin:24px 0;" />`
}

function projectCard(vars: EmailVariables): string {
  const title = vars.project_title || vars.project_name || ''
  const subtitle = [vars.project_type, vars.project_location].filter(Boolean).join(' · ')
  const image = vars.project_image
  if (!title) return ''
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
${image ? `<tr><td style="font-size:0;line-height:0;"><img src="${image}" alt="${title}" width="520" style="display:block;width:100%;height:auto;border-radius:8px;" /></td></tr>` : ''}
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
  return {
    subject: `${ownerLabel} credited you on ${projectName}`,
    html: lb(vars, `
      ${heading('You\'ve been credited')}
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
${image ? `<tr><td style="font-size:0;line-height:0;"><img src="${image}" alt="${title}" width="520" style="display:block;width:100%;height:auto;border-radius:8px;" /></td></tr>` : ''}
<tr><td style="padding:14px 0 0;">
<p style="margin:0 0 4px;font-size:15px;font-weight:400;color:#1c1c1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${title}</p>
${subtitle ? `<p style="margin:0;font-size:14px;font-weight:400;color:#a1a1a0;">${subtitle}</p>` : ''}
</td></tr>
</table></a>`
}

function renderTeamInvite(vars: EmailVariables): { subject: string; html: string } {
  return {
    subject: `You're invited to join ${vars.company_name || 'a company'} on Arco`,
    html: lb(vars, `
      ${heading('Team invitation')}
      ${body(`You've been invited to join <strong>${vars.company_name || 'a company'}</strong> on Arco.`)}
      ${body('Accept the invitation to collaborate on your company\'s profile and projects.')}
      ${vars.confirmUrl ? button('Accept invitation', vars.confirmUrl) : ''}
    `),
  }
}

function renderDomainVerification(vars: EmailVariables): { subject: string; html: string } {
  return {
    subject: `${vars.code} is your Arco verification code`,
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
  return {
    subject: 'Welcome to Arco',
    html: lb(vars, `
      ${heading('Welcome to Arco')}
      ${body(`${vars.firstname ? `Hi ${vars.firstname},` : 'Hi,'}<br><br>Thanks for joining Arco — the curated architecture platform where great projects and the professionals behind them get the recognition they deserve.`)}
      ${body('Here\'s what you can do:')}
      ${body(`<strong>Browse projects</strong> — Explore completed architecture and interior design projects from across the Netherlands.<br><br><strong>Discover professionals</strong> — Find architects, interior designers, and builders credited on real work.<br><br><strong>Save your favorites</strong> — Bookmark projects and professionals to revisit later.`)}
      ${button('Explore projects', 'https://www.arcolist.com/projects')}
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
<tr><td style="font-size:0;line-height:0;"><a href="https://www.arcolist.com/projects/${p.slug}" target="_blank"><img src="${p.image}" alt="${p.title}" width="520" style="display:block;width:100%;height:auto;border-radius:8px;" /></a></td></tr>
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
  const heroImageUrl = vars.hero_image_url
  const logoUrl = vars.logo_url
  const subtitle = vars.company_subtitle || ''

  // Company card — matches professional discover card design
  // Skip SVG logos (not supported in email clients) and use initial fallback instead
  const useLogo = logoUrl && !logoUrl.endsWith('.svg')
  const logoBlock = useLogo
    ? `<img src="${logoUrl}" alt="${companyName}" width="36" height="36" style="display:block;width:36px;height:36px;border-radius:50%;object-fit:cover;" />`
    : `<table cellpadding="0" cellspacing="0"><tr><td style="width:36px;height:36px;border-radius:50%;background:#f5f5f4;text-align:center;vertical-align:middle;font-size:14px;font-weight:500;color:#6b6b68;">${companyName.charAt(0)}</td></tr></table>`

  const heroBlock = heroImageUrl
    ? `<img src="${heroImageUrl}" alt="${companyName}" width="520" style="display:block;width:100%;max-width:520px;border-radius:3px;object-fit:cover;" />`
    : ''

  const companyCard = `
    <a href="${companyPageUrl}" target="_blank" style="display:block;text-decoration:none;margin:24px 0;">
      ${heroBlock}
      <table cellpadding="0" cellspacing="0" style="${heroBlock ? 'margin-top:12px;' : ''}"><tr>
        <td style="vertical-align:middle;padding-right:10px;">
          ${logoBlock}
        </td>
        <td style="vertical-align:middle;">
          <p style="margin:0;font-size:15px;font-weight:400;color:#1c1c1a;line-height:1.3;">${companyName}</p>
          ${subtitle ? `<p style="margin:2px 0 0;font-size:13px;font-weight:300;color:#a1a1a0;line-height:1.3;">${subtitle}</p>` : ''}
        </td>
      </tr></table>
    </a>`

  return {
    subject: `Een podium voor ${companyName}`,
    html: baseLayout(`
      ${heading(`Een podium voor ${companyName}`)}
      ${body(`Ik ben Niek, oprichter van Arco — een nieuw professioneel netwerk waar toonaangevende architecten hun beste werk publiceren en de vakmensen waarmee ze samenwerken aanbevelen.`)}
      ${body(`We hebben ${companyName} live gezet op Arco met een bedrijfs- en projectpagina om te laten zien hoe het eruitziet:`)}
      ${companyCard}
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
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
      ...(template === 'prospect-intro' ? { reply_to: 'niek@arcolist.com' } : {}),
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
