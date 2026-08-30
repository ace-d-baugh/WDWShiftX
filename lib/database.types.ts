export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type GlobalRole  = 'Guest' | 'User' | 'Admin'
export type Membership  = 'Basic' | 'Pro' | 'Trial'
export type BoardRole   = 'User' | 'Mod' | 'Leader'
export type BoardStatus = 'active' | 'paused' | 'deleted'
export type FlagStatus      = 'pending' | 'resolved' | 'dismissed'
export type FlagTargetType  = 'post' | 'user' | 'comment' | 'board'
export type PreferredTime   = 'morning' | 'afternoon' | 'evening' | 'late'
export type CommentPostType = 'shift' | 'request'
export type JoinOutcome     = 'invalid_code' | 'user_declined' | 'success'
export type RoadmapColumn   = 'done' | 'in_progress' | 'next' | 'backlog' | 'deferred'
export type RemovedReason   = 'expired' | 'leader_removed' | 'user_removed' | 'covered' | 'fulfilled'
export type ClaimStatus     = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'completed' | 'fell_through'
export type MessageReaction = 'thumbs_up' | 'laugh' | 'surprise' | 'sad' | 'mad' | 'star'
export type NotificationType =
  | 'shift_match' | 'interest' | 'comment'
  | 'claim_created' | 'claim_resolved' | 'claim_finalized'
  | 'board_approved' | 'board_announcement'
