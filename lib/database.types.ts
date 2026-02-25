export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'cast' | 'copro' | 'leader' | 'admin'
export type FlagStatus = 'pending' | 'resolved' | 'dismissed'
export type FlagTargetType = 'post' | 'user'
export type PreferredTime = 'morning' | 'afternoon' | 'evening' | 'late'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          display_name: string
          email: string
          email_verified: boolean
          password_hash: string
          phone_number: string | null
          notify_via_email: boolean
          notify_via_sms: boolean
          role: UserRole
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          display_name: string
          email: string
          email_verified?: boolean
          password_hash: string
          phone_number?: string | null
          notify_via_email?: boolean
          notify_via_sms?: boolean
          role?: UserRole
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          email?: string
          email_verified?: boolean
          password_hash?: string
          phone_number?: string | null
          notify_via_email?: boolean
          notify_via_sms?: boolean
          role?: UserRole
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      locations: {
        Row: {
          id: string
          property_id: string
          name: string
          is_approved: boolean
          suggested_by_user_id: string | null
          approved_by_user_id: string | null
          approved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          property_id: string
          name: string
          is_approved?: boolean
          suggested_by_user_id?: string | null
          approved_by_user_id?: string | null
          approved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          name?: string
          is_approved?: boolean
          suggested_by_user_id?: string | null
          approved_by_user_id?: string | null
          approved_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_suggested_by_user_id_fkey"
            columns: ["suggested_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      roles: {
        Row: {
          id: string
          name: string
          is_approved: boolean
          suggested_by_user_id: string | null
          approved_by_user_id: string | null
          approved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          is_approved?: boolean
          suggested_by_user_id?: string | null
          approved_by_user_id?: string | null
          approved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          is_approved?: boolean
          suggested_by_user_id?: string | null
          approved_by_user_id?: string | null
          approved_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_suggested_by_user_id_fkey"
            columns: ["suggested_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_proficiencies: {
        Row: {
          id: string
          user_id: string
          property_id: string
          location_id: string
          role_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          location_id: string
          role_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          location_id?: string
          role_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_proficiencies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_proficiencies_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_proficiencies_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          }
        ]
      }
      shifts: {
        Row: {
          id: string
          created_by: string
          user_id: string | null
          property_id: string
          location_id: string
          role_id: string
          shift_title: string
          start_time: string
          end_time: string
          is_trade: boolean
          is_giveaway: boolean
          is_overtime_approved: boolean
          comments: string | null
          is_active: boolean
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          created_by: string
          user_id?: string | null
          property_id: string
          location_id: string
          role_id: string
          shift_title: string
          start_time: string
          end_time: string
          is_trade?: boolean
          is_giveaway?: boolean
          is_overtime_approved?: boolean
          comments?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          created_by?: string
          user_id?: string | null
          property_id?: string
          location_id?: string
          role_id?: string
          shift_title?: string
          start_time?: string
          end_time?: string
          is_trade?: boolean
          is_giveaway?: boolean
          is_overtime_approved?: boolean
          comments?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          }
        ]
      }
      requests: {
        Row: {
          id: string
          created_by: string
          user_id: string | null
          property_id: string
          location_id: string
          role_id: string
          preferred_times: PreferredTime[]
          requested_date: string
          comments: string | null
          is_active: boolean
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          created_by: string
          user_id?: string | null
          property_id: string
          location_id: string
          role_id: string
          preferred_times: PreferredTime[]
          requested_date: string
          comments?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          created_by?: string
          user_id?: string | null
          property_id?: string
          location_id?: string
          role_id?: string
          preferred_times?: PreferredTime[]
          requested_date?: string
          comments?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          }
        ]
      }
      flags: {
        Row: {
          id: string
          flagged_by_user_id: string | null
          target_type: FlagTargetType
          target_id: string
          reason: string
          status: FlagStatus
          resolved_by_user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          flagged_by_user_id?: string | null
          target_type: FlagTargetType
          target_id: string
          reason: string
          status?: FlagStatus
          resolved_by_user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          flagged_by_user_id?: string | null
          target_type?: FlagTargetType
          target_id?: string
          reason?: string
          status?: FlagStatus
          resolved_by_user_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flags_flagged_by_user_id_fkey"
            columns: ["flagged_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      black_listed: {
        Row: {
          id: string
          email: string
          failed_attempts: number
          blocked: boolean
          ip_address: string | null
          origin_country: string | null
          origin_city: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          failed_attempts?: number
          blocked?: boolean
          ip_address?: string | null
          origin_country?: string | null
          origin_city?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          failed_attempts?: number
          blocked?: boolean
          ip_address?: string | null
          origin_country?: string | null
          origin_city?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
