"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { ProfessionalOption } from "@/lib/new-project/invite-professionals"

/**
 * Get available professionals for invite flow
 * This replaces the broken client-side getAvailableProfessionals for admin users
 * 
 * - Admin: All active professionals with real emails
 * - Professional: Only themselves with their own email
 * - Client: Empty list (email-only flow)
 */
export async function getAvailableProfessionalsAction(
  userTypes: string[],
  userId: string
): Promise<{ data: ProfessionalOption[] | null; error: any }> {
  try {
    const supabase = createServiceRoleSupabaseClient()
    
    if (userTypes.includes('admin')) {
      // Admin: Get all active professionals
      const { data: professionalsData, error } = await supabase
        .from('professionals')
        .select(`
          id,
          user_id,
          title,
          is_available,
          company_id,
          profiles!professionals_user_id_fkey(
            first_name,
            last_name
          ),
          companies(
            id,
            name,
            city,
            country,
            logo_url,
            status
          )
        `)
        .eq('companies.status', 'listed')
        .eq('is_available', true)

      if (error) {
        return { data: null, error }
      }

      // Get real emails for all professionals using service role
      const professionalsWithEmails = await Promise.all(
        (professionalsData || [])
          .filter((row: any) => row.companies && row.profiles)
          .map(async (row: any) => {
            const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id)
            
            return {
              id: row.id,
              user_id: row.user_id,
              name: `${row.profiles?.first_name || ''} ${row.profiles?.last_name || ''}`.trim() || 'Professional',
              title: row.title || 'Professional',
              email: authUser?.user?.email || '', // Real email from auth.users
              company_id: row.companies.id,
              company: {
                id: row.companies.id,
                name: row.companies.name,
                city: row.companies.city,
                country: row.companies.country,
                logo_url: row.companies.logo_url,
                status: row.companies.status
              }
            }
          })
      )

      // Filter out any without valid emails
      const validProfessionals = professionalsWithEmails.filter(p => p.email)
      
      return { data: validProfessionals, error: null }
      
    } else if (userTypes.includes('professional')) {
      // Professional: Get only themselves
      const { data: professionalsData, error } = await supabase
        .from('professionals')
        .select(`
          id,
          user_id,
          title,
          is_available,
          company_id,
          profiles!professionals_user_id_fkey(
            first_name,
            last_name
          ),
          companies(
            id,
            name,
            city,
            country,
            logo_url,
            status
          )
        `)
        .eq('user_id', userId)
        .eq('is_available', true)
        .eq('companies.status', 'listed')

      if (error) {
        return { data: null, error }
      }

      if (!professionalsData || professionalsData.length === 0) {
        return { data: [], error: null }
      }

      // Get their email from auth
      const { data: authUser } = await supabase.auth.admin.getUserById(userId)
      
      if (!authUser?.user?.email) {
        return { data: [], error: null }
      }

      const professionals: ProfessionalOption[] = professionalsData
        .filter((row: any) => row.companies && row.profiles)
        .map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          name: `${row.profiles?.first_name || ''} ${row.profiles?.last_name || ''}`.trim() || 'Professional',
          title: row.title || 'Professional',
          email: authUser.user.email,
          company_id: row.companies.id,
          company: {
            id: row.companies.id,
            name: row.companies.name,
            city: row.companies.city,
            country: row.companies.country,
            logo_url: row.companies.logo_url,
            status: row.companies.status
          }
        }))

      return { data: professionals, error: null }
      
    } else {
      // Clients: Email-only flow
      return { data: [], error: null }
    }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Get user email by user_id using service role
 * Returns the actual email address from auth.users
 * 
 * @deprecated Use getAvailableProfessionalsAction instead - it returns professionals with emails already populated
 */
export async function getUserEmailAction(
  userId: string
): Promise<{ email: string | null; error: any }> {
  try {
    const supabase = createServiceRoleSupabaseClient()
    
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
    
    if (authError || !authUser.user?.email) {
      return { email: null, error: authError }
    }
    
    return { email: authUser.user.email, error: null }
    
  } catch (error) {
    return { email: null, error }
  }
}

/**
 * Find professional by email using service role to access auth.users
 * Returns professional data if email belongs to a professional user type
 */
export async function findProfessionalByEmailAction(
  email: string
): Promise<{ data: ProfessionalOption | null; error: any }> {
  try {
    const supabase = createServiceRoleSupabaseClient()

    // Get user by email from auth.users (requires service role)
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
    const authUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (authError || !authUser) {
      // Email doesn't exist in system
      return { data: null, error: null }
    }
    
    // Check if user is professional type
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_types')
      .eq('id', authUser.id)
      .maybeSingle()
    
    if (profileError || !profile) {
      return { data: null, error: profileError }
    }
    
    const isProfessional = profile.user_types?.includes('professional')
    
    if (!isProfessional) {
      // User exists but is not professional type (e.g., client only)
      return { data: null, error: null }
    }
    
    // Get professional record with company details
    const { data: professional, error: professionalError } = await supabase
      .from('professionals')
      .select(`
        id,
        user_id,
        title,
        company_id,
        profiles!professionals_user_id_fkey(
          first_name,
          last_name
        ),
        companies(
          id,
          name,
          city,
          country,
          logo_url,
          status
        )
      `)
      .eq('user_id', authUser.id)
      .maybeSingle()
    
    if (professionalError || !professional || !professional.companies) {
      // Professional record doesn't exist or company not found
      return { data: null, error: professionalError }
    }
    
    // Return professional data in expected format
    const professionalOption: ProfessionalOption = {
      id: professional.id,
      user_id: professional.user_id,
      name: `${professional.profiles?.first_name || ''} ${professional.profiles?.last_name || ''}`.trim() || 'Professional',
      title: professional.title || 'Professional',
      email: authUser.email!,
      company_id: professional.companies.id,
      company: {
        id: professional.companies.id,
        name: professional.companies.name,
        city: professional.companies.city,
        country: professional.companies.country,
        logo_url: professional.companies.logo_url,
        status: professional.companies.status
      }
    }
    
    return { data: professionalOption, error: null }
    
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Claim pending invites when user becomes a professional
 * Called after professional record is created in create-company flow
 * Matches invited_email to professional_id and updates status to 'listed'
 */
export async function claimPendingInvitesAction(
  userId: string
): Promise<{ success: boolean; claimedCount: number; error?: any }> {
  try {
    const supabase = createServiceRoleSupabaseClient()
    
    // Get user's email from auth
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
    
    if (authError || !authUser.user?.email) {
      return { success: false, claimedCount: 0, error: authError }
    }
    
    const userEmail = authUser.user.email
    
    // Get professional record
    const { data: professional, error: professionalError } = await supabase
      .from('professionals')
      .select('id, company_id')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (professionalError || !professional) {
      return { success: false, claimedCount: 0, error: professionalError }
    }
    
    // Update all pending invites with matching email
    const { data: updatedInvites, error: updateError } = await supabase
      .from('project_professionals')
      .update({
        professional_id: professional.id,
        company_id: professional.company_id,
        status: 'listed',
        responded_at: new Date().toISOString()
      })
      .eq('invited_email', userEmail)
      .is('professional_id', null)
      .select('id')
    
    if (updateError) {
      return { success: false, claimedCount: 0, error: updateError }
    }
    
    return { 
      success: true, 
      claimedCount: updatedInvites?.length || 0,
      error: null 
    }
    
  } catch (error) {
    return { success: false, claimedCount: 0, error }
  }
}