export type ContactMethodType =
  | 'phone' | 'email' | 'instagram' | 'facebook' | 'twitter' | 'tiktok'
  | 'discord' | 'snapchat' | 'linkedin' | 'other'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          display_name: string | null
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          email: string
          email_verified: boolean
          phone_number: string | null
          notify_via_email: boolean
          notify_via_sms: boolean
          onboarding_dismissed_at: string | null
          role: GlobalRole
          membership: Membership
          schedule_import_count: number
          schedule_import_month: string | null
          ical_token: string | null
          is_active: boolean
          last_login_at: string | null
          bio: string | null
          birthday_month: number | null
          birthday_day: number | null
          birthday_year: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          display_name?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          email: string
          email_verified?: boolean
          phone_number?: string | null
          notify_via_email?: boolean
          notify_via_sms?: boolean
          onboarding_dismissed_at?: string | null
          role?: GlobalRole
          membership?: Membership
          schedule_import_count?: number
          schedule_import_month?: string | null
          ical_token?: string | null
          is_active?: boolean
          last_login_at?: string | null
          bio?: string | null
          birthday_month?: number | null
          birthday_day?: number | null
          birthday_year?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          email?: string
          email_verified?: boolean
          phone_number?: string | null
          notify_via_email?: boolean
          notify_via_sms?: boolean
          onboarding_dismissed_at?: string | null
          role?: GlobalRole
          membership?: Membership
          schedule_import_count?: number
          schedule_import_month?: string | null
          ical_token?: string | null
          is_active?: boolean
          last_login_at?: string | null
          bio?: string | null
          birthday_month?: number | null
          birthday_day?: number | null
          birthday_year?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      boards: {
        Row: {
          id: string
          name: string
          slug: string
          invite_code: string
          invite_code_enabled: boolean
          created_by: string | null
          is_active: boolean
          status: BoardStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          invite_code: string
          invite_code_enabled?: boolean
          created_by?: string | null
          is_active?: boolean
          status?: BoardStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          invite_code?: string
          invite_code_enabled?: boolean
          created_by?: string | null
          is_active?: boolean
          status?: BoardStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_boards: {
        Row: {
          id: string
          user_id: string
          board_id: string
          role: BoardRole
          is_approved: boolean
          is_hidden: boolean
          approved_by_user_id: string | null
          approved_at: string | null
          requested_at: string
        }
        Insert: {
          id?: string
          user_id: string
          board_id: string
          role: BoardRole
          is_approved?: boolean
          is_hidden?: boolean
          approved_by_user_id?: string | null
          approved_at?: string | null
          requested_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          board_id?: string
          role?: BoardRole
          is_approved?: boolean
          is_hidden?: boolean
          approved_by_user_id?: string | null
          approved_at?: string | null
          requested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_boards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_boards_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          }
        ]
      }
      board_join_attempts: {
        Row: {
          id: string
          user_id: string
          code_entered: string
          outcome: JoinOutcome
          attempted_at: string
        }
        Insert: {
          id?: string
          user_id: string
          code_entered: string
          outcome: JoinOutcome
          attempted_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          code_entered?: string
          outcome?: JoinOutcome
          attempted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_join_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      shifts: {
        Row: {
          id: string
          created_by: string
          user_id: string | null
          board_id: string | null
          shift_title: string
          start_time: string
          end_time: string
          is_trade: boolean
          is_giveaway: boolean
          is_overtime_approved: boolean
          details: string | null
          is_active: boolean
          created_at: string
          expires_at: string
          removed_reason: RemovedReason | null
          removed_by_user_id: string | null
          bundle_id: string | null
        }
        Insert: {
          id?: string
          created_by: string
          user_id?: string | null
          board_id?: string | null
          shift_title: string
          start_time: string
          end_time: string
          is_trade?: boolean
          is_giveaway?: boolean
          is_overtime_approved?: boolean
          details?: string | null
          is_active?: boolean
          created_at?: string
          removed_reason?: RemovedReason | null
          removed_by_user_id?: string | null
          bundle_id?: string | null
        }
        Update: {
          id?: string
          created_by?: string
          user_id?: string | null
          board_id?: string | null
          shift_title?: string
          start_time?: string
          end_time?: string
          is_trade?: boolean
          is_giveaway?: boolean
          is_overtime_approved?: boolean
          details?: string | null
          is_active?: boolean
          created_at?: string
          removed_reason?: RemovedReason | null
          removed_by_user_id?: string | null
          bundle_id?: string | null
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
            foreignKeyName: "shifts_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_removed_by_user_id_fkey"
            columns: ["removed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      requests: {
        Row: {
          id: string
          created_by: string
          user_id: string | null
          board_id: string | null
          request_title: string
          preferred_times: PreferredTime[]
          requested_date: string
          details: string | null
          is_active: boolean
          created_at: string
          expires_at: string
          removed_reason: RemovedReason | null
          removed_by_user_id: string | null
        }
        Insert: {
          id?: string
          created_by: string
          user_id?: string | null
          board_id?: string | null
          request_title?: string
          preferred_times: PreferredTime[]
          requested_date: string
          details?: string | null
          is_active?: boolean
          created_at?: string
          removed_reason?: RemovedReason | null
          removed_by_user_id?: string | null
        }
        Update: {
          id?: string
          created_by?: string
          user_id?: string | null
          board_id?: string | null
          request_title?: string
          preferred_times?: PreferredTime[]
          requested_date?: string
          details?: string | null
          is_active?: boolean
          created_at?: string
          removed_reason?: RemovedReason | null
          removed_by_user_id?: string | null
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
            foreignKeyName: "requests_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_removed_by_user_id_fkey"
            columns: ["removed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          board_id: string | null
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
          board_id?: string | null
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
          board_id?: string | null
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
      comments: {
        Row: {
          id: string
          post_type: CommentPostType
          post_id: string
          user_id: string | null
          body: string
          is_interested: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          post_type: CommentPostType
          post_id: string
          user_id?: string | null
          body: string
          is_interested?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          post_type?: CommentPostType
          post_id?: string
          user_id?: string | null
          body?: string
          is_interested?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      beta_survey_responses: {
        Row: {
          id: string
          submitted_at: string | null
          heard_from: string | null
          workplace_type: string | null
          current_method: string[] | null
          ease_register: number | null
          ease_join_board: number | null
          ease_post_shift: number | null
          ease_find_shifts: number | null
          used_interest: string | null
          used_contact: string | null
          received_notifications: string | null
          notifications_helpful: number | null
          overall_useful: number | null
          would_replace: string | null
          use_frequency: string | null
          display_mode: string | null
          primary_device: string | null
          wanted_features: string[] | null
          would_pay: string | null
          appealing_pro_features: string[] | null
          first_impression: string | null
          boards_clarity: string | null
          features_used: string[] | null
          ease_performance: number | null
          network_effect: string | null
          one_thing: string | null
          bugs_feedback: string | null
          nps: string | null
          open_feedback: string | null
          feature_awareness: Json | null
          testimonial: string | null
          testimonial_consent: boolean
        }
        Insert: {
          id?: string
          submitted_at?: string | null
          heard_from?: string | null
          workplace_type?: string | null
          current_method?: string[] | null
          ease_register?: number | null
          ease_join_board?: number | null
          ease_post_shift?: number | null
          ease_find_shifts?: number | null
          used_interest?: string | null
          used_contact?: string | null
          received_notifications?: string | null
          notifications_helpful?: number | null
          overall_useful?: number | null
          would_replace?: string | null
          use_frequency?: string | null
          display_mode?: string | null
          primary_device?: string | null
          wanted_features?: string[] | null
          would_pay?: string | null
          appealing_pro_features?: string[] | null
          first_impression?: string | null
          boards_clarity?: string | null
          features_used?: string[] | null
          ease_performance?: number | null
          network_effect?: string | null
          one_thing?: string | null
          bugs_feedback?: string | null
          nps?: string | null
          open_feedback?: string | null
          feature_awareness?: Json | null
          testimonial?: string | null
          testimonial_consent?: boolean
        }
        Update: {
          id?: string
          submitted_at?: string | null
          heard_from?: string | null
          workplace_type?: string | null
          current_method?: string[] | null
          ease_register?: number | null
          ease_join_board?: number | null
          ease_post_shift?: number | null
          ease_find_shifts?: number | null
          used_interest?: string | null
          used_contact?: string | null
          received_notifications?: string | null
          notifications_helpful?: number | null
          overall_useful?: number | null
          would_replace?: string | null
          use_frequency?: string | null
          display_mode?: string | null
          primary_device?: string | null
          wanted_features?: string[] | null
          would_pay?: string | null
          appealing_pro_features?: string[] | null
          first_impression?: string | null
          boards_clarity?: string | null
          features_used?: string[] | null
          ease_performance?: number | null
          network_effect?: string | null
          one_thing?: string | null
          bugs_feedback?: string | null
          nps?: string | null
          open_feedback?: string | null
          feature_awareness?: Json | null
          testimonial?: string | null
          testimonial_consent?: boolean
        }
        Relationships: []
      }
      roadmap_cards: {
        Row: {
          id: string
          title: string
          description: string | null
          column_key: RoadmapColumn
          position: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          column_key: RoadmapColumn
          position?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          column_key?: RoadmapColumn
          position?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shift_claims: {
        Row: {
          id: string
          shift_id: string
          claimant_id: string
          owner_id: string
          board_id: string | null
          bundle_id: string | null
          status: ClaimStatus
          created_at: string
          responded_at: string | null
          finalized_at: string | null
        }
        Insert: {
          id?: string
          shift_id: string
          claimant_id: string
          owner_id: string
          board_id?: string | null
          bundle_id?: string | null
          status?: ClaimStatus
          created_at?: string
          responded_at?: string | null
          finalized_at?: string | null
        }
        Update: {
          id?: string
          shift_id?: string
          claimant_id?: string
          owner_id?: string
          board_id?: string | null
          bundle_id?: string | null
          status?: ClaimStatus
          created_at?: string
          responded_at?: string | null
          finalized_at?: string | null
        }
        Relationships: []
      }
      shift_bundles: {
        Row: {
          id: string
          user_id: string
          board_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          board_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          board_id?: string
          created_at?: string
        }
        Relationships: []
      }
      match_events: {
        Row: {
          id: string
          board_id: string | null
          shift_id: string | null
          request_id: string | null
          shift_poster_id: string | null
          requester_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          board_id?: string | null
          shift_id?: string | null
          request_id?: string | null
          shift_poster_id?: string | null
          requester_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          board_id?: string | null
          shift_id?: string | null
          request_id?: string | null
          shift_poster_id?: string | null
          requester_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          user_id: string
          last_read_at: string | null
          hidden_at: string | null
        }
        Insert: {
          conversation_id: string
          user_id: string
          last_read_at?: string | null
          hidden_at?: string | null
        }
        Update: {
          conversation_id?: string
          user_id?: string
          last_read_at?: string | null
          hidden_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string | null
          body: string
          reaction: MessageReaction | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id?: string | null
          body: string
          reaction?: MessageReaction | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string | null
          body?: string
          reaction?: MessageReaction | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          type: NotificationType
          title: string
          body: string
          link_url: string
          actor_user_id: string | null
          pinned_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: NotificationType
          title: string
          body: string
          link_url: string
          actor_user_id?: string | null
          pinned_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: NotificationType
          title?: string
          body?: string
          link_url?: string
          actor_user_id?: string | null
          pinned_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      notification_recipients: {
        Row: {
          id: string
          notification_id: string
          user_id: string
          board_id: string | null
          read_at: string | null
          dismissed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          notification_id: string
          user_id: string
          board_id?: string | null
          read_at?: string | null
          dismissed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          notification_id?: string
          user_id?: string
          board_id?: string | null
          read_at?: string | null
          dismissed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_recipients_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          }
        ]
      }
      user_contact_methods: {
        Row: {
          id: string
          user_id: string
          type: ContactMethodType
          value: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: ContactMethodType
          value: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: ContactMethodType
          value?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_contact_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      get_board_invite_codes: {
        Args: { p_board_ids: string[] }
        Returns: { board_id: string; invite_code: string }[]
      }
      lookup_board_by_invite_code: {
        Args: { p_code: string }
        Returns: { id: string; name: string; is_active: boolean; invite_code_enabled: boolean }[]
      }
      reserve_schedule_import: {
        Args: Record<string, never>
        Returns: { reserved: boolean; used: number; import_limit: number }[]
      }
      release_schedule_import: { Args: Record<string, never>; Returns: undefined }
      get_schedule_import_status: {
        Args: Record<string, never>
        Returns: { membership: Membership; used: number; import_limit: number }[]
      }
      consume_schedule_import: { Args: Record<string, never>; Returns: number }
      get_or_create_ical_token: { Args: Record<string, never>; Returns: string | null }
      reset_ical_token:         { Args: Record<string, never>; Returns: string | null }
      get_users_admin: {
        Args: Record<string, never>
        Returns: {
          id: string; display_name: string | null; first_name: string | null; last_name: string | null
          avatar_url: string | null
          role: GlobalRole; is_active: boolean; created_at: string; membership: Membership
        }[]
      }
      get_pending_board_requests: {
        Args: Record<string, never>
        Returns: {
          id: string; board_id: string; user_id: string;
          requested_at: string; user_display_name: string | null; board_name: string | null
        }[]
      }
      get_or_create_conversation: { Args: { p_other_user_id: string }; Returns: string }
      get_conversations: {
        Args: Record<string, never>
        Returns: {
          conversation_id: string
          other_user_id: string | null
          other_display_name: string | null
          other_avatar_url: string | null
          last_message_body: string | null
          last_message_at: string | null
          last_message_sender_id: string | null
          unread_count: number
        }[]
      }
      get_unread_message_count: { Args: Record<string, never>; Returns: number }
      get_unread_notification_count: { Args: Record<string, never>; Returns: number }
      purge_expired_notifications: { Args: Record<string, never>; Returns: undefined }
      get_messageable_users: {
        Args: Record<string, never>
        Returns: { user_id: string; display_name: string | null; avatar_url: string | null; board_ids: string[] }[]
      }
      is_conversation_participant: { Args: { p_conversation_id: string }; Returns: boolean }
      shares_board_with: { Args: { p_other_user_id: string }; Returns: boolean }
      is_any_board_moderator: { Args: Record<string, never>; Returns: boolean }
      is_board_member:     { Args: { p_board_id: string }; Returns: boolean }
      is_board_moderator:  { Args: { p_board_id: string }; Returns: boolean }
      is_board_leader:     { Args: { p_board_id: string }; Returns: boolean }
      is_board_applicant:  { Args: { p_board_id: string }; Returns: boolean }
      expire_shifts:   { Args: Record<string, never>; Returns: void }
      expire_requests: { Args: Record<string, never>; Returns: void }
      deactivate_own_shift:   { Args: { p_shift_id: string };   Returns: boolean }
      deactivate_own_request: { Args: { p_request_id: string }; Returns: boolean }
      claim_shift:      { Args: { p_shift_id: string }; Returns: string }
      respond_to_claim: { Args: { p_claim_id: string; p_accept: boolean }; Returns: string[] }
      withdraw_claim:   { Args: { p_claim_id: string }; Returns: boolean }
      finalize_claim:   { Args: { p_claim_id: string; p_completed: boolean }; Returns: boolean }
      reactivate_shift: { Args: { p_shift_id: string }; Returns: boolean }
      get_trade_stats_for_users: {
        Args: { p_user_ids: string[] }
        Returns: { user_id: string; picked_up: number; covered: number; fell_through: number }[]
      }
      get_shift_claim_counts: {
        Args: { p_shift_ids: string[] }
        Returns: { shift_id: string; pending_count: number }[]
      }
      claim_bundle: { Args: { p_bundle_id: string }; Returns: string }
      get_bundle_claim_counts: {
        Args: { p_bundle_ids: string[] }
        Returns: { bundle_id: string; pending_count: number }[]
      }
      get_post_stats_admin: {
        Args: { p_board_id?: string | null }
        Returns: {
          shifts_added: number; shifts_active: number; shifts_user_removed: number; shifts_expired: number
          shifts_covered: number; shifts_leader_removed: number; shifts_trade_only: number; shifts_giveaway_only: number
          shifts_both: number; requests_total: number; requests_active: number; requests_user_removed: number
          requests_expired: number; requests_leader_removed: number; requests_fulfilled: number; matches_total: number
        }[]
      }
      fulfill_own_request: { Args: { p_request_id: string }; Returns: boolean }
      get_leaderboard_admin: {
        Args: { p_board_id?: string | null }
        Returns: { category: string; user_id: string; display_name: string | null; cnt: number; rank: number }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
