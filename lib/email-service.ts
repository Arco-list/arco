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

export interface EmailVariables {
  firstname?: string
  Project_name?: string
  Project_title?: string
  project_name?: string
  project_title?: string
  project_link?: string
  project_image?: string
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
  [key: string]: any
}

interface EmailResponse {
  success: boolean
  message?: string
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
<img src="${base}/arco-logo-square.png" alt="Arco" width="32" height="32" style="display:block;border-radius:6px;" />
</td></tr>
<!-- Content -->
<tr><td style="padding:0 0 32px;">
${content}
</td></tr>
<!-- Footer -->
<tr><td style="padding:24px 0 0;border-top:1px solid #e8e8e6;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="vertical-align:middle;">
<p style="margin:0;font-size:12px;color:#a1a1a0;line-height:1.5;">
Arco Global BV · The professional network architects trust.
</p>
</td>
<td style="vertical-align:middle;text-align:right;">
<img src="${base}/arco-logo-email.png" alt="Arco" width="40" height="11" style="display:inline-block;opacity:0.4;" />
</td>
</tr>
</table>
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
  const subtitle = [vars.service_category, vars.project_location].filter(Boolean).join(' · ')
  const image = vars.project_image
  if (!title) return ''
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:6px;overflow:hidden;">
${image ? `<tr><td>
<div style="width:100%;padding-top:75%;position:relative;overflow:hidden;border-radius:6px 6px 0 0;">
<!--[if mso]><img src="${image}" alt="${title}" width="520" height="390" style="display:block;" /><![endif]-->
<!--[if !mso]><!--><img src="${image}" alt="${title}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block;" /><!--<![endif]-->
</div>
</td></tr>` : ''}
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
      ${vars.project_link ? button('View project', vars.project_link) : ''}
      ${body('Your credited professionals will now be visible on the project page.')}
    `),
  }
}

function renderProjectRejected(vars: EmailVariables): { subject: string; html: string } {
  const projectName = vars.project_title || vars.Project_title || vars.project_name || 'Your project'
  return {
    subject: `Update on ${projectName}`,
    html: lb(vars, `
      ${heading('Project update')}
      ${body(`${vars.firstname ? `Hi ${vars.firstname},` : 'Hi,'}<br><br>We've reviewed <strong>${projectName}</strong> and it wasn't approved at this time.`)}
      ${vars.rejection_reason ? body(`<strong>Reason:</strong> ${vars.rejection_reason}`) : ''}
      ${body('You can update your project and resubmit it for review.')}
      ${vars.dashboard_link ? button('Go to dashboard', vars.dashboard_link) : ''}
    `),
  }
}

function renderProfessionalInvite(vars: EmailVariables): { subject: string; html: string } {
  const projectName = vars.project_title || vars.project_name || 'a project'
  return {
    subject: `${vars.project_owner || 'An architect'} credited you on ${projectName}`,
    html: lb(vars, `
      ${heading('You\'ve been credited')}
      ${body(`${vars.project_owner || 'An architect'} added your company to a project on Arco.`)}
      ${projectCard(vars)}
      ${body('Accept the invitation to showcase this project on your company page.')}
      ${vars.confirmUrl ? button('View invitation', vars.confirmUrl) : ''}
    `),
  }
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

const TEMPLATE_RENDERERS: Record<EmailTemplate, (vars: EmailVariables) => { subject: string; html: string }> = {
  'project-live': renderProjectLive,
  'project-rejected': renderProjectRejected,
  'professional-invite': renderProfessionalInvite,
  'team-invite': renderTeamInvite,
  'domain-verification': renderDomainVerification,
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
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, message: error.message }
    }

    console.log(`Email sent: ${template} to ${email} (id: ${data?.id})`)
    return { success: true }
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
    project_name: string
    project_title: string
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
    const signupUrl = `${baseUrl}/signup?redirectTo=${encodeURIComponent(`/create-company?projectInvite=${projectId}`)}&inviteEmail=${encodeURIComponent(email)}`
    return { confirmUrl: signupUrl, isExistingProfessional: false }
  }

  const user = allUsers?.find(u => u.email?.toLowerCase() === email.toLowerCase())

  if (!user) {
    const signupUrl = `${baseUrl}/signup?redirectTo=${encodeURIComponent(`/create-company?projectInvite=${projectId}`)}&inviteEmail=${encodeURIComponent(email)}`
    return { confirmUrl: signupUrl, isExistingProfessional: false }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`id, user_types, professionals(id, company_id)`)
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return {
      confirmUrl: `${baseUrl}/create-company?projectInvite=${projectId}`,
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
      confirmUrl: `${baseUrl}/create-company?projectInvite=${projectId}`,
      isExistingProfessional: false,
    }
  }
}
