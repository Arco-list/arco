'use server'

export type EmailTemplate =
  | 'project-live'
  | 'project-rejected'
  | 'professional-invite'
  | 'team-invite'
  | 'domain-verification'

export interface EmailVariables {
  // User variables
  firstname?: string
  
  // Project variables
  Project_name?: string
  Project_title?: string
  project_name?: string
  project_title?: string
  project_link?: string
  project_image?: string
  
  // Professional variables
  company_name?: string
  project_owner?: string
  project_location?: string
  service_category?: string
  professional_name?: string
  
  // Action variables
  dashboard_link?: string
  rejection_reason?: string
  confirmUrl?: string
  
  // Future extensibility
  [key: string]: any
}

// Template ID mapping - Update these IDs from your Loops dashboard
const EMAIL_TEMPLATES: Record<EmailTemplate, string> = {
  'project-live': 'cmgrix7ib81tdy80igwg27jzi', // Updated with actual template ID
  'project-rejected': 'cmgrir5g76hvnyc0ifadfp7b3', // Add your template ID
  'professional-invite': 'cmh2bhml30enxyw0jgvk31c3s', // Updated with actual template ID
  'team-invite': 'TODO_CREATE_IN_LOOPS', // Create template in Loops.so dashboard
  'domain-verification': 'cmmj0rol708e80i3ropaa8h4d'
}

interface LoopsResponse {
  success: boolean
  message?: string
}

/**
 * Send a transactional email via Loops.so
 * @param email - Recipient email address
 * @param template - Email template type
 * @param dataVariables - Variables to populate in the email template
 * @returns Promise with success status and optional message
 */
export async function sendTransactionalEmail(
  email: string,
  template: EmailTemplate,
  dataVariables?: EmailVariables
): Promise<LoopsResponse> {
  const apiKey = process.env.LOOPS_API_KEY

  if (!apiKey) {
    console.error('LOOPS_API_KEY environment variable is required')
    return { success: false, message: 'Email service not configured' }
  }

  const transactionalId = EMAIL_TEMPLATES[template]

  if (!transactionalId) {
    console.error(`Template ${template} not found in EMAIL_TEMPLATES`)
    return { success: false, message: `Template ${template} not configured` }
  }

  try {
    const response = await fetch('https://app.loops.so/api/v1/transactional', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        transactionalId,
        dataVariables: dataVariables || {}
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Loops API error:', response.status, errorText)
      return { success: false, message: `HTTP ${response.status}: ${errorText}` }
    }

    const result = await response.json() as LoopsResponse

    if (!result.success) {
      console.error('Loops email sending failed:', result.message)
      return { success: false, message: result.message || 'Email sending failed' }
    }

    console.log(`Email sent successfully: ${template} to ${email}`)
    return result
  } catch (error) {
    console.error('Email service network error:', error)
    return { success: false, message: 'Network error sending email' }
  }
}

// Convenience functions for specific email scenarios

/**
 * Send project status update emails (live/rejected)
 */
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
): Promise<LoopsResponse> => {
  const template = status === 'live' ? 'project-live' : 'project-rejected'
  return sendTransactionalEmail(email, template, projectData)
}

/**
 * Send professional invitation email
 */
export const sendProfessionalInviteEmail = async (
  email: string,
  inviteData: {
    project_owner: string
    project_name: string
    project_title: string
    confirmUrl: string
  }
): Promise<LoopsResponse> => {
  return sendTransactionalEmail(email, 'professional-invite', inviteData)
}

/**
 * Send domain verification email with 6-digit code
 */
export const sendDomainVerificationEmail = async (
  email: string,
  data: {
    code: string
    businessname: string
  }
): Promise<LoopsResponse> => {
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

  // Look up user by email using admin API
  const { data: { users: allUsers }, error: authError } = await supabase.auth.admin.listUsers()

  if (authError) {
    console.error('Failed to list users:', authError)
    // Fallback to new user signup on error
    const signupUrl = `${baseUrl}/signup?redirectTo=${encodeURIComponent(`/create-company?projectInvite=${projectId}`)}&inviteEmail=${encodeURIComponent(email)}`
    return {
      confirmUrl: signupUrl,
      isExistingProfessional: false
    }
  }

  const user = allUsers?.find(u => u.email?.toLowerCase() === email.toLowerCase())

  if (!user) {
    // New user - send to signup with redirect to create company
    const signupUrl = `${baseUrl}/signup?redirectTo=${encodeURIComponent(`/create-company?projectInvite=${projectId}`)}&inviteEmail=${encodeURIComponent(email)}`
    return {
      confirmUrl: signupUrl,
      isExistingProfessional: false
    }
  }

  // Now look up profile by user ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id,
      user_types,
      professionals(id, company_id)
    `)
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    // User exists but no profile - send to create company
    return {
      confirmUrl: `${baseUrl}/create-company?projectInvite=${projectId}`,
      isExistingProfessional: false
    }
  }

  // Check user's professional status
  const userTypes = profile.user_types || []
  const isProfessional = userTypes.includes('professional')
  // professionals can be null, an object, or an array depending on the join
  const hasProfessionalRecord = profile.professionals
    ? (Array.isArray(profile.professionals) ? profile.professionals.length > 0 : true)
    : false

  if (isProfessional && hasProfessionalRecord) {
    // Existing professional - send to dashboard
    return {
      confirmUrl: `${baseUrl}/dashboard/listings`,
      isExistingProfessional: true
    }
  } else {
    // Existing user but not professional - send to create company
    return {
      confirmUrl: `${baseUrl}/create-company?projectInvite=${projectId}`,
      isExistingProfessional: false
    }
  }
}