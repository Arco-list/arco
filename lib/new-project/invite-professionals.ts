/**
 * Professional discovery and invite functions for new project creation flow
 * These functions are specifically for the invite modal and do NOT affect
 * the existing professional discovery system used elsewhere in the app.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Tables } from "@/lib/supabase/types"

// Types for the new project invite flow
export interface ProfessionalOption {
  id: string
  user_id: string
  name: string
  title: string
  email: string
  company_id: string
  company: {
    id: string
    name: string
    city: string | null
    country: string | null
    logo_url: string | null
    status: string
  }
}

export interface InviteData {
  project_id: string
  invited_service_category_id: string
  invited_email: string
  professional_id?: string | null
  company_id?: string | null
  status?: 'invited' | 'listed'
  is_project_owner?: boolean
}

/**
 * Get available professionals based on user type for new project invite flow
 * - Admin: Sees all active professionals with their companies
 * - Professional: Sees only themselves  
 * - Client/Others: No professionals (email-only flow)
 * 
 * Note: We need to get email from auth.users, not profiles table
 */
export async function getAvailableProfessionals(
  supabase: SupabaseClient,
  userTypes: string[],
  userId: string
): Promise<{ data: ProfessionalOption[] | null; error: any }> {
  try {
    if (userTypes.includes('admin')) {
      // Admin sees all active professionals with their companies
      // For now, we'll use a simplified approach without admin.listUsers()
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

      // For admin users, we'll use placeholder emails for now
      // In production, this would need server-side implementation
      const professionals: ProfessionalOption[] = (professionalsData || [])
        .filter((row: any) => row.companies && row.profiles) // Only include rows with valid joins
        .map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          name: `${row.profiles?.first_name || ''} ${row.profiles?.last_name || ''}`.trim() || 'Professional',
          title: row.title || 'Professional',
          email: `professional@${row.companies.name.toLowerCase().replace(/\s+/g, '')}.com`, // Placeholder
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
      
    } else if (userTypes.includes('professional')) {
      // Professional sees only themselves - use a simpler query approach
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

      // Get email from current user session
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        return { data: [], error: null }
      }

      const professionals: ProfessionalOption[] = professionalsData
        .filter((row: any) => row.companies && row.profiles) // Only include rows with valid joins
        .map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          name: `${row.profiles?.first_name || ''} ${row.profiles?.last_name || ''}`.trim() || 'Professional',
          title: row.title || 'Professional',
          email: user.email,
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
      // Clients/others see no professionals, email-only flow
      return { data: [], error: null }
    }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Find professional by email - SERVER ACTION REQUIRED
 * This function checks if an email belongs to an existing professional user
 * Must be called from a server action with service role access to auth.users
 */
export async function findProfessionalByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ data: ProfessionalOption | null; error: any }> {
  try {
    // This is a placeholder - the actual implementation must be in a server action
    // See: /app/new-project/actions.ts for the server-side implementation
    console.warn('findProfessionalByEmail called from client - use server action instead')
    return { data: null, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Create invite with status based on professional existence
 * Status logic:
 * - 'listed': Email belongs to existing professional user (has professional_id)
 * - 'invited': Email is not a professional user yet (professional_id is null)
 */
export async function createInvite(
  supabase: SupabaseClient,
  inviteData: InviteData
): Promise<{ data: Tables<'project_professionals'> | null; error: any }> {
  try {
    // Determine status based on whether we have a professional_id
    // listed = professional exists and is linked
    // invited = email doesn't match a professional user yet
    const status = inviteData.professional_id ? 'listed' : 'invited'
    
    const { data, error } = await supabase
      .from('project_professionals')
      .insert({
        project_id: inviteData.project_id,
        invited_email: inviteData.invited_email,
        invited_service_category_id: inviteData.invited_service_category_id,
        professional_id: inviteData.professional_id || null,
        company_id: inviteData.company_id || null,
        is_project_owner: inviteData.is_project_owner ?? false,
        status
      })
      .select()
      .single()

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Get invite display info for status cards
 */
export function getInviteDisplayInfo(
  invite: Tables<'project_professionals'>,
  professional?: ProfessionalOption
) {
  if (invite.professional_id && professional) {
    return {
      title: professional.company.name,
      subtitle: `${professional.name} (${professional.title})`,
      status: 'Added to project',
      statusClass: 'bg-green-100 text-green-800'
    }
  } else {
    return {
      title: invite.invited_email,
      subtitle: 'Professional invite',
      status: 'Invite pending',
      statusClass: 'bg-amber-100 text-amber-800'
    }
  }
}