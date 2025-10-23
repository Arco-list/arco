"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import type { ProfessionalOption } from "@/lib/new-project/invite-professionals"

/**
 * Get user email by user_id using service role
 * Returns the actual email address from auth.users
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
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserByEmail(email)
    
    if (authError || !authUser.user) {
      // Email doesn't exist in system
      return { data: null, error: null }
    }
    
    // Check if user is professional type
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_types')
      .eq('id', authUser.user.id)
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
      .eq('user_id', authUser.user.id)
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
      email: authUser.user.email!,
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
