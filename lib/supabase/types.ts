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
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
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
          certificates: string[] | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          domain: string | null
          email: string | null
          founded_year: number | null
          id: string
          languages: string[] | null
          is_verified: boolean | null
          plan_expires_at: string | null
          plan_tier: Database["public"]["Enums"]["company_plan_tier"]
          logo_url: string | null
          name: string
          owner_id: string
          primary_service_id: string | null
          phone: string | null
          services_offered: string[] | null
          status: Database["public"]["Enums"]["company_status"]
          team_size_max: number | null
          team_size_min: number | null
          upgrade_eligible: boolean
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          certificates?: string[] | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          email?: string | null
          founded_year?: number | null
          id?: string
          languages?: string[] | null
          is_verified?: boolean | null
          plan_expires_at?: string | null
          plan_tier?: Database["public"]["Enums"]["company_plan_tier"]
          logo_url?: string | null
          name: string
          owner_id: string
          primary_service_id?: string | null
          phone?: string | null
          services_offered?: string[] | null
          status?: Database["public"]["Enums"]["company_status"]
          team_size_max?: number | null
          team_size_min?: number | null
          upgrade_eligible?: boolean
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          certificates?: string[] | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          email?: string | null
          founded_year?: number | null
          id?: string
          languages?: string[] | null
          is_verified?: boolean | null
          plan_expires_at?: string | null
          plan_tier?: Database["public"]["Enums"]["company_plan_tier"]
          logo_url?: string | null
          name?: string
          owner_id?: string
          primary_service_id?: string | null
          phone?: string | null
          services_offered?: string[] | null
          status?: Database["public"]["Enums"]["company_status"]
          team_size_max?: number | null
          team_size_min?: number | null
          upgrade_eligible?: boolean
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
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
        ]
      }
      messages: {
        Row: {
          application_id: string | null
          attachments: string[] | null
          content: string
          created_at: string | null
          id: string
          is_archived: boolean | null
          is_read: boolean | null
          message_type: string | null
          project_id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
          sent_at: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          application_id?: string | null
          attachments?: string[] | null
          content: string
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          message_type?: string | null
          project_id: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
          sent_at?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          application_id?: string | null
          attachments?: string[] | null
          content?: string
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          message_type?: string | null
          project_id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          sent_at?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "project_applications"
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
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          read_at: string | null
          related_message_id: string | null
          related_professional_id: string | null
          related_project_id: string | null
          related_review_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          notification_type?: string
          read_at?: string | null
          related_message_id?: string | null
          related_professional_id?: string | null
          related_project_id?: string | null
          related_review_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          read_at?: string | null
          related_message_id?: string | null
          related_professional_id?: string | null
          related_project_id?: string | null
          related_review_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_message_id_fkey"
            columns: ["related_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_professional_id_fkey"
            columns: ["related_professional_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_professional_id_fkey"
            columns: ["related_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_review_id_fkey"
            columns: ["related_review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_ratings: {
        Row: {
          communication_rating: number | null
          created_at: string | null
          last_review_at: string | null
          overall_rating: number | null
          professional_id: string
          quality_rating: number | null
          reliability_rating: number | null
          total_reviews: number | null
          updated_at: string | null
        }
        Insert: {
          communication_rating?: number | null
          created_at?: string | null
          last_review_at?: string | null
          overall_rating?: number | null
          professional_id: string
          quality_rating?: number | null
          reliability_rating?: number | null
          total_reviews?: number | null
          updated_at?: string | null
        }
        Update: {
          communication_rating?: number | null
          created_at?: string | null
          last_review_at?: string | null
          overall_rating?: number | null
          professional_id?: string
          quality_rating?: number | null
          reliability_rating?: number | null
          total_reviews?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_ratings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_ratings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_specialties: {
        Row: {
          category_id: string
          created_at: string | null
          is_primary: boolean | null
          professional_id: string
          years_experience: number | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          is_primary?: boolean | null
          professional_id: string
          years_experience?: number | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          is_primary?: boolean | null
          professional_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_specialties_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_specialties_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_specialties_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
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
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          first_name: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          is_verified: boolean | null
          last_name: string | null
          location: string | null
          phone: string | null
          updated_at: string | null
          user_types: string[] | null
          website: string | null
        }
        Insert: {
          admin_role?: Database["public"]["Enums"]["admin_role"] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          first_name?: string | null
          id: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          last_name?: string | null
          location?: string | null
          phone?: string | null
          updated_at?: string | null
          user_types?: string[] | null
          website?: string | null
        }
        Update: {
          admin_role?: Database["public"]["Enums"]["admin_role"] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          last_name?: string | null
          location?: string | null
          phone?: string | null
          updated_at?: string | null
          user_types?: string[] | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_applications: {
        Row: {
          applied_at: string | null
          cover_letter: string | null
          created_at: string | null
          estimated_duration: string | null
          id: string
          portfolio_items: string[] | null
          professional_id: string
          project_id: string
          proposal: string | null
          quoted_price: number | null
          responded_at: string | null
          status: Database["public"]["Enums"]["application_status"] | null
          updated_at: string | null
        }
        Insert: {
          applied_at?: string | null
          cover_letter?: string | null
          created_at?: string | null
          estimated_duration?: string | null
          id?: string
          portfolio_items?: string[] | null
          professional_id: string
          project_id: string
          proposal?: string | null
          quoted_price?: number | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          updated_at?: string | null
        }
        Update: {
          applied_at?: string | null
          cover_letter?: string | null
          created_at?: string | null
          id?: string
          estimated_duration?: string | null
          portfolio_items?: string[] | null
          professional_id?: string
          project_id?: string
          proposal?: string | null
          quoted_price?: number | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_applications_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_applications_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          project_id: string
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
          project_id: string
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
          project_id?: string
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
            referencedRelation: "projects"
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
          created_at: string
          id: string
          invited_at: string
          invited_email: string
          invited_service_category_id: string | null
          is_project_owner: boolean
          professional_id: string | null
          project_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["professional_project_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string
          invited_email: string
          invited_service_category_id?: string | null
          is_project_owner?: boolean
          professional_id?: string | null
          project_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["professional_project_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string
          invited_email?: string
          invited_service_category_id?: string | null
          is_project_owner?: boolean
          professional_id?: string | null
          project_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["professional_project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_professionals_invited_service_category_id_fkey"
            columns: ["invited_service_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
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
          client_id: string
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
          project_size: string | null
          project_type: string | null
          project_type_category_id: string | null
          project_year: number | null
          rejection_reason: string | null
          seo_description: string | null
          seo_title: string | null
          share_exact_location: boolean
          slug: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          status_updated_at: string | null
          status_updated_by: string | null
          style_preferences: string[] | null
          title: string
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
          client_id: string
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
          project_size?: string | null
          project_type?: string | null
          project_type_category_id?: string | null
          project_year?: number | null
          rejection_reason?: string | null
          seo_description?: string | null
          seo_title?: string | null
          share_exact_location?: boolean
          slug?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          style_preferences?: string[] | null
          title: string
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
          client_id?: string
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
          project_size?: string | null
          project_type?: string | null
          project_type_category_id?: string | null
          project_year?: number | null
          rejection_reason?: string | null
          seo_description?: string | null
          seo_title?: string | null
          share_exact_location?: boolean
          slug?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          style_preferences?: string[] | null
          title?: string
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
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          communication_rating: number | null
          created_at: string | null
          id: string
          moderation_notes: string | null
          moderation_status: Database["public"]["Enums"]["review_moderation_status"]
          moderated_at: string | null
          moderated_by: string | null
          is_published: boolean | null
          is_verified: boolean | null
          overall_rating: number
          professional_id: string
          project_id: string | null
          quality_rating: number | null
          reliability_rating: number | null
          response_date: string | null
          response_text: string | null
          reviewer_id: string
          title: string | null
          updated_at: string | null
          work_completed: boolean | null
          would_recommend: boolean | null
        }
        Insert: {
          comment?: string | null
          communication_rating?: number | null
          created_at?: string | null
          id?: string
          moderation_notes?: string | null
          moderation_status?: Database["public"]["Enums"]["review_moderation_status"]
          moderated_at?: string | null
          moderated_by?: string | null
          is_published?: boolean | null
          is_verified?: boolean | null
          overall_rating: number
          professional_id: string
          project_id?: string | null
          quality_rating?: number | null
          reliability_rating?: number | null
          response_date?: string | null
          response_text?: string | null
          reviewer_id: string
          title?: string | null
          updated_at?: string | null
          work_completed?: boolean | null
          would_recommend?: boolean | null
        }
        Update: {
          comment?: string | null
          communication_rating?: number | null
          created_at?: string | null
          id?: string
          moderation_notes?: string | null
          moderation_status?: Database["public"]["Enums"]["review_moderation_status"]
          moderated_at?: string | null
          moderated_by?: string | null
          is_published?: boolean | null
          is_verified?: boolean | null
          overall_rating?: number
          professional_id?: string
          project_id?: string | null
          quality_rating?: number | null
          reliability_rating?: number | null
          response_date?: string | null
          response_text?: string | null
          reviewer_id?: string
          title?: string | null
          updated_at?: string | null
          work_completed?: boolean | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      saved_professionals: {
        Row: {
          created_at: string | null
          notes: string | null
          professional_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          notes?: string | null
          professional_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          notes?: string | null
          professional_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "mv_professional_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
    }
    Views: {
      admin_company_professional_metrics: {
        Row: {
          average_rating: number | null
          company_id: string | null
          professional_count: number | null
          projects_linked: number | null
          total_reviews: number | null
        }
        Relationships: []
      }
      mv_professional_summary: {
        Row: {
          avatar_url: string | null
          bio: string | null
          communication_rating: number | null
          company_logo: string | null
          company_name: string | null
          created_at: string | null
          display_rating: number | null
          first_name: string | null
          hourly_rate_display: string | null
          hourly_rate_max: number | null
          hourly_rate_min: number | null
          id: string | null
          is_available: boolean | null
          is_verified: boolean | null
          languages_spoken: string[] | null
          last_name: string | null
          last_review_at: string | null
          overall_rating: number | null
          portfolio_url: string | null
          primary_specialty: string | null
          primary_specialty_color: string | null
          primary_specialty_icon: string | null
          primary_specialty_slug: string | null
          quality_rating: number | null
          reliability_rating: number | null
          services_offered: string[] | null
          title: string | null
          total_reviews: number | null
          updated_at: string | null
          user_id: string | null
          user_location: string | null
          years_experience: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          pending_applications: number | null
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
          total_applications: number | null
          updated_at: string | null
          views_count: number | null
        }
        Relationships: []
      }
      professional_search_documents: {
        Row: {
          avatar_url: string | null
          bio: string | null
          communication_rating: number | null
          company_logo: string | null
          company_name: string | null
          created_at: string | null
          display_rating: number | null
          first_name: string | null
          hourly_rate_display: string | null
          hourly_rate_max: number | null
          hourly_rate_min: number | null
          id: string | null
          is_available: boolean | null
          is_verified: boolean | null
          languages_spoken: string[] | null
          last_name: string | null
          last_review_at: string | null
          overall_rating: number | null
          portfolio_url: string | null
          primary_specialty: string | null
          primary_specialty_color: string | null
          primary_specialty_icon: string | null
          primary_specialty_slug: string | null
          quality_rating: number | null
          reliability_rating: number | null
          search_vector: unknown
          services_offered: string[] | null
          title: string | null
          total_reviews: number | null
          updated_at: string | null
          user_id: string | null
          user_location: string | null
          years_experience: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          description: string | null
          features: string[] | null
          id: string | null
          is_featured: boolean | null
          likes_count: number | null
          location: string | null
          pending_applications: number | null
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
          total_applications: number | null
          updated_at: string | null
          views_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_platform_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          average_rating: number
          published_projects: number
          total_professionals: number
          total_projects: number
          total_reviews: number
          total_users: number
          verified_professionals: number
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
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_professional: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      refresh_all_materialized_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_professional_summary: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_project_summary: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      search_professionals: {
        Args: {
          limit_count?: number
          location_filter?: string
          max_hourly_rate?: number
          min_rating?: number
          offset_count?: number
          search_query?: string
          specialty_filter?: string
          verified_only?: boolean
        }
        Returns: {
          avatar_url: string
          company_name: string
          display_rating: number
          first_name: string
          hourly_rate_display: string
          id: string
          is_verified: boolean
          last_name: string
          primary_specialty: string
          title: string
          total_reviews: number
          user_id: string
          user_location: string
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
        }[]
      }
      toggle_project_like: {
        Args: { p_project_id: string }
        Returns: {
          liked: boolean
          likes_count: number
        }[]
      }
      user_has_type: {
        Args: { check_type: string; user_types: string[] }
        Returns: boolean
      }
      user_is_admin: {
        Args: { user_types: string[] }
        Returns: boolean
      }
      user_is_client: {
        Args: { user_types: string[] }
        Returns: boolean
      }
      user_is_professional: {
        Args: { user_types: string[] }
        Returns: boolean
      }
    }
    Enums: {
      admin_role: "super_admin" | "admin"
      company_plan_tier: "basic" | "plus"
      company_social_platform: "facebook" | "instagram" | "linkedin" | "pinterest"
      company_status: "unlisted" | "listed" | "deactivated"
      application_status: "pending" | "accepted" | "rejected"
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

export type UserProfile = Tables<"profiles">

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
      application_status: ["pending", "accepted", "rejected"],
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
    },
  },
} as const
