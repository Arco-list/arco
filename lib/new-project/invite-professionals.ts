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
 * @deprecated Use getAvailableProfessionalsAction from /app/new-project/actions.ts instead
 * 
 * This client-side function cannot access auth.users for real emails without service role.
 * The server action provides proper email resolution for all user types.
 * 
 * Migration guide:
 * ```ts
 * // Old (broken for admins):
 * import { getAvailableProfessionals } from "@/lib/new-project/invite-professionals"
 * const { data } = await getAvailableProfessionals(supabase, userTypes, userId)
 * 
 * // New (works for all user types):
 * import { getAvailableProfessionalsAction } from "@/app/new-project/actions"
 * const { data } = await getAvailableProfessionalsAction(userTypes, userId)
 * ```
 */
export async function getAvailableProfessionals(
  supabase: SupabaseClient,
  userTypes: string[],
  userId: string
): Promise<{ data: ProfessionalOption[] | null; error: any }> {
  throw new Error(
    'getAvailableProfessionals is deprecated. Use getAvailableProfessionalsAction from /app/new-project/actions.ts instead. ' +
    'This ensures proper email access via service role for all user types.'
  )
}

/**
 * @deprecated Use findProfessionalByEmailAction from /app/new-project/actions.ts instead
 * 
 * This client-side function cannot access auth.users without service role.
 * The server action provides proper email lookup via service role.
 */
export async function findProfessionalByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ data: ProfessionalOption | null; error: any }> {
  throw new Error(
    'findProfessionalByEmail is deprecated. Use findProfessionalByEmailAction from /app/new-project/actions.ts instead.'
  )
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