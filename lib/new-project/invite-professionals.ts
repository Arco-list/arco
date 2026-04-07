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
  invited_service_category_ids: string[]
  invited_email: string
  professional_id?: string | null
  company_id?: string | null
  status?: 'invited' | 'listed'
  is_project_owner?: boolean
}

/**
 * Create invite with initial 'invited' status
 * Status logic:
 * - Initial status is always 'invited' regardless of whether professional exists
 * - Professional updates status when they respond to invitation
 * - They can choose: unlisted, listed, or live_on_page
 */
export async function createInvite(
  supabase: SupabaseClient,
  inviteData: InviteData
): Promise<{ data: Tables<'project_professionals'> | null; error: any }> {
  try {
    // Always start with 'invited' status
    // Professional will update when they respond to the invitation
    const status = 'invited'
    
    const { data, error } = await supabase
      .from('project_professionals')
      .insert({
        project_id: inviteData.project_id,
        invited_email: inviteData.invited_email,
        invited_service_category_ids: inviteData.invited_service_category_ids,
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

