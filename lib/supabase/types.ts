export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      apollo_sync_runs: {
        Row: {
          created_at: string
          error_count: number
          finished_at: string | null
          id: string
          kind: string
          last_error: string | null
          list_id: string | null
          started_at: string
          synced_count: number | null
          total_count: number | null
          triggered_by: string
        }
        Insert: {
          created_at?: string
          error_count?: number
          finished_at?: string | null
          id?: string
          kind: string
          last_error?: string | null
          list_id?: string | null
          started_at?: string
          synced_count?: number | null
          total_count?: number | null
          triggered_by: string
        }
        Update: {
          created_at?: string
          error_count?: number
          finished_at?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          list_id?: string | null
          started_at?: string
          synced_count?: number | null
          total_count?: number | null
          triggered_by?: string
        }
        Relationships: []
      }
      brand_retailers: {
        Row: {
          brand_id: string
          created_at: string
          is_official_dealer: boolean
          retailer_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          is_official_dealer?: boolean
          retailer_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          is_official_dealer?: boolean
          retailer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_retailers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_retailers_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          auto_approve_product_links: boolean
          country: string | null
          created_at: string
          description: string | null
          domain: string | null
          founded_year: number | null
          id: string
          is_featured: boolean
          is_verified: boolean
          logo_url: string | null
          name: string
          owner_user_id: string | null
          slug: string
          status: Database["public"]["Enums"]["brand_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          auto_approve_product_links?: boolean
          country?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          founded_year?: number | null
          id?: string
          is_featured?: boolean
          is_verified?: boolean
          logo_url?: string | null
          name: string
          owner_user_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["brand_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          auto_approve_product_links?: boolean
          country?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          founded_year?: number | null
          id?: string
          is_featured?: boolean
          is_verified?: boolean
          logo_url?: string | null
          name?: string
          owner_user_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["brand_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          audience: string
          can_publish_projects: boolean
          category_hierarchy: number | null
          category_type: string | null
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          in_home_carrousel: boolean | null
          is_active: boolean | null
          is_listing_type: boolean
          name: string
          name_nl: string | null
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          audience?: string
          can_publish_projects?: boolean
          category_hierarchy?: number | null
          category_type?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          in_home_carrousel?: boolean | null
          is_active?: boolean | null
          is_listing_type?: boolean
          name: string
          name_nl?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          audience?: string
          can_publish_projects?: boolean
          category_hierarchy?: number | null
          category_type?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          in_home_carrousel?: boolean | null
          is_active?: boolean | null
          is_listing_type?: boolean
          name?: string
          name_nl?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          apollo_account_id: string | null
          audience: string
          auto_approve_projects: boolean
          certificates: string[] | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          domain: string | null
          email: string | null
          first_touch_source: string | null
          founded_year: number | null
          google_place_id: string | null
          hero_photo_project_id: string | null
          hero_photo_url: string | null
          id: string
          is_featured: boolean
          is_verified: boolean | null
          languages: string[] | null
          latitude: number | null
          listed_at: string | null
          logo_url: string | null
          longitude: number | null
          name: string
          onboarded_at: string | null
          owner_id: string | null
          phone: string | null
          primary_service_id: string | null
          seo_canonical_chosen: string | null
          seo_clicks_28d: number | null
          seo_ctr_28d: number | null
          seo_impressions_28d: number | null
          seo_indexation_state: string | null
          seo_indexed: boolean | null
          seo_indexed_at: string | null
          seo_position_28d: number | null
          seo_synced_at: string | null
          services_offered: string[] | null
          setup_completed: boolean
          slug: string | null
          source: Database["public"]["Enums"]["company_source"]
          specialties: string[]
          state_region: string | null
          status: Database["public"]["Enums"]["company_status"]
          team_size_max: number | null
          team_size_min: number | null
          translations: Json | null
          updated_at: string | null
          views_count: number
          website: string | null
        }
        Insert: {
          address?: string | null
          apollo_account_id?: string | null
          audience?: string
          auto_approve_projects?: boolean
          certificates?: string[] | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          email?: string | null
          first_touch_source?: string | null
          founded_year?: number | null
          google_place_id?: string | null
          hero_photo_project_id?: string | null
          hero_photo_url?: string | null
          id?: string
          is_featured?: boolean
          is_verified?: boolean | null
          languages?: string[] | null
          latitude?: number | null
          listed_at?: string | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          onboarded_at?: string | null
          owner_id?: string | null
          phone?: string | null
          primary_service_id?: string | null
          seo_canonical_chosen?: string | null
          seo_clicks_28d?: number | null
          seo_ctr_28d?: number | null
          seo_impressions_28d?: number | null
          seo_indexation_state?: string | null
          seo_indexed?: boolean | null
          seo_indexed_at?: string | null
          seo_position_28d?: number | null
          seo_synced_at?: string | null
          services_offered?: string[] | null
          setup_completed?: boolean
          slug?: string | null
          source?: Database["public"]["Enums"]["company_source"]
          specialties?: string[]
          state_region?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          team_size_max?: number | null
          team_size_min?: number | null
          translations?: Json | null
          updated_at?: string | null
          views_count?: number
          website?: string | null
        }
        Update: {
          address?: string | null
          apollo_account_id?: string | null
          audience?: string
          auto_approve_projects?: boolean
          certificates?: string[] | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          email?: string | null
          first_touch_source?: string | null
          founded_year?: number | null
          google_place_id?: string | null
          hero_photo_project_id?: string | null
          hero_photo_url?: string | null
          id?: string
          is_featured?: boolean
          is_verified?: boolean | null
          languages?: string[] | null
          latitude?: number | null
          listed_at?: string | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          onboarded_at?: string | null
          owner_id?: string | null
          phone?: string | null
          primary_service_id?: string | null
          seo_canonical_chosen?: string | null
          seo_clicks_28d?: number | null
          seo_ctr_28d?: number | null
          seo_impressions_28d?: number | null
          seo_indexation_state?: string | null
          seo_indexed?: boolean | null
          seo_indexed_at?: string | null
          seo_position_28d?: number | null
          seo_synced_at?: string | null
          services_offered?: string[] | null
          setup_completed?: boolean
          slug?: string | null
          source?: Database["public"]["Enums"]["company_source"]
          specialties?: string[]
          state_region?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          team_size_max?: number | null
          team_size_min?: number | null
          translations?: Json | null
          updated_at?: string | null
          views_count?: number
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_hero_photo_project_id_fkey"
            columns: ["hero_photo_project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_hero_photo_project_id_fkey"
            columns: ["hero_photo_project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_hero_photo_project_id_fkey"
            columns: ["hero_photo_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_primary_service_id_fkey"
            columns: ["primary_service_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      company_contacts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          last_contacted_at: string | null
          next_follow_up_at: string | null
          notes: string | null
          person_id: string
          role: Database["public"]["Enums"]["company_contact_role"]
          status: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          last_contacted_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          person_id: string
          role?: Database["public"]["Enums"]["company_contact_role"]
          status?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          last_contacted_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          person_id?: string
          role?: Database["public"]["Enums"]["company_contact_role"]
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id_full"]
          },
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      company_outreach: {
        Row: {
          claimed_at: string | null
          clicked_at: string | null
          company_id: string
          created_at: string
          email_to: string
          id: string
          last_event_cached: string | null
          last_event_cached_at: string | null
          opened_at: string | null
          resend_message_id: string | null
          sent_at: string
          template: string
        }
        Insert: {
          claimed_at?: string | null
          clicked_at?: string | null
          company_id: string
          created_at?: string
          email_to: string
          id?: string
          last_event_cached?: string | null
          last_event_cached_at?: string | null
          opened_at?: string | null
          resend_message_id?: string | null
          sent_at?: string
          template?: string
        }
        Update: {
          claimed_at?: string | null
          clicked_at?: string | null
          company_id?: string
          created_at?: string
          email_to?: string
          id?: string
          last_event_cached?: string | null
          last_event_cached_at?: string | null
          opened_at?: string | null
          resend_message_id?: string | null
          sent_at?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_outreach_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_outreach_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_outreach_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id_full"]
          },
          {
            foreignKeyName: "company_outreach_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_outreach_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      company_photos: {
        Row: {
          alt_text: string | null
          caption: string | null
          company_id: string
          created_at: string
          file_size: number | null
          height: number | null
          id: string
          is_cover: boolean
          order_index: number
          storage_path: string | null
          updated_at: string
          url: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          company_id: string
          created_at?: string
          file_size?: number | null
          height?: number | null
          id?: string
          is_cover?: boolean
          order_index?: number
          storage_path?: string | null
          updated_at?: string
          url: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          company_id?: string
          created_at?: string
          file_size?: number | null
          height?: number | null
          id?: string
          is_cover?: boolean
          order_index?: number
          storage_path?: string | null
          updated_at?: string
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id_full"]
          },
          {
            foreignKeyName: "company_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      company_redirects: {
        Row: {
          company_id: string
          created_at: string
          id: string
          new_slug: string
          old_slug: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          new_slug: string
          old_slug: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          new_slug?: string
          old_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_redirects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_redirects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_redirects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id_full"]
          },
          {
            foreignKeyName: "company_redirects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_redirects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      company_social_links: {
        Row: {
          company_id: string
          created_at: string
          id: string
          platform: Database["public"]["Enums"]["company_social_platform"]
          updated_at: string
          url: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          platform: Database["public"]["Enums"]["company_social_platform"]
          updated_at?: string
          url: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["company_social_platform"]
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_social_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_social_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_social_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id_full"]
          },
          {
            foreignKeyName: "company_social_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_social_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_verification_codes: {
        Row: {
          code: string
          created_at: string
          domain: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          domain: string
          expires_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          domain?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      email_drip_queue: {
        Row: {
          attempt_count: number
          cancelled_at: string | null
          cancelled_reason: string | null
          clicked_at: string | null
          company_id: string | null
          created_at: string | null
          email: string
          id: string
          last_error: string | null
          last_event_cached: string | null
          last_event_cached_at: string | null
          opened_at: string | null
          resend_message_id: string | null
          send_at: string
          sent_at: string | null
          sequence: string
          step: number
          template: string
          user_id: string | null
          variables: Json | null
        }
        Insert: {
          attempt_count?: number
          cancelled_at?: string | null
          cancelled_reason?: string | null
          clicked_at?: string | null
          company_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          last_error?: string | null
          last_event_cached?: string | null
          last_event_cached_at?: string | null
          opened_at?: string | null
          resend_message_id?: string | null
          send_at: string
          sent_at?: string | null
          sequence: string
          step?: number
          template: string
          user_id?: string | null
          variables?: Json | null
        }
        Update: {
          attempt_count?: number
          cancelled_at?: string | null
          cancelled_reason?: string | null
          clicked_at?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          last_error?: string | null
          last_event_cached?: string | null
          last_event_cached_at?: string | null
          opened_at?: string | null
          resend_message_id?: string | null
          send_at?: string
          sent_at?: string | null
          sequence?: string
          step?: number
          template?: string
          user_id?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_drip_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drip_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "email_drip_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id_full"]
          },
          {
            foreignKeyName: "email_drip_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "email_drip_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          campaign_id: string | null
          campaign_kind: string | null
          campaign_position: number | null
          created_at: string
          event_type: string
          id: string
          locale: string | null
          metadata: Json | null
          occurred_at: string
          prospect_id: string | null
          provider: string
          provider_event_id: string
          recipient_company_id: string | null
          recipient_email: string
          recipient_user_id: string | null
          subject: string | null
          template: string | null
        }
        Insert: {
          campaign_id?: string | null
          campaign_kind?: string | null
          campaign_position?: number | null
          created_at?: string
          event_type: string
          id?: string
          locale?: string | null
          metadata?: Json | null
          occurred_at: string
          prospect_id?: string | null
          provider: string
          provider_event_id: string
          recipient_company_id?: string | null
          recipient_email: string
          recipient_user_id?: string | null
          subject?: string | null
          template?: string | null
        }
        Update: {
          campaign_id?: string | null
          campaign_kind?: string | null
          campaign_position?: number | null
          created_at?: string
          event_type?: string
          id?: string
          locale?: string | null
          metadata?: Json | null
          occurred_at?: string
          prospect_id?: string | null
          provider?: string
          provider_event_id?: string
          recipient_company_id?: string | null
          recipient_email?: string
          recipient_user_id?: string | null
          subject?: string | null
          template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_recipient_company_id_fkey"
            columns: ["recipient_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_recipient_company_id_fkey"
            columns: ["recipient_company_id"]
            isOneToOne: false
            referencedRelation: "company_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "email_events_recipient_company_id_fkey"
            columns: ["recipient_company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id_full"]
          },
          {
            foreignKeyName: "email_events_recipient_company_id_fkey"
            columns: ["recipient_company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "email_events_recipient_company_id_fkey"
            columns: ["recipient_company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_stats_cache: {
        Row: {
          bounced: number
          cached_at: string
          clicked: number
          delivered: number
          opened: number
          sends: number
          template_id: string
        }
        Insert: {
          bounced?: number
          cached_at?: string
          clicked?: number
          delivered?: number
          opened?: number
          sends?: number
          template_id: string
        }
        Update: {
          bounced?: number
          cached_at?: string
          clicked?: number
          delivered?: number
          opened?: number
          sends?: number
          template_id?: string
        }
        Relationships: []
      }
      gmail_connections: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          created_at: string
          gmail_address: string
          id: string
          last_history_id: string | null
          last_sync_at: string | null
          last_sync_error: string | null
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          gmail_address: string
          id?: string
          last_history_id?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          gmail_address?: string
          id?: string
          last_history_id?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gsc_sync_runs: {
        Row: {
          companies_synced: number | null
          created_at: string
          error_count: number
          finished_at: string | null
          id: string
          last_error: string | null
          projects_synced: number | null
          started_at: string
          total_count: number | null
          triggered_by: string
        }
        Insert: {
          companies_synced?: number | null
          created_at?: string
          error_count?: number
          finished_at?: string | null
          id?: string
          last_error?: string | null
          projects_synced?: number | null
          started_at?: string
          total_count?: number | null
          triggered_by: string
        }
        Update: {
          companies_synced?: number | null
          created_at?: string
          error_count?: number
          finished_at?: string | null
          id?: string
          last_error?: string | null
          projects_synced?: number | null
          started_at?: string
          total_count?: number | null
          triggered_by?: string
        }
        Relationships: []
      }
      hero_covers: {
        Row: {
          created_at: string | null
          id: string
          photo_url: string
          project_id: string
          scope: string
          slot: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          photo_url: string
          project_id: string
          scope?: string
          slot: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          photo_url?: string
          project_id?: string
          scope?: string
          slot?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hero_covers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_covers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_covers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_emails: {
        Row: {
          ai_draft_text: string | null
          body_html: string | null
          body_text: string | null
          created_at: string
          from_email: string
          from_name: string | null
          id: string
          metadata: Json | null
          prospect_id: string | null
          provider: string
          provider_message_id: string
          received_at: string
          replied_at: string | null
          replied_text: string | null
          snippet: string | null
          status: string
          subject: string | null
          thread_id: string | null
          to_emails: string[]
          updated_at: string
        }
        Insert: {
          ai_draft_text?: string | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          from_email: string
          from_name?: string | null
          id?: string
          metadata?: Json | null
          prospect_id?: string | null
          provider?: string
          provider_message_id: string
          received_at: string
          replied_at?: string | null
          replied_text?: string | null
          snippet?: string | null
          status?: string
          subject?: string | null
          thread_id?: string | null
          to_emails?: string[]
          updated_at?: string
        }
        Update: {
          ai_draft_text?: string | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          from_email?: string
          from_name?: string | null
          id?: string
          metadata?: Json | null
          prospect_id?: string | null
          provider?: string
          provider_message_id?: string
          received_at?: string
          replied_at?: string | null
          replied_text?: string | null
          snippet?: string | null
          status?: string
          subject?: string | null
          thread_id?: string | null
          to_emails?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_emails_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string
          id: string
          language: string
          metadata: Json | null
          source: string
          source_key: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding: string
          id?: string
          language: string
          metadata?: Json | null
          source: string
          source_key: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          language?: string
          metadata?: Json | null
          source?: string
          source_key?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          application_id: string | null
          attachments: string[] | null
          company_id: string | null
          content: string
          created_at: string | null
          id: string
          is_archived: boolean | null
          is_read: boolean | null
          message_type: string | null
          project_id: string | null
          read_at: string | null
          recipient_id: string
          sender_email: string | null
          sender_id: string
          sender_phone: string | null
          sent_at: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          application_id?: string | null
          attachments?: string[] | null
          company_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          message_type?: string | null
          project_id?: string | null
          read_at?: string | null
          recipient_id: string
          sender_email?: string | null
          sender_id: string
          sender_phone?: string | null
          sent_at?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          application_id?: string | null
          attachments?: string[] | null
          company_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          message_type?: string | null
          project_id?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_email?: string | null
          sender_id?: string
          sender_phone?: string | null
          sent_at?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id_full"]
          },
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_cache: {
        Row: {
          granularity: string
          metric_key: string
          period_start: string
          synced_at: string
          value: number
        }
        Insert: {
          granularity: string
          metric_key: string
          period_start: string
          synced_at?: string
          value: number
        }
        Update: {
          granularity?: string
          metric_key?: string
          period_start?: string
          synced_at?: string
          value?: number
        }
        Relationships: []
      }
      outbound_contact_log: {
        Row: {
          body: string | null
          company_contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["outbound_kind"]
          outcome: Database["public"]["Enums"]["outbound_outcome"] | null
          prospect_id: string | null
        }
        Insert: {
          body?: string | null
          company_contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["outbound_kind"]
          outcome?: Database["public"]["Enums"]["outbound_outcome"] | null
          prospect_id?: string | null
        }
        Update: {
          body?: string | null
          company_contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["outbound_kind"]
          outcome?: Database["public"]["Enums"]["outbound_outcome"] | null
          prospect_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_contact_log_company_contact_id_fkey"
            columns: ["company_contact_id"]
            isOneToOne: false
            referencedRelation: "company_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_contact_log_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_contact_log_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          auth_user_id: string | null
          bounced_at: string | null
          complained_at: string | null
          created_at: string
          email: string
          email_status: string | null
          emails_clicked: number
          emails_delivered: number
          emails_opened: number
          emails_sent: number
          first_name: string | null
          id: string
          last_email_clicked_at: string | null
          last_email_opened_at: string | null
          last_email_sent_at: string | null
          last_name: string | null
          notes: string | null
          phone: string | null
          phone_country_code: string | null
          preferred_language: string | null
          replied_at: string | null
          sequence_status: string | null
          source: Database["public"]["Enums"]["person_source"]
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          bounced_at?: string | null
          complained_at?: string | null
          created_at?: string
          email: string
          email_status?: string | null
          emails_clicked?: number
          emails_delivered?: number
          emails_opened?: number
          emails_sent?: number
          first_name?: string | null
          id?: string
          last_email_clicked_at?: string | null
          last_email_opened_at?: string | null
          last_email_sent_at?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          phone_country_code?: string | null
          preferred_language?: string | null
          replied_at?: string | null
          sequence_status?: string | null
          source?: Database["public"]["Enums"]["person_source"]
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          bounced_at?: string | null
          complained_at?: string | null
          created_at?: string
          email?: string
          email_status?: string | null
          emails_clicked?: number
          emails_delivered?: number
          emails_opened?: number
          emails_sent?: number
          first_name?: string | null
          id?: string
          last_email_clicked_at?: string | null
          last_email_opened_at?: string | null
          last_email_sent_at?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          phone_country_code?: string | null
          preferred_language?: string | null
          replied_at?: string | null
          sequence_status?: string | null
          source?: Database["public"]["Enums"]["person_source"]
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pinterest_auth: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          id: number
          refresh_token: string | null
          refresh_token_expires_at: string | null
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          id?: number
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          id?: number
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pinterest_boards: {
        Row: {
          board_id: string | null
          board_name: string | null
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          space_id: string | null
          updated_at: string
        }
        Insert: {
          board_id?: string | null
          board_name?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          space_id?: string | null
          updated_at?: string
        }
        Update: {
          board_id?: string | null
          board_name?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          space_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinterest_boards_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinterest_boards_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pinterest_queue: {
        Row: {
          action: string
          attempts: number
          cancelled_at: string | null
          cancelled_reason: string | null
          created_at: string
          id: string
          last_error: string | null
          processed_at: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          attempts?: number
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          attempts?: number
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      posthog_cache: {
        Row: {
          data: Json
          fetched_at: string
          timeframe: string
        }
        Insert: {
          data: Json
          fetched_at?: string
          timeframe: string
        }
        Update: {
          data?: Json
          fetched_at?: string
          timeframe?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_families: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          hero_image_url: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_families_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      product_photos: {
        Row: {
          alt_text: string | null
          attribution: string | null
          created_at: string
          height: number | null
          id: string
          is_primary: boolean
          order_index: number
          product_id: string
          url: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          attribution?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          order_index?: number
          product_id: string
          url: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          attribution?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          order_index?: number
          product_id?: string
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_photos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string
          category_id: string | null
          created_at: string
          description: string | null
          family_id: string | null
          id: string
          is_featured: boolean
          name: string
          scraped_at: string | null
          slug: string
          source_url: string | null
          spec_groups: Json | null
          spec_order: Json | null
          specs: Json | null
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
          variants: Json | null
        }
        Insert: {
          brand_id: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          family_id?: string | null
          id?: string
          is_featured?: boolean
          name: string
          scraped_at?: string | null
          slug: string
          source_url?: string | null
          spec_groups?: Json | null
          spec_order?: Json | null
          specs?: Json | null
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
          variants?: Json | null
        }
        Update: {
          brand_id?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          family_id?: string | null
          id?: string
          is_featured?: boolean
          name?: string
          scraped_at?: string | null
          slug?: string
          source_url?: string | null
          spec_groups?: Json | null
          spec_order?: Json | null
          specs?: Json | null
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
          variants?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          bio: string | null
          company_id: string | null
          created_at: string | null
          hourly_rate_max: number | null
          hourly_rate_min: number | null
          id: string
          is_available: boolean | null
          is_featured: boolean | null
          is_verified: boolean | null
          languages_spoken: string[] | null
          portfolio_url: string | null
          services_offered: string[] | null
          title: string
          updated_at: string | null
          user_id: string
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          company_id?: string | null
          created_at?: string | null
          hourly_rate_max?: number | null
          hourly_rate_min?: number | null
          id?: string
          is_available?: boolean | null
          is_featured?: boolean | null
          is_verified?: boolean | null
          languages_spoken?: string[] | null
          portfolio_url?: string | null
          services_offered?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          company_id?: string | null
          created_at?: string | null
          hourly_rate_max?: number | null
          hourly_rate_min?: number | null
          id?: string
          is_available?: boolean | null
          is_featured?: boolean | null
          is_verified?: boolean | null
          languages_spoken?: string[] | null
          portfolio_url?: string | null
          services_offered?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id_full"]
          },
          {
            foreignKeyName: "professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_role: Database["public"]["Enums"]["admin_role"] | null
          avatar_storage_path: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          first_name: string | null
          first_touch_source: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          is_verified: boolean | null
          last_name: string | null
          location: string | null
          notification_preferences: Json
          phone: string | null
          preferred_language: string | null
          updated_at: string | null
          user_types: string[] | null
          website: string | null
        }
        Insert: {
          admin_role?: Database["public"]["Enums"]["admin_role"] | null
          avatar_storage_path?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          first_name?: string | null
          first_touch_source?: string | null
          id: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          last_name?: string | null
          location?: string | null
          notification_preferences?: Json
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string | null
          user_types?: string[] | null
          website?: string | null
        }
        Update: {
          admin_role?: Database["public"]["Enums"]["admin_role"] | null
          avatar_storage_path?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          first_name?: string | null
          first_touch_source?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          last_name?: string | null
          location?: string | null
          notification_preferences?: Json
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string | null
          user_types?: string[] | null
          website?: string | null
        }
        Relationships: []
      }
      project_categories: {
        Row: {
          category_id: string
          created_at: string | null
          is_primary: boolean | null
          project_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          is_primary?: boolean | null
          project_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          is_primary?: boolean | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_category_attributes: {
        Row: {
          category_id: string
          created_at: string
          is_building_feature: boolean
          is_listable: boolean
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          is_building_feature?: boolean
          is_listable?: boolean
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          is_building_feature?: boolean
          is_listable?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_category_attributes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      project_features: {
        Row: {
          category_id: string | null
          cover_photo_id: string | null
          created_at: string
          description: string | null
          id: string
          is_building_default: boolean
          is_highlighted: boolean
          name: string
          order_index: number
          pinterest_pin_id: string | null
          pinterest_sync_error: string | null
          pinterest_synced_at: string | null
          project_id: string
          space_id: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cover_photo_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_building_default?: boolean
          is_highlighted?: boolean
          name: string
          order_index?: number
          pinterest_pin_id?: string | null
          pinterest_sync_error?: string | null
          pinterest_synced_at?: string | null
          project_id: string
          space_id?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cover_photo_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_building_default?: boolean
          is_highlighted?: boolean
          name?: string
          order_index?: number
          pinterest_pin_id?: string | null
          pinterest_sync_error?: string | null
          pinterest_synced_at?: string | null
          project_id?: string
          space_id?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_features_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_features_cover_photo_id_fkey"
            columns: ["cover_photo_id"]
            isOneToOne: false
            referencedRelation: "project_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_features_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_features_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_features_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_features_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_likes: {
        Row: {
          created_at: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_likes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_likes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_likes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_photos: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string | null
          feature_id: string | null
          file_size: number | null
          height: number | null
          id: string
          is_primary: boolean | null
          order_index: number | null
          project_id: string
          storage_path: string | null
          updated_at: string | null
          url: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string | null
          feature_id?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          is_primary?: boolean | null
          order_index?: number | null
          project_id: string
          storage_path?: string | null
          updated_at?: string | null
          url: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string | null
          feature_id?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          is_primary?: boolean | null
          order_index?: number | null
          project_id?: string
          storage_path?: string | null
          updated_at?: string | null
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_photos_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "project_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_products: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          photo_id: string
          pin_x: number | null
          pin_y: number | null
          product_id: string
          project_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          source: Database["public"]["Enums"]["product_link_source"]
          status: Database["public"]["Enums"]["product_link_status"]
          suggested_by_user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          photo_id: string
          pin_x?: number | null
          pin_y?: number | null
          product_id: string
          project_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          source: Database["public"]["Enums"]["product_link_source"]
          status?: Database["public"]["Enums"]["product_link_status"]
          suggested_by_user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          photo_id?: string
          pin_x?: number | null
          pin_y?: number | null
          product_id?: string
          project_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          source?: Database["public"]["Enums"]["product_link_source"]
          status?: Database["public"]["Enums"]["product_link_status"]
          suggested_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_products_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "project_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_professional_services: {
        Row: {
          created_at: string
          id: string
          project_id: string
          service_category_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          service_category_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          service_category_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_professional_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_professional_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_professional_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_professional_services_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      project_professionals: {
        Row: {
          company_id: string | null
          cover_photo_id: string | null
          created_at: string
          id: string
          invited_at: string
          invited_email: string
          invited_service_category_ids: string[] | null
          is_project_owner: boolean
          landing_visited_at: string | null
          professional_id: string | null
          project_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["professional_project_status"]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          cover_photo_id?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_email: string
          invited_service_category_ids?: string[] | null
          is_project_owner?: boolean
          landing_visited_at?: string | null
          professional_id?: string | null
          project_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["professional_project_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          cover_photo_id?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_email?: string
          invited_service_category_ids?: string[] | null
          is_project_owner?: boolean
          landing_visited_at?: string | null
          professional_id?: string | null
          project_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["professional_project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "project_professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id_full"]
          },
          {
            foreignKeyName: "project_professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "project_professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_professionals_cover_photo_id_fkey"
            columns: ["cover_photo_id"]
            isOneToOne: false
            referencedRelation: "project_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_professionals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_professionals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_professionals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_redirects: {
        Row: {
          created_at: string | null
          id: string
          new_slug: string
          old_slug: string
          project_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          new_slug: string
          old_slug: string
          project_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          new_slug?: string
          old_slug?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_redirects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_redirects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_redirects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_taxonomy_options: {
        Row: {
          budget_level:
            | Database["public"]["Enums"]["project_budget_level"]
            | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          name_nl: string | null
          size_max_sqm: number | null
          size_min_sqm: number | null
          slug: string
          sort_order: number | null
          taxonomy_type: Database["public"]["Enums"]["project_taxonomy_type"]
          updated_at: string | null
        }
        Insert: {
          budget_level?:
            | Database["public"]["Enums"]["project_budget_level"]
            | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          name_nl?: string | null
          size_max_sqm?: number | null
          size_min_sqm?: number | null
          slug: string
          sort_order?: number | null
          taxonomy_type: Database["public"]["Enums"]["project_taxonomy_type"]
          updated_at?: string | null
        }
        Update: {
          budget_level?:
            | Database["public"]["Enums"]["project_budget_level"]
            | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          name_nl?: string | null
          size_max_sqm?: number | null
          size_min_sqm?: number | null
          slug?: string
          sort_order?: number | null
          taxonomy_type?: Database["public"]["Enums"]["project_taxonomy_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      project_taxonomy_selections: {
        Row: {
          created_at: string
          id: string
          notes: Json | null
          project_id: string
          taxonomy_option_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: Json | null
          project_id: string
          taxonomy_option_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: Json | null
          project_id?: string
          taxonomy_option_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_taxonomy_selections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_taxonomy_selections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_taxonomy_selections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_taxonomy_selections_taxonomy_option_id_fkey"
            columns: ["taxonomy_option_id"]
            isOneToOne: false
            referencedRelation: "project_taxonomy_options"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_formatted: string | null
          address_postal_code: string | null
          address_region: string | null
          address_street: string | null
          budget_level:
            | Database["public"]["Enums"]["project_budget_level"]
            | null
          budget_max: number | null
          budget_min: number | null
          building_type: string | null
          building_year: number | null
          client_id: string | null
          completion_date: string | null
          created_at: string | null
          description: string | null
          features: string[] | null
          id: string
          is_featured: boolean | null
          latitude: number | null
          likes_count: number | null
          location: string | null
          longitude: number | null
          pinterest_pin_id: string | null
          pinterest_sync_error: string | null
          pinterest_synced_at: string | null
          project_size: string | null
          project_type: string | null
          project_type_category_id: string | null
          project_year: number | null
          published_at: string | null
          rejection_reason: string | null
          seo_canonical_chosen: string | null
          seo_clicks_28d: number | null
          seo_ctr_28d: number | null
          seo_description: string | null
          seo_impressions_28d: number | null
          seo_indexation_state: string | null
          seo_indexed: boolean | null
          seo_position_28d: number | null
          seo_synced_at: string | null
          seo_title: string | null
          share_exact_location: boolean
          slug: string | null
          source_url: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          status_updated_at: string | null
          status_updated_by: string | null
          style_preferences: string[] | null
          title: string
          translations: Json | null
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_formatted?: string | null
          address_postal_code?: string | null
          address_region?: string | null
          address_street?: string | null
          budget_level?:
            | Database["public"]["Enums"]["project_budget_level"]
            | null
          budget_max?: number | null
          budget_min?: number | null
          building_type?: string | null
          building_year?: number | null
          client_id?: string | null
          completion_date?: string | null
          created_at?: string | null
          description?: string | null
          features?: string[] | null
          id?: string
          is_featured?: boolean | null
          latitude?: number | null
          likes_count?: number | null
          location?: string | null
          longitude?: number | null
          pinterest_pin_id?: string | null
          pinterest_sync_error?: string | null
          pinterest_synced_at?: string | null
          project_size?: string | null
          project_type?: string | null
          project_type_category_id?: string | null
          project_year?: number | null
          published_at?: string | null
          rejection_reason?: string | null
          seo_canonical_chosen?: string | null
          seo_clicks_28d?: number | null
          seo_ctr_28d?: number | null
          seo_description?: string | null
          seo_impressions_28d?: number | null
          seo_indexation_state?: string | null
          seo_indexed?: boolean | null
          seo_position_28d?: number | null
          seo_synced_at?: string | null
          seo_title?: string | null
          share_exact_location?: boolean
          slug?: string | null
          source_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          style_preferences?: string[] | null
          title: string
          translations?: Json | null
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_formatted?: string | null
          address_postal_code?: string | null
          address_region?: string | null
          address_street?: string | null
          budget_level?:
            | Database["public"]["Enums"]["project_budget_level"]
            | null
          budget_max?: number | null
          budget_min?: number | null
          building_type?: string | null
          building_year?: number | null
          client_id?: string | null
          completion_date?: string | null
          created_at?: string | null
          description?: string | null
          features?: string[] | null
          id?: string
          is_featured?: boolean | null
          latitude?: number | null
          likes_count?: number | null
          location?: string | null
          longitude?: number | null
          pinterest_pin_id?: string | null
          pinterest_sync_error?: string | null
          pinterest_synced_at?: string | null
          project_size?: string | null
          project_type?: string | null
          project_type_category_id?: string | null
          project_year?: number | null
          published_at?: string | null
          rejection_reason?: string | null
          seo_canonical_chosen?: string | null
          seo_clicks_28d?: number | null
          seo_ctr_28d?: number | null
          seo_description?: string | null
          seo_impressions_28d?: number | null
          seo_indexation_state?: string | null
          seo_indexed?: boolean | null
          seo_position_28d?: number | null
          seo_synced_at?: string | null
          seo_title?: string | null
          share_exact_location?: boolean
          slug?: string | null
          source_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          style_preferences?: string[] | null
          title?: string
          translations?: Json | null
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_type_category_id_fkey"
            columns: ["project_type_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_status_updated_by_fkey"
            columns: ["status_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_events: {
        Row: {
          created_at: string | null
          event_source: string
          event_type: string
          id: string
          metadata: Json | null
          new_status: Database["public"]["Enums"]["prospect_status"] | null
          old_status: Database["public"]["Enums"]["prospect_status"] | null
          prospect_id: string
        }
        Insert: {
          created_at?: string | null
          event_source?: string
          event_type: string
          id?: string
          metadata?: Json | null
          new_status?: Database["public"]["Enums"]["prospect_status"] | null
          old_status?: Database["public"]["Enums"]["prospect_status"] | null
          prospect_id: string
        }
        Update: {
          created_at?: string | null
          event_source?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          new_status?: Database["public"]["Enums"]["prospect_status"] | null
          old_status?: Database["public"]["Enums"]["prospect_status"] | null
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          apollo_contact_id: string | null
          apollo_list_id: string | null
          apollo_sequence_id: string | null
          bounced_at: string | null
          city: string | null
          company_created_at: string | null
          company_id: string | null
          company_name: string | null
          complained_at: string | null
          contact_name: string | null
          converted_at: string | null
          country: string | null
          created_at: string | null
          email: string
          email_status: string | null
          emails_clicked: number | null
          emails_delivered: number | null
          emails_opened: number | null
          emails_sent: number | null
          id: string
          landing_visited_at: string | null
          last_email_clicked_at: string | null
          last_email_opened_at: string | null
          last_email_sent_at: string | null
          last_outbound_at: string | null
          metadata: Json | null
          next_follow_up_at: string | null
          notes: string | null
          phone: string | null
          project_id: string | null
          project_published_at: string | null
          project_started_at: string | null
          ref_code: string | null
          replied_at: string | null
          sequence_status: string | null
          signed_up_at: string | null
          source: string | null
          status: Database["public"]["Enums"]["prospect_status"]
          tags: string[] | null
          unsubscribed_at: string | null
          updated_at: string | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          apollo_contact_id?: string | null
          apollo_list_id?: string | null
          apollo_sequence_id?: string | null
          bounced_at?: string | null
          city?: string | null
          company_created_at?: string | null
          company_id?: string | null
          company_name?: string | null
          complained_at?: string | null
          contact_name?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string | null
          email: string
          email_status?: string | null
          emails_clicked?: number | null
          emails_delivered?: number | null
          emails_opened?: number | null
          emails_sent?: number | null
          id?: string
          landing_visited_at?: string | null
          last_email_clicked_at?: string | null
          last_email_opened_at?: string | null
          last_email_sent_at?: string | null
          last_outbound_at?: string | null
          metadata?: Json | null
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          project_id?: string | null
          project_published_at?: string | null
          project_started_at?: string | null
          ref_code?: string | null
          replied_at?: string | null
          sequence_status?: string | null
          signed_up_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          tags?: string[] | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          apollo_contact_id?: string | null
          apollo_list_id?: string | null
          apollo_sequence_id?: string | null
          bounced_at?: string | null
          city?: string | null
          company_created_at?: string | null
          company_id?: string | null
          company_name?: string | null
          complained_at?: string | null
          contact_name?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string | null
          email?: string
          email_status?: string | null
          emails_clicked?: number | null
          emails_delivered?: number | null
          emails_opened?: number | null
          emails_sent?: number | null
          id?: string
          landing_visited_at?: string | null
          last_email_clicked_at?: string | null
          last_email_opened_at?: string | null
          last_email_sent_at?: string | null
          last_outbound_at?: string | null
          metadata?: Json | null
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          project_id?: string | null
          project_published_at?: string | null
          project_started_at?: string | null
          ref_code?: string | null
          replied_at?: string | null
          sequence_status?: string | null
          signed_up_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          tags?: string[] | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "prospects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id_full"]
          },
          {
            foreignKeyName: "prospects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "prospects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      retailers: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_featured: boolean
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_featured?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_featured?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      saved_companies: {
        Row: {
          company_id: string
          created_at: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "saved_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id_full"]
          },
          {
            foreignKeyName: "saved_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "saved_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_companies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_products: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_projects: {
        Row: {
          created_at: string | null
          notes: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          notes?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          notes?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_search_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          created_at: string
          icon_key: string | null
          id: string
          image_url: string | null
          in_home_carrousel: boolean
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon_key?: string | null
          id?: string
          image_url?: string | null
          in_home_carrousel?: boolean
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon_key?: string | null
          id?: string
          image_url?: string | null
          in_home_carrousel?: boolean
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      company_metrics: {
        Row: {
          company_id: string | null
          professional_count: number | null
          projects_linked: number | null
        }
        Relationships: []
      }
      mv_professional_summary: {
        Row: {
          company_audience: string | null
          company_city: string | null
          company_country: string | null
          company_domain: string | null
          company_id: string | null
          company_id_full: string | null
          company_is_featured: boolean | null
          company_latitude: number | null
          company_logo: string | null
          company_longitude: number | null
          company_name: string | null
          company_slug: string | null
          company_state_region: string | null
          company_status: Database["public"]["Enums"]["company_status"] | null
          cover_photo_url: string | null
          created_at: string | null
          first_name: string | null
          id: string | null
          is_verified: boolean | null
          last_name: string | null
          primary_service_name: string | null
          primary_service_name_nl: string | null
          primary_specialty: string | null
          primary_specialty_slug: string | null
          searchable_city: string | null
          searchable_country: string | null
          searchable_state_region: string | null
          services_offered: string[] | null
          specialty_ids: string[] | null
          specialty_parent_ids: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      mv_project_summary: {
        Row: {
          budget_display: string | null
          budget_level:
            | Database["public"]["Enums"]["project_budget_level"]
            | null
          budget_max: number | null
          budget_min: number | null
          building_type: string | null
          building_year: number | null
          client_avatar: string | null
          client_first_name: string | null
          client_last_name: string | null
          created_at: string | null
          description: string | null
          features: string[] | null
          id: string | null
          is_featured: boolean | null
          likes_count: number | null
          location: string | null
          photo_count: number | null
          primary_category: string | null
          primary_category_color: string | null
          primary_category_icon: string | null
          primary_category_slug: string | null
          primary_photo_alt: string | null
          primary_photo_url: string | null
          project_size: string | null
          project_type: string | null
          project_year: number | null
          slug: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          style_preferences: string[] | null
          title: string | null
          translations: Json | null
          updated_at: string | null
          views_count: number | null
        }
        Relationships: []
      }
      project_search_documents: {
        Row: {
          budget_display: string | null
          budget_level:
            | Database["public"]["Enums"]["project_budget_level"]
            | null
          budget_max: number | null
          budget_min: number | null
          building_type: string | null
          building_year: number | null
          client_avatar: string | null
          client_first_name: string | null
          client_last_name: string | null
          created_at: string | null
          credited_count: number | null
          description: string | null
          features: string[] | null
          id: string | null
          is_featured: boolean | null
          likes_count: number | null
          location: string | null
          photo_count: number | null
          primary_category: string | null
          primary_category_color: string | null
          primary_category_icon: string | null
          primary_category_slug: string | null
          primary_photo_alt: string | null
          primary_photo_url: string | null
          project_size: string | null
          project_type: string | null
          project_year: number | null
          search_vector: unknown
          slug: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          style_preferences: string[] | null
          title: string | null
          translations: Json | null
          updated_at: string | null
          views_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_feature_photos: {
        Args: {
          p_add_photo_ids: string[]
          p_cover_photo_id: string
          p_fallback_feature_id: string
          p_feature_id: string
          p_project_id: string
          p_remove_photo_ids: string[]
        }
        Returns: Json
      }
      assign_photos_to_feature: {
        Args: {
          p_feature_id: string
          p_photo_ids: string[]
          p_project_id: string
        }
        Returns: undefined
      }
      backfill_companies_first_touch_source: { Args: never; Returns: number }
      check_redirect_chain: {
        Args: {
          max_depth?: number
          new_slug_param: string
          old_slug_param: string
        }
        Returns: boolean
      }
      clear_company_hero_photo: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      companies_compute_audience: {
        Args: { p_primary_service_id: string; p_services_offered: string[] }
        Returns: string
      }
      count_professionals: {
        Args: {
          category_filters?: string[]
          city_filters?: string[]
          country_filter?: string
          max_hourly_rate?: number
          search_query?: string
          service_filters?: string[]
          state_filter?: string
          verified_only?: boolean
        }
        Returns: number
      }
      get_platform_stats: {
        Args: never
        Returns: {
          published_projects: number
          total_professionals: number
          total_projects: number
          total_users: number
          verified_professionals: number
        }[]
      }
      get_professional_location_facets: {
        Args: never
        Returns: {
          city: string
          country: string
          state_region: string
        }[]
      }
      get_project_cities: {
        Args: never
        Returns: {
          city: string
        }[]
      }
      get_prospect_funnel: {
        Args: never
        Returns: {
          count: number
          status: string
        }[]
      }
      get_public_company_photos: {
        Args: { p_company_id: string }
        Returns: {
          alt_text: string
          created_at: string
          id: string
          is_cover: boolean
          order_index: number
          url: string
        }[]
      }
      get_user_saved_companies_with_summary: {
        Args: never
        Returns: {
          company_city: string
          company_country: string
          company_domain: string
          company_id: string
          company_logo: string
          company_name: string
          company_slug: string
          company_state_region: string
          cover_url: string
          first_name: string
          is_verified: boolean
          last_name: string
          logo_url: string
          primary_service_name: string
          primary_specialty: string
          professional_id: string
          saved_at: string
          services_offered: string[]
          title: string
          user_location: string
        }[]
      }
      get_user_saved_projects_with_summary:
        | {
            Args: never
            Returns: {
              budget_display: string
              created_at: string
              id: string
              likes_count: number
              location: string
              primary_photo_alt: string
              primary_photo_url: string
              project_type: string
              saved_at: string
              slug: string
              style_preferences: string[]
              title: string
              translations: Json
              updated_at: string
            }[]
          }
        | {
            Args: { p_user_id: string }
            Returns: {
              budget_display: string
              created_at: string
              id: string
              likes_count: number
              location: string
              primary_photo_alt: string
              primary_photo_url: string
              project_type: string
              saved_at: string
              slug: string
              style_preferences: string[]
              title: string
              updated_at: string
            }[]
          }
      get_users_by_type: {
        Args: { user_type_filter: string }
        Returns: {
          email: string
          first_name: string
          id: string
          last_name: string
          user_types: string[]
        }[]
      }
      has_worked_with_professional: {
        Args: { prof_id: string }
        Returns: boolean
      }
      increment_company_views: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      increment_project_views: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      is_active_company_member: {
        Args: { _company_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_user: { Args: never; Returns: boolean }
      is_company_contact_for_current_user: {
        Args: { _company_id: string }
        Returns: boolean
      }
      is_own_profile_avatar_path: { Args: { _path: string }; Returns: boolean }
      is_professional: { Args: never; Returns: boolean }
      is_project_photo_owner: {
        Args: { _project_id: string }
        Returns: boolean
      }
      is_project_photo_owner_by_path: {
        Args: { _path: string }
        Returns: boolean
      }
      person_visible_to_current_user: {
        Args: { _person_id: string }
        Returns: boolean
      }
      pinterest_enqueue: {
        Args: { p_action: string; p_target_id: string; p_target_type: string }
        Returns: undefined
      }
      refresh_all_materialized_views: { Args: never; Returns: undefined }
      refresh_mv_professional_summary: { Args: never; Returns: undefined }
      refresh_professional_summary: { Args: never; Returns: undefined }
      refresh_project_summary: { Args: never; Returns: undefined }
      reorder_company_photos: {
        Args: { company_id_param: string; photo_ids: string[] }
        Returns: undefined
      }
      search_professionals: {
        Args: {
          category_filters?: string[]
          city_filters?: string[]
          country_filter?: string
          limit_count?: number
          max_hourly_rate?: number
          offset_count?: number
          search_query?: string
          service_filters?: string[]
          sort_by?: string
          state_filter?: string
          verified_only?: boolean
        }
        Returns: {
          company_city: string
          company_country: string
          company_domain: string
          company_id: string
          company_latitude: number
          company_logo: string
          company_longitude: number
          company_name: string
          company_slug: string
          company_state_region: string
          cover_photo_url: string
          credited_sum: number
          first_name: string
          id: string
          is_featured: boolean
          is_verified: boolean
          last_name: string
          primary_service_name: string
          primary_specialty: string
          services_offered: string[]
          specialty_ids: string[]
          specialty_parent_ids: string[]
          user_id: string
          views_count: number
        }[]
      }
      search_projects: {
        Args: {
          budget_filter?: Database["public"]["Enums"]["project_budget_level"]
          category_filter?: string
          feature_filters?: string[]
          featured_only?: boolean
          limit_count?: number
          location_filter?: string
          offset_count?: number
          project_type_filter?: string
          search_query?: string
          style_filters?: string[]
        }
        Returns: {
          budget_display: string
          created_at: string
          id: string
          is_featured: boolean
          likes_count: number
          location: string
          primary_category: string
          primary_photo_url: string
          project_type: string
          slug: string
          title: string
          translations: Json
        }[]
      }
      set_company_hero_photo: {
        Args: {
          p_company_id: string
          p_photo_url: string
          p_project_id: string
        }
        Returns: undefined
      }
      toggle_project_like: {
        Args: { p_project_id: string }
        Returns: {
          liked: boolean
          likes_count: number
        }[]
      }
      update_company_services: {
        Args: {
          p_certificates: string[]
          p_company_id: string
          p_languages: string[]
          p_primary_service_id: string
          p_services_offered: string[]
        }
        Returns: undefined
      }
      user_has_type: {
        Args: { check_type: string; user_types: string[] }
        Returns: boolean
      }
      user_is_admin: { Args: { user_types: string[] }; Returns: boolean }
      user_is_client: { Args: { user_types: string[] }; Returns: boolean }
      user_is_professional: { Args: { user_types: string[] }; Returns: boolean }
    }
    Enums: {
      admin_role: "super_admin" | "admin"
      application_status: "pending" | "accepted" | "rejected"
      brand_status:
        | "unclaimed"
        | "prospected"
        | "unlisted"
        | "listed"
        | "deactivated"
      company_contact_role: "contact" | "member" | "admin" | "owner"
      company_social_platform:
        | "facebook"
        | "instagram"
        | "linkedin"
        | "pinterest"
      company_source: "apollo" | "direct" | "manual" | "invited"
      company_status:
        | "draft"
        | "unlisted"
        | "listed"
        | "deactivated"
        | "prospected"
        | "added"
        | "unclaimed"
      outbound_kind: "call" | "meeting" | "email" | "linkedin" | "note"
      outbound_outcome: "positive" | "neutral" | "negative" | "no_answer"
      person_source: "apollo" | "direct" | "manual" | "invited"
      product_link_source:
        | "ai"
        | "brand_suggest"
        | "pro_suggest"
        | "admin_manual"
      product_link_status: "pending" | "live" | "rejected"
      product_status: "listed" | "unlisted"
      professional_project_status:
        | "invited"
        | "listed"
        | "live_on_page"
        | "unlisted"
        | "rejected"
        | "removed"
      project_budget_level: "budget" | "mid_range" | "premium" | "luxury"
      project_status:
        | "draft"
        | "published"
        | "in_progress"
        | "completed"
        | "archived"
        | "rejected"
      project_taxonomy_type:
        | "project_style"
        | "building_type"
        | "location_feature"
        | "material_feature"
        | "size_range"
        | "budget_tier"
      prospect_status:
        | "prospect"
        | "contacted"
        | "visitor"
        | "signup"
        | "company"
        | "active"
        | "removed"
      review_moderation_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role: ["super_admin", "admin"],
      application_status: ["pending", "accepted", "rejected"],
      brand_status: [
        "unclaimed",
        "prospected",
        "unlisted",
        "listed",
        "deactivated",
      ],
      company_contact_role: ["contact", "member", "admin", "owner"],
      company_social_platform: [
        "facebook",
        "instagram",
        "linkedin",
        "pinterest",
      ],
      company_source: ["apollo", "direct", "manual", "invited"],
      company_status: [
        "draft",
        "unlisted",
        "listed",
        "deactivated",
        "prospected",
        "added",
        "unclaimed",
      ],
      outbound_kind: ["call", "meeting", "email", "linkedin", "note"],
      outbound_outcome: ["positive", "neutral", "negative", "no_answer"],
      person_source: ["apollo", "direct", "manual", "invited"],
      product_link_source: [
        "ai",
        "brand_suggest",
        "pro_suggest",
        "admin_manual",
      ],
      product_link_status: ["pending", "live", "rejected"],
      product_status: ["listed", "unlisted"],
      professional_project_status: [
        "invited",
        "listed",
        "live_on_page",
        "unlisted",
        "rejected",
        "removed",
      ],
      project_budget_level: ["budget", "mid_range", "premium", "luxury"],
      project_status: [
        "draft",
        "published",
        "in_progress",
        "completed",
        "archived",
        "rejected",
      ],
      project_taxonomy_type: [
        "project_style",
        "building_type",
        "location_feature",
        "material_feature",
        "size_range",
        "budget_tier",
      ],
      prospect_status: [
        "prospect",
        "contacted",
        "visitor",
        "signup",
        "company",
        "active",
        "removed",
      ],
      review_moderation_status: ["pending", "approved", "rejected"],
    },
  },
} as const
