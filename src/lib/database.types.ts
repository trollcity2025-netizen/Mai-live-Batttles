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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          auth_user_id: string | null
          completed_at: string | null
          id: string
          requested_at: string
          retained_records_note: string | null
          status: string
          user_profile_id: string
        }
        Insert: {
          auth_user_id?: string | null
          completed_at?: string | null
          id?: string
          requested_at?: string
          retained_records_note?: string | null
          status?: string
          user_profile_id: string
        }
        Update: {
          auth_user_id?: string | null
          completed_at?: string | null
          id?: string
          requested_at?: string
          retained_records_note?: string | null
          status?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_deletion_requests_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_safety_state: {
        Row: {
          chat_restricted_until: string | null
          is_banned: boolean
          strike_count: number
          updated_at: string
          user_profile_id: string
        }
        Insert: {
          chat_restricted_until?: string | null
          is_banned?: boolean
          strike_count?: number
          updated_at?: string
          user_profile_id: string
        }
        Update: {
          chat_restricted_until?: string | null
          is_banned?: boolean
          strike_count?: number
          updated_at?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_safety_state_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_safety_state_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_safety_violations: {
        Row: {
          action: string
          category: string
          confidence: number
          created_at: string
          id: string
          moderation_event_id: string | null
          source_event_key: string
          strike_number: number
          user_profile_id: string
        }
        Insert: {
          action: string
          category: string
          confidence: number
          created_at?: string
          id?: string
          moderation_event_id?: string | null
          source_event_key: string
          strike_number: number
          user_profile_id: string
        }
        Update: {
          action?: string
          category?: string
          confidence?: number
          created_at?: string
          id?: string
          moderation_event_id?: string | null
          source_event_key?: string
          strike_number?: number
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_safety_violations_moderation_event_id_fkey"
            columns: ["moderation_event_id"]
            isOneToOne: false
            referencedRelation: "moderation_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_safety_violations_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_safety_violations_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_profile_id: string | null
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          request_id: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_profile_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          request_id?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_profile_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          request_id?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_logs_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_chat_messages: {
        Row: {
          battle_id: string
          body: string
          created_at: string
          id: string
          user_profile_id: string
        }
        Insert: {
          battle_id: string
          body: string
          created_at?: string
          id?: string
          user_profile_id: string
        }
        Update: {
          battle_id?: string
          body?: string
          created_at?: string
          id?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_chat_messages_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_chat_messages_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_chat_messages_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_chat_rate_windows: {
        Row: {
          request_count: number
          user_profile_id: string
          window_started_at: string
        }
        Insert: {
          request_count: number
          user_profile_id: string
          window_started_at: string
        }
        Update: {
          request_count?: number
          user_profile_id?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_chat_rate_windows_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_chat_rate_windows_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_events: {
        Row: {
          battle_id: string
          created_at: string
          event_type: string
          id: string
          idempotency_key: string | null
          payload: Json
          points: number
          team: string | null
          user_profile_id: string | null
        }
        Insert: {
          battle_id: string
          created_at?: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          points?: number
          team?: string | null
          user_profile_id?: string | null
        }
        Update: {
          battle_id?: string
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          points?: number
          team?: string | null
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battle_events_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_events_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_events_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_invitations: {
        Row: {
          battle_id: string
          created_at: string
          expires_at: string
          id: string
          invitee_profile_id: string
          inviter_profile_id: string
          responded_at: string | null
          status: string
          team: string
        }
        Insert: {
          battle_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invitee_profile_id: string
          inviter_profile_id: string
          responded_at?: string | null
          status?: string
          team: string
        }
        Update: {
          battle_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invitee_profile_id?: string
          inviter_profile_id?: string
          responded_at?: string | null
          status?: string
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_invitations_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_invitations_invitee_profile_id_fkey"
            columns: ["invitee_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_invitations_invitee_profile_id_fkey"
            columns: ["invitee_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_invitations_inviter_profile_id_fkey"
            columns: ["inviter_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_invitations_inviter_profile_id_fkey"
            columns: ["inviter_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_participants: {
        Row: {
          battle_id: string
          created_at: string
          id: string
          joined_at: string | null
          left_at: string | null
          moderation_event_id: string | null
          removal_reason: string | null
          state_code: string | null
          status: string
          stream_user_id: string | null
          team: string
          user_profile_id: string
        }
        Insert: {
          battle_id: string
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          moderation_event_id?: string | null
          removal_reason?: string | null
          state_code?: string | null
          status?: string
          stream_user_id?: string | null
          team: string
          user_profile_id: string
        }
        Update: {
          battle_id?: string
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          moderation_event_id?: string | null
          removal_reason?: string | null
          state_code?: string | null
          status?: string
          stream_user_id?: string | null
          team?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_participants_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_participants_moderation_fk"
            columns: ["moderation_event_id"]
            isOneToOne: false
            referencedRelation: "moderation_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_participants_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_participants_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_ratings: {
        Row: {
          best_streak: number
          losses: number
          rating: number
          streak: number
          ties: number
          updated_at: string
          user_profile_id: string
          wins: number
        }
        Insert: {
          best_streak?: number
          losses?: number
          rating?: number
          streak?: number
          ties?: number
          updated_at?: string
          user_profile_id: string
          wins?: number
        }
        Update: {
          best_streak?: number
          losses?: number
          rating?: number
          streak?: number
          ties?: number
          updated_at?: string
          user_profile_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "battle_ratings_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_ratings_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          clock_rate: number
          created_at: string
          created_by_profile_id: string
          displayed_duration_seconds: number
          ended_at: string | null
          format: string
          id: string
          is_test: boolean
          mode: string
          promotional_recording_asset_path: string | null
          promotional_recording_status: string
          real_duration_seconds: number
          result_reason: string | null
          rules_version: string
          scheduled_end_at: string | null
          started_at: string | null
          state_code: string | null
          status: string
          stream_call_id: string | null
          team_a_score: number
          team_b_score: number
          updated_at: string
          viewer_count: number
          winner_team: string | null
        }
        Insert: {
          clock_rate?: number
          created_at?: string
          created_by_profile_id: string
          displayed_duration_seconds?: number
          ended_at?: string | null
          format: string
          id?: string
          is_test?: boolean
          mode?: string
          promotional_recording_asset_path?: string | null
          promotional_recording_status?: string
          real_duration_seconds?: number
          result_reason?: string | null
          rules_version?: string
          scheduled_end_at?: string | null
          started_at?: string | null
          state_code?: string | null
          status?: string
          stream_call_id?: string | null
          team_a_score?: number
          team_b_score?: number
          updated_at?: string
          viewer_count?: number
          winner_team?: string | null
        }
        Update: {
          clock_rate?: number
          created_at?: string
          created_by_profile_id?: string
          displayed_duration_seconds?: number
          ended_at?: string | null
          format?: string
          id?: string
          is_test?: boolean
          mode?: string
          promotional_recording_asset_path?: string | null
          promotional_recording_status?: string
          real_duration_seconds?: number
          result_reason?: string | null
          rules_version?: string
          scheduled_end_at?: string | null
          started_at?: string | null
          state_code?: string | null
          status?: string
          stream_call_id?: string | null
          team_a_score?: number
          team_b_score?: number
          updated_at?: string
          viewer_count?: number
          winner_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battles_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battles_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bullet_packages: {
        Row: {
          active: boolean
          bullets: number
          created_at: string
          display_name: string
          id: string
          package_key: string
          price_usd: number
          provider_product_id: string | null
          requires_admin_confirmation: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          bullets: number
          created_at?: string
          display_name: string
          id?: string
          package_key: string
          price_usd: number
          provider_product_id?: string | null
          requires_admin_confirmation?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          bullets?: number
          created_at?: string
          display_name?: string
          id?: string
          package_key?: string
          price_usd?: number
          provider_product_id?: string | null
          requires_admin_confirmation?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      cashout_requests: {
        Row: {
          amount_bullets: number
          amount_usd: number
          created_at: string
          id: string
          idempotency_key: string
          paid_at: string | null
          paypal_payout_batch_id: string | null
          paypal_payout_item_id: string | null
          provider: string
          recipient_reference: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by_profile_id: string | null
          scheduled_processing_date: string | null
          status: string
          updated_at: string
          user_profile_id: string
        }
        Insert: {
          amount_bullets: number
          amount_usd: number
          created_at?: string
          id?: string
          idempotency_key: string
          paid_at?: string | null
          paypal_payout_batch_id?: string | null
          paypal_payout_item_id?: string | null
          provider?: string
          recipient_reference?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_profile_id?: string | null
          scheduled_processing_date?: string | null
          status?: string
          updated_at?: string
          user_profile_id: string
        }
        Update: {
          amount_bullets?: number
          amount_usd?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          paid_at?: string | null
          paypal_payout_batch_id?: string | null
          paypal_payout_item_id?: string | null
          provider?: string
          recipient_reference?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_profile_id?: string | null
          scheduled_processing_date?: string | null
          status?: string
          updated_at?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashout_requests_reviewed_by_profile_id_fkey"
            columns: ["reviewed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashout_requests_reviewed_by_profile_id_fkey"
            columns: ["reviewed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashout_requests_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashout_requests_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          accepted_at: string
          community_guidelines_version: string
          created_at: string
          id: string
          marketing_recording_consent: boolean
          privacy_version: string
          recording_consent_at: string | null
          recording_consent_version: string | null
          terms_version: string
          user_profile_id: string
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string
          community_guidelines_version: string
          created_at?: string
          id?: string
          marketing_recording_consent?: boolean
          privacy_version: string
          recording_consent_at?: string | null
          recording_consent_version?: string | null
          terms_version: string
          user_profile_id: string
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string
          community_guidelines_version?: string
          created_at?: string
          id?: string
          marketing_recording_consent?: boolean
          privacy_version?: string
          recording_consent_at?: string | null
          recording_consent_version?: string | null
          terms_version?: string
          user_profile_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_earnings: {
        Row: {
          battle_id: string | null
          created_at: string
          fee_bullets: number
          gift_transaction_id: string | null
          gross_bullets: number
          id: string
          idempotency_key: string
          net_eligible_bullets: number
          status: string
          user_profile_id: string
        }
        Insert: {
          battle_id?: string | null
          created_at?: string
          fee_bullets?: number
          gift_transaction_id?: string | null
          gross_bullets: number
          id?: string
          idempotency_key: string
          net_eligible_bullets: number
          status?: string
          user_profile_id: string
        }
        Update: {
          battle_id?: string | null
          created_at?: string
          fee_bullets?: number
          gift_transaction_id?: string | null
          gross_bullets?: number
          id?: string
          idempotency_key?: string
          net_eligible_bullets?: number
          status?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_earnings_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_gift_transaction_id_fkey"
            columns: ["gift_transaction_id"]
            isOneToOne: false
            referencedRelation: "gift_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_a_profile_id: string
          user_b_profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_a_profile_id: string
          user_b_profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_a_profile_id?: string
          user_b_profile_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_profile_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_profile_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_profile_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_profile_id: string
          blocker_profile_id: string
          created_at: string
        }
        Insert: {
          blocked_profile_id: string
          blocker_profile_id: string
          created_at?: string
        }
        Update: {
          blocked_profile_id?: string
          blocker_profile_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          actor_profile_id: string | null
          body: string
          created_at: string
          data: Json
          event_key: string
          href: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_profile_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          body: string
          created_at?: string
          data?: Json
          event_key: string
          href?: string
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_profile_id: string
        }
        Update: {
          actor_profile_id?: string | null
          body?: string
          created_at?: string
          data?: Json
          event_key?: string
          href?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_profile_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followed_profile_id: string
          follower_profile_id: string
        }
        Insert: {
          created_at?: string
          followed_profile_id: string
          follower_profile_id: string
        }
        Update: {
          created_at?: string
          followed_profile_id?: string
          follower_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followed_profile_id_fkey"
            columns: ["followed_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_followed_profile_id_fkey"
            columns: ["followed_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_profile_id_fkey"
            columns: ["follower_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_profile_id_fkey"
            columns: ["follower_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      getstream_webhook_events: {
        Row: {
          call_id: string | null
          event_type: string
          id: string
          payload_hash: string | null
          processed: boolean
          processed_at: string | null
          processing_error: string | null
          provider_event_id: string
          received_at: string
          user_profile_id: string | null
        }
        Insert: {
          call_id?: string | null
          event_type: string
          id?: string
          payload_hash?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider_event_id: string
          received_at?: string
          user_profile_id?: string | null
        }
        Update: {
          call_id?: string | null
          event_type?: string
          id?: string
          payload_hash?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider_event_id?: string
          received_at?: string
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "getstream_webhook_events_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "getstream_webhook_events_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_catalog: {
        Row: {
          active: boolean
          battle_points: number
          bullet_cost: number
          created_at: string
          display_name: string
          gift_key: string
          icon_key: string
          id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          battle_points: number
          bullet_cost: number
          created_at?: string
          display_name: string
          gift_key: string
          icon_key: string
          id?: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          battle_points?: number
          bullet_cost?: number
          created_at?: string
          display_name?: string
          gift_key?: string
          icon_key?: string
          id?: string
          sort_order?: number
        }
        Relationships: []
      }
      gift_transactions: {
        Row: {
          battle_id: string
          battle_points: number
          bullet_cost: number
          created_at: string
          gift_id: string
          id: string
          idempotency_key: string
          recipient_profile_id: string
          sender_profile_id: string
          status: string
        }
        Insert: {
          battle_id: string
          battle_points: number
          bullet_cost: number
          created_at?: string
          gift_id: string
          id?: string
          idempotency_key: string
          recipient_profile_id: string
          sender_profile_id: string
          status?: string
        }
        Update: {
          battle_id?: string
          battle_points?: number
          bullet_cost?: number
          created_at?: string
          gift_id?: string
          id?: string
          idempotency_key?: string
          recipient_profile_id?: string
          sender_profile_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gift_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_recording_consents: {
        Row: {
          consent_granted: boolean
          consent_version: string
          created_at: string
          id: string
          recorded_at: string
          source: string
          user_profile_id: string
          withdrawn_at: string | null
        }
        Insert: {
          consent_granted: boolean
          consent_version?: string
          created_at?: string
          id?: string
          recorded_at?: string
          source?: string
          user_profile_id: string
          withdrawn_at?: string | null
        }
        Update: {
          consent_granted?: boolean
          consent_version?: string
          created_at?: string
          id?: string
          recorded_at?: string
          source?: string
          user_profile_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_recording_consents_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_recording_consents_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_events: {
        Row: {
          battle_id: string | null
          category: string
          confidence: number | null
          created_at: string
          enforcement_action: string | null
          event_timestamp_ms: number | null
          id: string
          model_name: string | null
          model_version: string | null
          retention_expires_at: string | null
          review_status: string
          source_event_key: string | null
          speaker_attribution_confidence: number | null
          summary: string | null
          transcript_excerpt: string | null
          user_profile_id: string | null
        }
        Insert: {
          battle_id?: string | null
          category: string
          confidence?: number | null
          created_at?: string
          enforcement_action?: string | null
          event_timestamp_ms?: number | null
          id?: string
          model_name?: string | null
          model_version?: string | null
          retention_expires_at?: string | null
          review_status?: string
          source_event_key?: string | null
          speaker_attribution_confidence?: number | null
          summary?: string | null
          transcript_excerpt?: string | null
          user_profile_id?: string | null
        }
        Update: {
          battle_id?: string | null
          category?: string
          confidence?: number | null
          created_at?: string
          enforcement_action?: string | null
          event_timestamp_ms?: number | null
          id?: string
          model_name?: string | null
          model_version?: string | null
          retention_expires_at?: string | null
          review_status?: string
          source_event_key?: string | null
          speaker_attribution_confidence?: number | null
          summary?: string | null
          transcript_excerpt?: string | null
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_events_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          read_at: string | null
          title: string
          type: string
          user_profile_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_profile_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          event_type: string
          id: string
          payload_hash: string | null
          processed: boolean
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_event_id: string
          received_at: string
        }
        Insert: {
          event_type: string
          id?: string
          payload_hash?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          payload_hash?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
        }
        Relationships: []
      }
      payout_recipients: {
        Row: {
          created_at: string
          paypal_email: string
          updated_at: string
          user_profile_id: string
          verification_provider_ref: string | null
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          paypal_email: string
          updated_at?: string
          user_profile_id: string
          verification_provider_ref?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          paypal_email?: string
          updated_at?: string
          user_profile_id?: string
          verification_provider_ref?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_recipients_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_recipients_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount_usd: number
          bullets: number
          captured_at: string | null
          created_at: string
          credited_at: string | null
          id: string
          idempotency_key: string
          package_id: string
          provider: string
          provider_capture_id: string | null
          provider_order_id: string | null
          status: string
          user_profile_id: string
        }
        Insert: {
          amount_usd: number
          bullets: number
          captured_at?: string | null
          created_at?: string
          credited_at?: string | null
          id?: string
          idempotency_key: string
          package_id: string
          provider?: string
          provider_capture_id?: string | null
          provider_order_id?: string | null
          status?: string
          user_profile_id: string
        }
        Update: {
          amount_usd?: number
          bullets?: number
          captured_at?: string | null
          created_at?: string
          credited_at?: string | null
          id?: string
          idempotency_key?: string
          package_id?: string
          provider?: string
          provider_capture_id?: string | null
          provider_order_id?: string | null
          status?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "bullet_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_sessions: {
        Row: {
          battle_id: string
          call_id: string
          connected_at: string | null
          created_at: string
          disconnected_at: string | null
          id: string
          provider: string
          session_role: string
          session_status: string
          user_profile_id: string
        }
        Insert: {
          battle_id: string
          call_id: string
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          provider?: string
          session_role?: string
          session_status?: string
          user_profile_id: string
        }
        Update: {
          battle_id?: string
          call_id?: string
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          provider?: string
          session_role?: string
          session_status?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_sessions_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_sessions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_sessions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          account_status: string
          avatar_path: string | null
          avatar_url: string | null
          bio: string | null
          cashable_bullets: number
          city: string | null
          created_at: string
          display_name: string
          gender: string | null
          id: string
          marketing_recording_consent: boolean
          marketing_recording_consent_at: string | null
          profile_complete: boolean
          role: string
          spendable_bullets: number
          state_code: string | null
          updated_at: string
          user_id: string | null
          username: string
        }
        Insert: {
          account_status?: string
          avatar_path?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name: string
          gender?: string | null
          id?: string
          marketing_recording_consent?: boolean
          marketing_recording_consent_at?: string | null
          profile_complete?: boolean
          role?: string
          state_code?: string | null
          updated_at?: string
          user_id?: string | null
          username: string
        }
        Update: {
          account_status?: string
          avatar_path?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string
          gender?: string | null
          id?: string
          marketing_recording_consent?: boolean
          marketing_recording_consent_at?: string | null
          profile_complete?: boolean
          role?: string
          state_code?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          ai_triage_category: string | null
          ai_triage_confidence: number | null
          ai_triage_status: string
          ai_triage_summary: string | null
          battle_id: string | null
          category: string
          created_at: string
          details: string | null
          id: string
          reported_profile_id: string
          reporter_profile_id: string
          reviewed_at: string | null
          reviewed_by_profile_id: string | null
          status: string
        }
        Insert: {
          ai_triage_category?: string | null
          ai_triage_confidence?: number | null
          ai_triage_status?: string
          ai_triage_summary?: string | null
          battle_id?: string | null
          category: string
          created_at?: string
          details?: string | null
          id?: string
          reported_profile_id: string
          reporter_profile_id: string
          reviewed_at?: string | null
          reviewed_by_profile_id?: string | null
          status?: string
        }
        Update: {
          ai_triage_category?: string | null
          ai_triage_confidence?: number | null
          ai_triage_status?: string
          ai_triage_summary?: string | null
          battle_id?: string | null
          category?: string
          created_at?: string
          details?: string | null
          id?: string
          reported_profile_id?: string
          reporter_profile_id?: string
          reviewed_at?: string | null
          reviewed_by_profile_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reported_profile_id_fkey"
            columns: ["reported_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reported_profile_id_fkey"
            columns: ["reported_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_profile_id_fkey"
            columns: ["reporter_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_profile_id_fkey"
            columns: ["reporter_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reviewed_by_profile_id_fkey"
            columns: ["reviewed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reviewed_by_profile_id_fkey"
            columns: ["reviewed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          balance_after: number | null
          bullets_delta: number
          created_at: string
          id: string
          idempotency_key: string
          metadata: Json
          provider_reference: string | null
          related_cashout_id: string | null
          related_gift_transaction_id: string | null
          related_purchase_id: string | null
          transaction_type: string
          user_profile_id: string
        }
        Insert: {
          balance_after?: number | null
          bullets_delta: number
          created_at?: string
          id?: string
          idempotency_key: string
          metadata?: Json
          provider_reference?: string | null
          related_cashout_id?: string | null
          related_gift_transaction_id?: string | null
          related_purchase_id?: string | null
          transaction_type: string
          user_profile_id: string
        }
        Update: {
          balance_after?: number | null
          bullets_delta?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          provider_reference?: string | null
          related_cashout_id?: string | null
          related_gift_transaction_id?: string | null
          related_purchase_id?: string | null
          transaction_type?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_cashout_fk"
            columns: ["related_cashout_id"]
            isOneToOne: false
            referencedRelation: "cashout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_gift_fk"
            columns: ["related_gift_transaction_id"]
            isOneToOne: false
            referencedRelation: "gift_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_purchase_fk"
            columns: ["related_purchase_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          eligible_earnings_bullets: number
          purchased_bullets_lifetime: number
          reserved_cashout_bullets: number
          spendable_bullets: number
          updated_at: string
          user_profile_id: string
        }
        Insert: {
          eligible_earnings_bullets?: number
          purchased_bullets_lifetime?: number
          reserved_cashout_bullets?: number
          spendable_bullets?: number
          updated_at?: string
          user_profile_id: string
        }
        Update: {
          eligible_earnings_bullets?: number
          purchased_bullets_lifetime?: number
          reserved_cashout_bullets?: number
          spendable_bullets?: number
          updated_at?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "public_fighter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_fighter_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string | null
          display_name: string | null
          gender: string | null
          id: string | null
          state_code: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          gender?: string | null
          id?: string | null
          state_code?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          gender?: string | null
          id?: string | null
          state_code?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_my_profile_bullet_balances: {
        Args: never
        Returns: {
          cashable_bullets: number
          spendable_bullets: number
        }[]
      }
      account_safety_blocks_chat: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      apply_account_safety_offense: {
        Args: {
          p_category: string
          p_confidence: number
          p_moderation_event_id: string
          p_profile_id: string
          p_source_event_key: string
        }
        Returns: Json
      }
      apply_verified_purchase: {
        Args: {
          p_idempotency_key: string
          p_provider_capture_id: string
          p_purchase_id: string
        }
        Returns: Json
      }
      claim_battle_chat_moderation_slot: {
        Args: { p_battle_id: string; p_profile_id: string }
        Returns: boolean
      }
      current_user_profile_id: { Args: never; Returns: string }
      confirm_test_bot_connection: {
        Args: { p_battle_id: string; p_bot_profile_id: string; p_requester_profile_id: string }
        Returns: Json
      }
      finalize_battle: {
        Args: { p_battle_id: string; p_reason: string; p_winner_team: string }
        Returns: Json
      }
      is_lw_admin: { Args: never; Returns: boolean }
      enforce_battle_no_gift_cooldown: {
        Args: { p_cooldown_exempt?: boolean; p_profile_id: string }
        Returns: undefined
      }
      join_existing_battle: {
        Args: {
          p_battle_id: string
          p_cooldown_exempt?: boolean
          p_profile_id: string
          p_state_code?: string
        }
        Returns: Json
      }
      join_or_create_battle: {
        Args: {
          p_cooldown_exempt?: boolean
          p_format: string
          p_mode: string
          p_profile_id: string
          p_state_code?: string
        }
        Returns: Json
      }
      remove_moderated_participant: {
        Args: {
          p_battle_id: string
          p_moderation_event_id: string
          p_profile_id: string
          p_reason: string
        }
        Returns: Json
      }
      request_creator_cashout: {
        Args: {
          p_amount_bullets: number
          p_idempotency_key: string
          p_profile_id: string
        }
        Returns: Json
      }
      review_cashout_request: {
        Args: {
          p_action: string
          p_admin_profile_id: string
          p_cashout_id: string
          p_reason?: string
        }
        Returns: Json
      }
      send_battle_gift: {
        Args: {
          p_battle_id: string
          p_gift_key: string
          p_idempotency_key: string
          p_recipient_profile_id: string
          p_sender_profile_id: string
        }
        Returns: Json
      }
      send_test_bot_gift: {
        Args: { p_battle_id: string; p_bot_profile_id: string; p_gift_key: string; p_requester_profile_id: string }
        Returns: Json
      }
      write_test_bot_chat: {
        Args: { p_battle_id: string; p_bot_profile_id: string; p_message: string; p_requester_profile_id: string }
        Returns: undefined
      }
      settle_cashout_payout: {
        Args: {
          p_cashout_id: string
          p_outcome: string
          p_provider_reference?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
