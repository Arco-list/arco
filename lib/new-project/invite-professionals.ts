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

    // A project invite is a deliberate promotion out of the anonymous
    // pool: a linked company still sitting in a pre-claim pool status
    // (added / prospected / unclaimed) moves to 'invited'. Without this,
    // apollo-sourced companies that get invited stay invisible on
    // /admin/companies (its filter admits pre-claim rows only via
    // source direct/manual/invited). Claimed statuses are untouched.
    // Service-role client: the inviter is a regular user and companies
    // has no broad UPDATE policy for them.
    if (!error && inviteData.company_id && !inviteData.is_project_owner) {
      try {
        const { createServiceRoleSupabaseClient } = await import('@/lib/supabase/server')
        const svc = createServiceRoleSupabaseClient()
        const { data: promoted } = await (svc as any)
          .from('companies')
          .update({ status: 'invited' })
          .eq('id', inviteData.company_id)
          .in('status', ['added', 'prospected', 'unclaimed'])
          .select('id')
        if (Array.isArray(promoted) && promoted.length > 0) {
          const { syncCompanyToApollo } = await import('@/lib/company-apollo-sync')
          await syncCompanyToApollo(inviteData.company_id)
        }
      } catch (promoteErr) {
        console.error('[createInvite] company invited-status promotion failed', promoteErr)
      }
    }

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

