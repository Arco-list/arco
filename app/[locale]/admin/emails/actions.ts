'use server'

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export type ResendEmail = {
  id: string
  from: string
  to: string[]
  subject: string
  created_at: string
  last_event: string
  templateId: string | null
  templateName: string | null
}

const SUBJECT_TO_TEMPLATE: [RegExp, string, string][] = [
  [/is your Arco sign-in code/i, "magic-link", "Sign-in Code"],
  [/is your Arco domain verification code/i, "domain-verification", "Domain Verification"],
  [/is your Arco verification code/i, "signup", "Signup Confirmation"],
  [/Confirm your Arco account/i, "signup", "Signup Confirmation"],
  [/credited you on/i, "professional-invite", "Professional Invite"],
  [/invited to join.*on Arco/i, "team-invite", "Team Invite"],
  [/is now live on Arco/i, "project-live", "Project Live"],
  [/Update on /i, "project-rejected", "Project Rejected"],
  [/Reset your Arco password/i, "password-reset", "Password Reset"],
  [/Sign in to Arco/i, "magic-link", "Sign-in Code"],
  [/Verify your domain/i, "domain-verification", "Domain Verification"],
  [/^Welcome to Arco$/i, "welcome-homeowner", "Welcome"],
  [/Discover projects on Arco/i, "discover-projects", "Discover Projects"],
  [/Find the right professional/i, "find-professionals", "Find Professionals"],
  [/Een podium voor/i, "prospect-intro", "Prospect Intro"],
  [/staat op Arco/i, "prospect-intro", "Prospect Intro"],
  [/is now on Arco/i, "prospect-intro", "Prospect Intro"],
  // Both followup and final subjects end in "op Arco". Final has the
  // distinguishing "Claim …" prefix and MUST be matched first, otherwise
  // the followup's end-anchored pattern would swallow it. Sequence is
  // first-match-wins via matchTemplate().
  [/^Claim .* op Arco$/i, "prospect-final", "Prospect Final"],
  [/op Arco$/i, "prospect-followup", "Prospect Follow-up"],
]

function matchTemplate(subject: string): { id: string; name: string } | null {
  for (const [pattern, id, name] of SUBJECT_TO_TEMPLATE) {
    if (pattern.test(subject)) return { id, name }
  }
  return null
}

export async function fetchRecentEmails(): Promise<{ emails: ResendEmail[]; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { emails: [], error: 'RESEND_API_KEY not configured' }
  }

  try {
    const { data, error } = await resend.emails.list()

    if (error) {
      return { emails: [], error: error.message }
    }

    const emails: ResendEmail[] = (data?.data ?? []).map((e: any) => ({
      id: e.id,
      from: e.from,
      to: Array.isArray(e.to) ? e.to : [e.to],
      subject: e.subject,
      created_at: e.created_at,
      last_event: e.last_event ?? 'sent',
      templateId: matchTemplate(e.subject ?? '')?.id ?? null,
      templateName: matchTemplate(e.subject ?? '')?.name ?? null,
    }))

    return { emails }
  } catch (err) {
    return { emails: [], error: err instanceof Error ? err.message : 'Failed to fetch emails' }
  }
}

export async function fetchEmailById(id: string): Promise<{ email: any; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { email: null, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const { data, error } = await resend.emails.get(id)
    if (error) return { email: null, error: error.message }
    return { email: data }
  } catch (err) {
    return { email: null, error: err instanceof Error ? err.message : 'Failed to fetch email' }
  }
}

export type TemplateStats = {
  sends: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
}

export async function fetchTemplateStats(sinceDate?: string): Promise<{ stats: Record<string, TemplateStats>; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { stats: {}, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const { data, error } = await resend.emails.list()
    if (error) return { stats: {}, error: error.message }

    // Map subject patterns to template IDs
    const subjectToTemplate: [RegExp, string][] = [
      [/is your Arco sign-in code/i, "magic-link"],
      [/is your Arco domain verification code/i, "domain-verification"],
      [/is your Arco verification code/i, "signup"],
      [/Confirm your Arco account/i, "signup"],
      [/credited you on/i, "professional-invite"],
      [/invited to join.*on Arco/i, "team-invite"],
      [/is now live on Arco/i, "project-live"],
      [/Update on /i, "project-rejected"],
      [/Reset your Arco password/i, "password-reset"],
      [/Sign in to Arco/i, "magic-link"],
      [/Verify your domain/i, "domain-verification"],
      [/^Welcome to Arco$/i, "welcome-homeowner"],
      [/Discover projects on Arco/i, "discover-projects"],
      [/Find the right professional/i, "find-professionals"],
      [/Een podium voor/i, "prospect-intro"],
      [/staat op Arco/i, "prospect-intro"],
      [/is now on Arco/i, "prospect-intro"],
      // See note on the matching pattern in SUBJECT_TO_TEMPLATE above.
      // Final must come before followup since both end in "op Arco".
      [/^Claim .* op Arco$/i, "prospect-final"],
      [/op Arco$/i, "prospect-followup"],
    ]

    const stats: Record<string, TemplateStats> = {}

    for (const email of data?.data ?? []) {
      const createdAt = (email as any).created_at
      if (sinceDate && createdAt && new Date(createdAt) < new Date(sinceDate)) continue
      const subject = (email as any).subject ?? ""
      const event = (email as any).last_event ?? "sent"

      let templateId: string | null = null
      for (const [pattern, id] of subjectToTemplate) {
        if (pattern.test(subject)) { templateId = id; break }
      }
      if (!templateId) continue

      if (!stats[templateId]) {
        stats[templateId] = { sends: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }
      }
      stats[templateId].sends++
      if (event === "delivered" || event === "opened" || event === "clicked") stats[templateId].delivered++
      if (event === "opened" || event === "clicked") stats[templateId].opened++
      if (event === "clicked") stats[templateId].clicked++
      if (event === "bounced") stats[templateId].bounced++
    }

    return { stats }
  } catch (err) {
    return { stats: {}, error: err instanceof Error ? err.message : 'Failed to fetch stats' }
  }
}

export async function sendTestEmail(template: string, toEmail: string): Promise<{ success: boolean; error?: string }> {
  const { sendTransactionalEmail } = await import('@/lib/email-service')

  // Test vars need to mirror what real production senders pass, otherwise
  // the rendered preview is misleading (e.g. company card without a hero
  // image, professional-invite without the inviting-company badge). Real
  // values borrowed from Marco van Veldhuizen — a prospected company in
  // production with a real logo + published project photo so the test
  // send looks like an actual send.
  const testVars: Record<string, any> = {
    firstname: 'Test',
    project_title: 'Sample Villa Project',
    project_name: 'Sample Villa Project',
    project_owner: 'Arco Test',
    project_location: 'Amsterdam, Netherlands',
    project_link: 'https://arcolist.com',
    dashboard_link: 'https://arcolist.com/dashboard',
    confirmUrl: 'https://arcolist.com',
    rejection_reason: 'This is a test rejection reason.',
    company_name: 'Marco van Veldhuizen',
    code: '123456',
    businessname: 'Marco van Veldhuizen',
    // Visual fields used by the prospect series (intro/followup/final)
    company_page_url: 'https://www.arcolist.com/professionals/marco-van-veldhuizen',
    claim_url: 'https://www.arcolist.com/businesses/professionals',
    company_subtitle: 'Architect · Oisterwijk',
    logo_url: 'https://ogvobdcrectqsegqrquz.supabase.co/storage/v1/object/public/company-assets/0b3b44d9-92aa-40e2-94e4-972038f8be50/logo/1774966489783-mvv.jpeg',
    hero_image_url: 'https://marcovanveldhuizen.nl/cms/wp-content/uploads/2022/12/04-min.jpg',
    // Visual field used by professional-invite + team-invite
    company_logo_url: 'https://ogvobdcrectqsegqrquz.supabase.co/storage/v1/object/public/company-assets/0b3b44d9-92aa-40e2-94e4-972038f8be50/logo/1774966489783-mvv.jpeg',
  }

  const result = await sendTransactionalEmail(toEmail, template as any, testVars)
  return { success: result.success, error: result.message }
}
