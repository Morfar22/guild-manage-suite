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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_ip_whitelist: {
        Row: {
          added_by: string | null
          created_at: string
          description: string | null
          id: string
          ip_address: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      afk_status: {
        Row: {
          guild_id: string
          id: string
          message: string | null
          set_at: string
          user_discord_id: string
          user_name: string | null
        }
        Insert: {
          guild_id: string
          id?: string
          message?: string | null
          set_at?: string
          user_discord_id: string
          user_name?: string | null
        }
        Update: {
          guild_id?: string
          id?: string
          message?: string | null
          set_at?: string
          user_discord_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afk_status_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_automod_settings: {
        Row: {
          action: string | null
          check_hate_speech: boolean | null
          check_nsfw: boolean | null
          check_spam: boolean | null
          check_toxicity: boolean | null
          created_at: string | null
          custom_instructions: string | null
          enabled: boolean | null
          guild_id: string
          id: string
          log_channel_id: string | null
          notify_moderators: boolean | null
          sensitivity: number | null
          updated_at: string | null
        }
        Insert: {
          action?: string | null
          check_hate_speech?: boolean | null
          check_nsfw?: boolean | null
          check_spam?: boolean | null
          check_toxicity?: boolean | null
          created_at?: string | null
          custom_instructions?: string | null
          enabled?: boolean | null
          guild_id: string
          id?: string
          log_channel_id?: string | null
          notify_moderators?: boolean | null
          sensitivity?: number | null
          updated_at?: string | null
        }
        Update: {
          action?: string | null
          check_hate_speech?: boolean | null
          check_nsfw?: boolean | null
          check_spam?: boolean | null
          check_toxicity?: boolean | null
          created_at?: string | null
          custom_instructions?: string | null
          enabled?: boolean | null
          guild_id?: string
          id?: string
          log_channel_id?: string | null
          notify_moderators?: boolean | null
          sensitivity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_automod_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_history: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          guild_id: string
          id: string
          role: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          guild_id: string
          id?: string
          role: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          guild_id?: string
          id?: string
          role?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_history_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_settings: {
        Row: {
          channel_id: string | null
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          max_history_messages: number
          system_prompt: string
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          max_history_messages?: number
          system_prompt?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          max_history_messages?: number
          system_prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_safety_logs: {
        Row: {
          admin_notes: string | null
          category: string
          channel_id: string | null
          created_at: string
          discord_guild_id: string | null
          discord_user_id: string
          discord_username: string | null
          guild_id: string
          guild_name: string | null
          id: string
          matched_keywords: string[] | null
          message_content: string
          reviewed: boolean
          severity: string
        }
        Insert: {
          admin_notes?: string | null
          category?: string
          channel_id?: string | null
          created_at?: string
          discord_guild_id?: string | null
          discord_user_id: string
          discord_username?: string | null
          guild_id: string
          guild_name?: string | null
          id?: string
          matched_keywords?: string[] | null
          message_content: string
          reviewed?: boolean
          severity?: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          channel_id?: string | null
          created_at?: string
          discord_guild_id?: string | null
          discord_user_id?: string
          discord_username?: string | null
          guild_id?: string
          guild_name?: string | null
          id?: string
          matched_keywords?: string[] | null
          message_content?: string
          reviewed?: boolean
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_safety_logs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_daily_stats: {
        Row: {
          active_users: number
          commands_used: number
          created_at: string
          date: string
          guild_id: string
          id: string
          members_joined: number
          members_left: number
          messages: number
          mod_actions: number
          voice_minutes: number
          xp_gained: number
        }
        Insert: {
          active_users?: number
          commands_used?: number
          created_at?: string
          date: string
          guild_id: string
          id?: string
          members_joined?: number
          members_left?: number
          messages?: number
          mod_actions?: number
          voice_minutes?: number
          xp_gained?: number
        }
        Update: {
          active_users?: number
          commands_used?: number
          created_at?: string
          date?: string
          guild_id?: string
          id?: string
          members_joined?: number
          members_left?: number
          messages?: number
          mod_actions?: number
          voice_minutes?: number
          xp_gained?: number
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_stats_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          channel_id: string | null
          created_at: string
          event_type: string
          guild_id: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          event_type: string
          guild_id: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          event_type?: string
          guild_id?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      application_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          actor_type: string
          created_at: string
          form_id: string | null
          guild_id: string
          id: string
          payload: Json | null
          submission_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string
          created_at?: string
          form_id?: string | null
          guild_id: string
          id?: string
          payload?: Json | null
          submission_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string
          created_at?: string
          form_id?: string | null
          guild_id?: string
          id?: string
          payload?: Json | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_audit_log_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "application_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_audit_log_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_audit_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "application_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      application_forms: {
        Row: {
          ai_auto_approve_threshold: number | null
          ai_auto_deny_threshold: number | null
          ai_screening_enabled: boolean
          ai_screening_prompt: string | null
          allow_reapply: boolean
          approval_channel_id: string | null
          blacklist_role_ids: string[] | null
          color: string | null
          created_at: string
          denial_channel_id: string | null
          description: string | null
          emoji: string | null
          enabled: boolean
          granted_role_id: string | null
          guild_id: string
          id: string
          interview_category_id: string | null
          interview_enabled: boolean
          interview_questions: Json
          max_pending_per_user: number
          min_account_age_days: number | null
          name: string
          questions: Json
          reapply_cooldown_hours: number | null
          required_role_id: string | null
          required_role_ids: string[] | null
          sort_order: number
          stages: Json
          submit_message: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          ai_auto_approve_threshold?: number | null
          ai_auto_deny_threshold?: number | null
          ai_screening_enabled?: boolean
          ai_screening_prompt?: string | null
          allow_reapply?: boolean
          approval_channel_id?: string | null
          blacklist_role_ids?: string[] | null
          color?: string | null
          created_at?: string
          denial_channel_id?: string | null
          description?: string | null
          emoji?: string | null
          enabled?: boolean
          granted_role_id?: string | null
          guild_id: string
          id?: string
          interview_category_id?: string | null
          interview_enabled?: boolean
          interview_questions?: Json
          max_pending_per_user?: number
          min_account_age_days?: number | null
          name: string
          questions?: Json
          reapply_cooldown_hours?: number | null
          required_role_id?: string | null
          required_role_ids?: string[] | null
          sort_order?: number
          stages?: Json
          submit_message?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          ai_auto_approve_threshold?: number | null
          ai_auto_deny_threshold?: number | null
          ai_screening_enabled?: boolean
          ai_screening_prompt?: string | null
          allow_reapply?: boolean
          approval_channel_id?: string | null
          blacklist_role_ids?: string[] | null
          color?: string | null
          created_at?: string
          denial_channel_id?: string | null
          description?: string | null
          emoji?: string | null
          enabled?: boolean
          granted_role_id?: string | null
          guild_id?: string
          id?: string
          interview_category_id?: string | null
          interview_enabled?: boolean
          interview_questions?: Json
          max_pending_per_user?: number
          min_account_age_days?: number | null
          name?: string
          questions?: Json
          reapply_cooldown_hours?: number | null
          required_role_id?: string | null
          required_role_ids?: string[] | null
          sort_order?: number
          stages?: Json
          submit_message?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_forms_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      application_settings: {
        Row: {
          approval_message: string | null
          created_at: string
          denial_message: string | null
          dm_on_approval: boolean
          dm_on_denial: boolean
          dm_on_submit: boolean
          guild_id: string
          id: string
          log_channel_id: string | null
          panel_channel_id: string | null
          panel_message_id: string | null
          panel_type: string
          updated_at: string
        }
        Insert: {
          approval_message?: string | null
          created_at?: string
          denial_message?: string | null
          dm_on_approval?: boolean
          dm_on_denial?: boolean
          dm_on_submit?: boolean
          guild_id: string
          id?: string
          log_channel_id?: string | null
          panel_channel_id?: string | null
          panel_message_id?: string | null
          panel_type?: string
          updated_at?: string
        }
        Update: {
          approval_message?: string | null
          created_at?: string
          denial_message?: string | null
          dm_on_approval?: boolean
          dm_on_denial?: boolean
          dm_on_submit?: boolean
          guild_id?: string
          id?: string
          log_channel_id?: string | null
          panel_channel_id?: string | null
          panel_message_id?: string | null
          panel_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      application_submissions: {
        Row: {
          ai_flags: Json | null
          ai_generated_likelihood: number | null
          ai_generated_reasoning: string | null
          ai_reasoning: string | null
          ai_score: number | null
          ai_summary: string | null
          answers: Json
          created_at: string
          current_stage: string
          discord_avatar: string | null
          discord_user_id: string
          discord_username: string | null
          form_id: string
          guild_id: string
          id: string
          interview_answers: Json | null
          interview_thread_id: string | null
          review_channel_id: string | null
          review_message_id: string | null
          reviewed_at: string | null
          reviewer_discord_id: string | null
          reviewer_name: string | null
          reviewer_notes: string | null
          status: string
          time_to_review_seconds: number | null
          updated_at: string
          votes: Json
        }
        Insert: {
          ai_flags?: Json | null
          ai_generated_likelihood?: number | null
          ai_generated_reasoning?: string | null
          ai_reasoning?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          answers?: Json
          created_at?: string
          current_stage?: string
          discord_avatar?: string | null
          discord_user_id: string
          discord_username?: string | null
          form_id: string
          guild_id: string
          id?: string
          interview_answers?: Json | null
          interview_thread_id?: string | null
          review_channel_id?: string | null
          review_message_id?: string | null
          reviewed_at?: string | null
          reviewer_discord_id?: string | null
          reviewer_name?: string | null
          reviewer_notes?: string | null
          status?: string
          time_to_review_seconds?: number | null
          updated_at?: string
          votes?: Json
        }
        Update: {
          ai_flags?: Json | null
          ai_generated_likelihood?: number | null
          ai_generated_reasoning?: string | null
          ai_reasoning?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          answers?: Json
          created_at?: string
          current_stage?: string
          discord_avatar?: string | null
          discord_user_id?: string
          discord_username?: string | null
          form_id?: string
          guild_id?: string
          id?: string
          interview_answers?: Json | null
          interview_thread_id?: string | null
          review_channel_id?: string | null
          review_message_id?: string | null
          reviewed_at?: string | null
          reviewer_discord_id?: string | null
          reviewer_name?: string | null
          reviewer_notes?: string | null
          status?: string
          time_to_review_seconds?: number | null
          updated_at?: string
          votes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "application_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "application_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_submissions_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          answers: Json | null
          application_type: string
          created_at: string
          discord_user_id: string
          discord_username: string | null
          granted_role_id: string | null
          guild_id: string
          id: string
          reviewed_at: string | null
          reviewer_discord_id: string | null
          reviewer_name: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["application_status"]
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json | null
          application_type?: string
          created_at?: string
          discord_user_id: string
          discord_username?: string | null
          granted_role_id?: string | null
          guild_id: string
          id?: string
          reviewed_at?: string | null
          reviewer_discord_id?: string | null
          reviewer_name?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json | null
          application_type?: string
          created_at?: string
          discord_user_id?: string
          discord_username?: string | null
          granted_role_id?: string | null
          guild_id?: string
          id?: string
          reviewed_at?: string | null
          reviewer_discord_id?: string | null
          reviewer_name?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_report_settings: {
        Row: {
          channel_id: string | null
          created_at: string | null
          enabled: boolean | null
          frequency: string | null
          guild_id: string
          id: string
          last_sent_at: string | null
          updated_at: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          enabled?: boolean | null
          frequency?: string | null
          guild_id: string
          id?: string
          last_sent_at?: string | null
          updated_at?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          enabled?: boolean | null
          frequency?: string | null
          guild_id?: string
          id?: string
          last_sent_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_report_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_responders: {
        Row: {
          ai_instructions: string | null
          cooldown_seconds: number
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          response_content: string
          response_type: string
          trigger_text: string
          trigger_type: string
          updated_at: string
          use_ai: boolean
        }
        Insert: {
          ai_instructions?: string | null
          cooldown_seconds?: number
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          response_content: string
          response_type?: string
          trigger_text: string
          trigger_type?: string
          updated_at?: string
          use_ai?: boolean
        }
        Update: {
          ai_instructions?: string | null
          cooldown_seconds?: number
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          response_content?: string
          response_type?: string
          trigger_text?: string
          trigger_type?: string
          updated_at?: string
          use_ai?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "auto_responders_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      automod_logs: {
        Row: {
          action_taken: Database["public"]["Enums"]["automod_action"]
          channel_id: string | null
          created_at: string
          guild_id: string
          id: string
          message_content: string | null
          rule_type: Database["public"]["Enums"]["automod_rule_type"]
          user_id: string
          user_name: string | null
        }
        Insert: {
          action_taken: Database["public"]["Enums"]["automod_action"]
          channel_id?: string | null
          created_at?: string
          guild_id: string
          id?: string
          message_content?: string | null
          rule_type: Database["public"]["Enums"]["automod_rule_type"]
          user_id: string
          user_name?: string | null
        }
        Update: {
          action_taken?: Database["public"]["Enums"]["automod_action"]
          channel_id?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          message_content?: string | null
          rule_type?: Database["public"]["Enums"]["automod_rule_type"]
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automod_logs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      automod_rules: {
        Row: {
          action: Database["public"]["Enums"]["automod_action"]
          action_duration_seconds: number | null
          config: Json
          created_at: string
          enabled: boolean
          exempt_channels: string[] | null
          exempt_roles: string[] | null
          guild_id: string
          id: string
          rule_type: Database["public"]["Enums"]["automod_rule_type"]
          updated_at: string
        }
        Insert: {
          action?: Database["public"]["Enums"]["automod_action"]
          action_duration_seconds?: number | null
          config?: Json
          created_at?: string
          enabled?: boolean
          exempt_channels?: string[] | null
          exempt_roles?: string[] | null
          guild_id: string
          id?: string
          rule_type: Database["public"]["Enums"]["automod_rule_type"]
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["automod_action"]
          action_duration_seconds?: number | null
          config?: Json
          created_at?: string
          enabled?: boolean
          exempt_channels?: string[] | null
          exempt_roles?: string[] | null
          guild_id?: string
          id?: string
          rule_type?: Database["public"]["Enums"]["automod_rule_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automod_rules_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_schedules: {
        Row: {
          created_at: string
          enabled: boolean
          frequency: string
          guild_id: string
          id: string
          last_backup_at: string | null
          max_backups: number
          next_backup_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          guild_id: string
          id?: string
          last_backup_at?: string | null
          max_backups?: number
          next_backup_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          guild_id?: string
          id?: string
          last_backup_at?: string | null
          max_backups?: number
          next_backup_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_schedules_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_settings: {
        Row: {
          channel_id: string | null
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          message_template: string | null
          role_id: string | null
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          message_template?: string | null
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          message_template?: string | null
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "birthday_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      birthdays: {
        Row: {
          birthday_date: string
          created_at: string
          guild_id: string
          id: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          birthday_date: string
          created_at?: string
          guild_id: string
          id?: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          birthday_date?: string
          created_at?: string
          guild_id?: string
          id?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "birthdays_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_console_logs: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          level: string
          message: string
          metadata: Json | null
          source: string
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          level?: string
          message: string
          metadata?: Json | null
          source?: string
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_console_logs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_status: {
        Row: {
          bot_version: string | null
          cpu_percent: number | null
          created_at: string
          disk_total_gb: number | null
          disk_used_gb: number | null
          guild_id: string
          host_name: string | null
          id: string
          is_online: boolean
          last_heartbeat: string | null
          latency_ms: number | null
          load_avg_1m: number | null
          member_count: number | null
          memory_total_mb: number | null
          memory_used_mb: number | null
          message_count_today: number | null
          process_memory_mb: number | null
          updated_at: string
          uptime_seconds: number | null
        }
        Insert: {
          bot_version?: string | null
          cpu_percent?: number | null
          created_at?: string
          disk_total_gb?: number | null
          disk_used_gb?: number | null
          guild_id: string
          host_name?: string | null
          id?: string
          is_online?: boolean
          last_heartbeat?: string | null
          latency_ms?: number | null
          load_avg_1m?: number | null
          member_count?: number | null
          memory_total_mb?: number | null
          memory_used_mb?: number | null
          message_count_today?: number | null
          process_memory_mb?: number | null
          updated_at?: string
          uptime_seconds?: number | null
        }
        Update: {
          bot_version?: string | null
          cpu_percent?: number | null
          created_at?: string
          disk_total_gb?: number | null
          disk_used_gb?: number | null
          guild_id?: string
          host_name?: string | null
          id?: string
          is_online?: boolean
          last_heartbeat?: string | null
          latency_ms?: number | null
          load_avg_1m?: number | null
          member_count?: number | null
          memory_total_mb?: number | null
          memory_used_mb?: number | null
          message_count_today?: number | null
          process_memory_mb?: number | null
          updated_at?: string
          uptime_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_status_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          age: number | null
          appearance: string | null
          avatar_url: string | null
          background: string | null
          created_at: string
          discord_user_id: string
          discord_username: string | null
          faction: string | null
          guild_id: string
          id: string
          is_active: boolean
          name: string
          occupation: string | null
          status: Database["public"]["Enums"]["character_status"]
          updated_at: string
        }
        Insert: {
          age?: number | null
          appearance?: string | null
          avatar_url?: string | null
          background?: string | null
          created_at?: string
          discord_user_id: string
          discord_username?: string | null
          faction?: string | null
          guild_id: string
          id?: string
          is_active?: boolean
          name: string
          occupation?: string | null
          status?: Database["public"]["Enums"]["character_status"]
          updated_at?: string
        }
        Update: {
          age?: number | null
          appearance?: string | null
          avatar_url?: string | null
          background?: string | null
          created_at?: string
          discord_user_id?: string
          discord_username?: string | null
          faction?: string | null
          guild_id?: string
          id?: string
          is_active?: boolean
          name?: string
          occupation?: string | null
          status?: Database["public"]["Enums"]["character_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      confession_settings: {
        Row: {
          approval_channel_id: string | null
          channel_id: string | null
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          require_approval: boolean
          updated_at: string
        }
        Insert: {
          approval_channel_id?: string | null
          channel_id?: string | null
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          require_approval?: boolean
          updated_at?: string
        }
        Update: {
          approval_channel_id?: string | null
          channel_id?: string | null
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          require_approval?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "confession_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      confessions: {
        Row: {
          confession_number: number | null
          content: string
          created_at: string
          guild_id: string
          id: string
          message_id: string | null
          status: string
        }
        Insert: {
          confession_number?: number | null
          content: string
          created_at?: string
          guild_id: string
          id?: string
          message_id?: string | null
          status?: string
        }
        Update: {
          confession_number?: number | null
          content?: string
          created_at?: string
          guild_id?: string
          id?: string
          message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "confessions_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      counting_settings: {
        Row: {
          allow_same_user: boolean
          channel_id: string | null
          created_at: string
          current_count: number
          enabled: boolean
          guild_id: string
          high_score: number
          id: string
          last_counter_id: string | null
          updated_at: string
        }
        Insert: {
          allow_same_user?: boolean
          channel_id?: string | null
          created_at?: string
          current_count?: number
          enabled?: boolean
          guild_id: string
          high_score?: number
          id?: string
          last_counter_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_same_user?: boolean
          channel_id?: string | null
          created_at?: string
          current_count?: number
          enabled?: boolean
          guild_id?: string
          high_score?: number
          id?: string
          last_counter_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "counting_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_commands: {
        Row: {
          allowed_channels: string[] | null
          cooldown_seconds: number
          created_at: string
          created_by_id: string | null
          created_by_name: string | null
          description: string | null
          enabled: boolean
          guild_id: string
          id: string
          name: string
          required_role_id: string | null
          response_content: string | null
          response_embed: Json | null
          response_options: Json | null
          response_type: string
          role_id: string | null
          trigger: string
          trigger_type: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          allowed_channels?: string[] | null
          cooldown_seconds?: number
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string | null
          description?: string | null
          enabled?: boolean
          guild_id: string
          id?: string
          name: string
          required_role_id?: string | null
          response_content?: string | null
          response_embed?: Json | null
          response_options?: Json | null
          response_type?: string
          role_id?: string | null
          trigger: string
          trigger_type?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          allowed_channels?: string[] | null
          cooldown_seconds?: number
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string | null
          description?: string | null
          enabled?: boolean
          guild_id?: string
          id?: string
          name?: string
          required_role_id?: string | null
          response_content?: string | null
          response_embed?: Json | null
          response_options?: Json | null
          response_type?: string
          role_id?: string | null
          trigger?: string
          trigger_type?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_commands_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          guild_id: string
          id: string
          target_id: string | null
          target_type: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          guild_id: string
          id?: string
          target_id?: string | null
          target_type: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          guild_id?: string
          id?: string
          target_id?: string | null
          target_type?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_audit_log_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_notifications: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          is_read: boolean
          message: string | null
          metadata: Json | null
          source: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          source?: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          source?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_notifications_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      economy_accounts: {
        Row: {
          bank: number
          created_at: string
          discord_username: string | null
          guild_id: string
          id: string
          last_daily_at: string | null
          last_work_at: string | null
          total_earned: number
          updated_at: string
          user_id: string
          wallet: number
        }
        Insert: {
          bank?: number
          created_at?: string
          discord_username?: string | null
          guild_id: string
          id?: string
          last_daily_at?: string | null
          last_work_at?: string | null
          total_earned?: number
          updated_at?: string
          user_id: string
          wallet?: number
        }
        Update: {
          bank?: number
          created_at?: string
          discord_username?: string | null
          guild_id?: string
          id?: string
          last_daily_at?: string | null
          last_work_at?: string | null
          total_earned?: number
          updated_at?: string
          user_id?: string
          wallet?: number
        }
        Relationships: [
          {
            foreignKeyName: "economy_accounts_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      economy_purchases: {
        Row: {
          guild_id: string
          id: string
          item_id: string
          purchased_at: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          guild_id: string
          id?: string
          item_id: string
          purchased_at?: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          guild_id?: string
          id?: string
          item_id?: string
          purchased_at?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economy_purchases_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economy_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "economy_shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      economy_settings: {
        Row: {
          created_at: string
          currency_name: string
          currency_symbol: string
          daily_amount: number
          daily_cooldown_hours: number
          guild_id: string
          id: string
          starting_balance: number
          updated_at: string
          work_cooldown_minutes: number
          work_max: number
          work_min: number
        }
        Insert: {
          created_at?: string
          currency_name?: string
          currency_symbol?: string
          daily_amount?: number
          daily_cooldown_hours?: number
          guild_id: string
          id?: string
          starting_balance?: number
          updated_at?: string
          work_cooldown_minutes?: number
          work_max?: number
          work_min?: number
        }
        Update: {
          created_at?: string
          currency_name?: string
          currency_symbol?: string
          daily_amount?: number
          daily_cooldown_hours?: number
          guild_id?: string
          id?: string
          starting_balance?: number
          updated_at?: string
          work_cooldown_minutes?: number
          work_max?: number
          work_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "economy_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      economy_shop_items: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          guild_id: string
          id: string
          name: string
          price: number
          role_id: string | null
          stock: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          guild_id: string
          id?: string
          name: string
          price?: number
          role_id?: string | null
          stock?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          guild_id?: string
          id?: string
          name?: string
          price?: number
          role_id?: string | null
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "economy_shop_items_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      economy_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          from_user_id: string | null
          guild_id: string
          id: string
          to_user_id: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          from_user_id?: string | null
          guild_id: string
          id?: string
          to_user_id: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          from_user_id?: string | null
          guild_id?: string
          id?: string
          to_user_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "economy_transactions_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      fivem_action_logs: {
        Row: {
          action_type: string
          created_at: string
          duration_seconds: number | null
          guild_id: string
          id: string
          metadata: Json | null
          moderator_discord_id: string
          moderator_name: string | null
          reason: string | null
          target_discord_id: string | null
          target_name: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          duration_seconds?: number | null
          guild_id: string
          id?: string
          metadata?: Json | null
          moderator_discord_id: string
          moderator_name?: string | null
          reason?: string | null
          target_discord_id?: string | null
          target_name?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          duration_seconds?: number | null
          guild_id?: string
          id?: string
          metadata?: Json | null
          moderator_discord_id?: string
          moderator_name?: string | null
          reason?: string | null
          target_discord_id?: string | null
          target_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fivem_action_logs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      fivem_bans: {
        Row: {
          banned_at: string
          banned_by_discord_id: string
          banned_by_name: string | null
          discord_user_id: string
          discord_username: string | null
          expires_at: string | null
          guild_id: string
          id: string
          ip_address: string | null
          is_active: boolean
          license: string | null
          reason: string
          steam_hex: string | null
          unbanned_at: string | null
          unbanned_by: string | null
        }
        Insert: {
          banned_at?: string
          banned_by_discord_id: string
          banned_by_name?: string | null
          discord_user_id: string
          discord_username?: string | null
          expires_at?: string | null
          guild_id: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          license?: string | null
          reason: string
          steam_hex?: string | null
          unbanned_at?: string | null
          unbanned_by?: string | null
        }
        Update: {
          banned_at?: string
          banned_by_discord_id?: string
          banned_by_name?: string | null
          discord_user_id?: string
          discord_username?: string | null
          expires_at?: string | null
          guild_id?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          license?: string | null
          reason?: string
          steam_hex?: string | null
          unbanned_at?: string | null
          unbanned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fivem_bans_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      fivem_command_queue: {
        Row: {
          command_data: Json
          command_name: string
          created_at: string
          executed_at: string | null
          guild_id: string
          id: string
          moderator_discord_id: string
          moderator_name: string | null
          result: string | null
          status: string
          target_discord_id: string | null
          target_name: string | null
          target_player_id: number | null
        }
        Insert: {
          command_data?: Json
          command_name: string
          created_at?: string
          executed_at?: string | null
          guild_id: string
          id?: string
          moderator_discord_id: string
          moderator_name?: string | null
          result?: string | null
          status?: string
          target_discord_id?: string | null
          target_name?: string | null
          target_player_id?: number | null
        }
        Update: {
          command_data?: Json
          command_name?: string
          created_at?: string
          executed_at?: string | null
          guild_id?: string
          id?: string
          moderator_discord_id?: string
          moderator_name?: string | null
          result?: string | null
          status?: string
          target_discord_id?: string | null
          target_name?: string | null
          target_player_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fivem_command_queue_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      fivem_online_players: {
        Row: {
          character_name: string | null
          coords: Json | null
          discord_user_id: string | null
          discord_username: string | null
          guild_id: string
          id: string
          joined_at: string
          last_update: string
          license: string | null
          ping: number | null
          player_id: number
          server_id: string
          steam_hex: string | null
        }
        Insert: {
          character_name?: string | null
          coords?: Json | null
          discord_user_id?: string | null
          discord_username?: string | null
          guild_id: string
          id?: string
          joined_at?: string
          last_update?: string
          license?: string | null
          ping?: number | null
          player_id: number
          server_id: string
          steam_hex?: string | null
        }
        Update: {
          character_name?: string | null
          coords?: Json | null
          discord_user_id?: string | null
          discord_username?: string | null
          guild_id?: string
          id?: string
          joined_at?: string
          last_update?: string
          license?: string | null
          ping?: number | null
          player_id?: number
          server_id?: string
          steam_hex?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fivem_online_players_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      fivem_role_permissions: {
        Row: {
          ace_permissions: string[] | null
          created_at: string
          discord_role_id: string
          discord_role_name: string | null
          guild_id: string
          id: string
          permission_level: string
          updated_at: string
        }
        Insert: {
          ace_permissions?: string[] | null
          created_at?: string
          discord_role_id: string
          discord_role_name?: string | null
          guild_id: string
          id?: string
          permission_level?: string
          updated_at?: string
        }
        Update: {
          ace_permissions?: string[] | null
          created_at?: string
          discord_role_id?: string
          discord_role_name?: string | null
          guild_id?: string
          id?: string
          permission_level?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fivem_role_permissions_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      fivem_server_status: {
        Row: {
          created_at: string
          fxserver_version: string | null
          game_type: string | null
          guild_id: string
          id: string
          is_online: boolean | null
          last_heartbeat: string | null
          map_name: string | null
          max_players: number | null
          metadata: Json | null
          next_restart_at: string | null
          player_count: number | null
          resources_count: number | null
          restart_schedule: string[] | null
          server_id: string
          server_ip: string | null
          server_name: string | null
          server_port: number | null
          server_started_at: string | null
          txadmin_version: string | null
          updated_at: string
          uptime_seconds: number | null
        }
        Insert: {
          created_at?: string
          fxserver_version?: string | null
          game_type?: string | null
          guild_id: string
          id?: string
          is_online?: boolean | null
          last_heartbeat?: string | null
          map_name?: string | null
          max_players?: number | null
          metadata?: Json | null
          next_restart_at?: string | null
          player_count?: number | null
          resources_count?: number | null
          restart_schedule?: string[] | null
          server_id?: string
          server_ip?: string | null
          server_name?: string | null
          server_port?: number | null
          server_started_at?: string | null
          txadmin_version?: string | null
          updated_at?: string
          uptime_seconds?: number | null
        }
        Update: {
          created_at?: string
          fxserver_version?: string | null
          game_type?: string | null
          guild_id?: string
          id?: string
          is_online?: boolean | null
          last_heartbeat?: string | null
          map_name?: string | null
          max_players?: number | null
          metadata?: Json | null
          next_restart_at?: string | null
          player_count?: number | null
          resources_count?: number | null
          restart_schedule?: string[] | null
          server_id?: string
          server_ip?: string | null
          server_name?: string | null
          server_port?: number | null
          server_started_at?: string | null
          txadmin_version?: string | null
          updated_at?: string
          uptime_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fivem_server_status_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      fivem_sessions: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          server_id: string | null
          session_end: string | null
          session_start: string
          whitelist_id: string | null
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          server_id?: string | null
          session_end?: string | null
          session_start?: string
          whitelist_id?: string | null
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          server_id?: string | null
          session_end?: string | null
          session_start?: string
          whitelist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fivem_sessions_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fivem_sessions_whitelist_id_fkey"
            columns: ["whitelist_id"]
            isOneToOne: false
            referencedRelation: "fivem_whitelist"
            referencedColumns: ["id"]
          },
        ]
      }
      fivem_settings: {
        Row: {
          admin_role_ids: string[] | null
          announcement_channel_id: string | null
          auto_whitelist_role_id: string | null
          cfx_code: string | null
          created_at: string
          enabled: boolean
          god_role_ids: string[] | null
          guild_id: string
          id: string
          log_channel_id: string | null
          log_webhook_url: string | null
          mod_role_ids: string[] | null
          server_ip: string | null
          server_name: string | null
          staff_chat_channel_id: string | null
          staff_role_ids: string[] | null
          status_message_id: string | null
          status_webhook_url: string | null
          sync_discord_roles: boolean
          sync_playtime: boolean
          updated_at: string
          whitelist_application_form_id: string | null
          whitelist_enabled: boolean
          whitelisted_role_id: string | null
        }
        Insert: {
          admin_role_ids?: string[] | null
          announcement_channel_id?: string | null
          auto_whitelist_role_id?: string | null
          cfx_code?: string | null
          created_at?: string
          enabled?: boolean
          god_role_ids?: string[] | null
          guild_id: string
          id?: string
          log_channel_id?: string | null
          log_webhook_url?: string | null
          mod_role_ids?: string[] | null
          server_ip?: string | null
          server_name?: string | null
          staff_chat_channel_id?: string | null
          staff_role_ids?: string[] | null
          status_message_id?: string | null
          status_webhook_url?: string | null
          sync_discord_roles?: boolean
          sync_playtime?: boolean
          updated_at?: string
          whitelist_application_form_id?: string | null
          whitelist_enabled?: boolean
          whitelisted_role_id?: string | null
        }
        Update: {
          admin_role_ids?: string[] | null
          announcement_channel_id?: string | null
          auto_whitelist_role_id?: string | null
          cfx_code?: string | null
          created_at?: string
          enabled?: boolean
          god_role_ids?: string[] | null
          guild_id?: string
          id?: string
          log_channel_id?: string | null
          log_webhook_url?: string | null
          mod_role_ids?: string[] | null
          server_ip?: string | null
          server_name?: string | null
          staff_chat_channel_id?: string | null
          staff_role_ids?: string[] | null
          status_message_id?: string | null
          status_webhook_url?: string | null
          sync_discord_roles?: boolean
          sync_playtime?: boolean
          updated_at?: string
          whitelist_application_form_id?: string | null
          whitelist_enabled?: boolean
          whitelisted_role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fivem_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fivem_settings_whitelist_application_form_id_fkey"
            columns: ["whitelist_application_form_id"]
            isOneToOne: false
            referencedRelation: "application_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      fivem_whitelist: {
        Row: {
          created_at: string
          discord_id: string | null
          discord_user_id: string
          discord_username: string | null
          fivem_id: string | null
          guild_id: string
          id: string
          ip_address: string | null
          is_whitelisted: boolean
          last_seen_at: string | null
          license: string | null
          notes: string | null
          playtime_minutes: number | null
          priority_level: number | null
          steam_hex: string | null
          updated_at: string
          whitelist_reason: string | null
          whitelisted_at: string | null
          whitelisted_by: string | null
        }
        Insert: {
          created_at?: string
          discord_id?: string | null
          discord_user_id: string
          discord_username?: string | null
          fivem_id?: string | null
          guild_id: string
          id?: string
          ip_address?: string | null
          is_whitelisted?: boolean
          last_seen_at?: string | null
          license?: string | null
          notes?: string | null
          playtime_minutes?: number | null
          priority_level?: number | null
          steam_hex?: string | null
          updated_at?: string
          whitelist_reason?: string | null
          whitelisted_at?: string | null
          whitelisted_by?: string | null
        }
        Update: {
          created_at?: string
          discord_id?: string | null
          discord_user_id?: string
          discord_username?: string | null
          fivem_id?: string | null
          guild_id?: string
          id?: string
          ip_address?: string | null
          is_whitelisted?: boolean
          last_seen_at?: string | null
          license?: string | null
          notes?: string | null
          playtime_minutes?: number | null
          priority_level?: number | null
          steam_hex?: string | null
          updated_at?: string
          whitelist_reason?: string | null
          whitelisted_at?: string | null
          whitelisted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fivem_whitelist_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaways: {
        Row: {
          channel_id: string
          created_at: string
          description: string | null
          ended: boolean
          ends_at: string
          entries: Json
          guild_id: string
          host_user_id: string
          host_username: string | null
          id: string
          message_id: string | null
          paused: boolean
          prize: string
          required_role_id: string | null
          updated_at: string
          winners: Json | null
          winners_count: number
        }
        Insert: {
          channel_id: string
          created_at?: string
          description?: string | null
          ended?: boolean
          ends_at: string
          entries?: Json
          guild_id: string
          host_user_id: string
          host_username?: string | null
          id?: string
          message_id?: string | null
          paused?: boolean
          prize: string
          required_role_id?: string | null
          updated_at?: string
          winners?: Json | null
          winners_count?: number
        }
        Update: {
          channel_id?: string
          created_at?: string
          description?: string | null
          ended?: boolean
          ends_at?: string
          entries?: Json
          guild_id?: string
          host_user_id?: string
          host_username?: string | null
          id?: string
          message_id?: string | null
          paused?: boolean
          prize?: string
          required_role_id?: string | null
          updated_at?: string
          winners?: Json | null
          winners_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "giveaways_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      global_ban_alerts: {
        Row: {
          action_taken: string | null
          alert_type: string
          ban_id: string
          created_at: string
          dismissed: boolean
          guild_id: string
          id: string
          member_discord_id: string
        }
        Insert: {
          action_taken?: string | null
          alert_type?: string
          ban_id: string
          created_at?: string
          dismissed?: boolean
          guild_id: string
          id?: string
          member_discord_id: string
        }
        Update: {
          action_taken?: string | null
          alert_type?: string
          ban_id?: string
          created_at?: string
          dismissed?: boolean
          guild_id?: string
          id?: string
          member_discord_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_ban_alerts_ban_id_fkey"
            columns: ["ban_id"]
            isOneToOne: false
            referencedRelation: "global_bans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_ban_alerts_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      global_ban_appeals: {
        Row: {
          appellant_discord_id: string
          appellant_discord_name: string
          ban_id: string
          created_at: string
          id: string
          reason: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          appellant_discord_id: string
          appellant_discord_name: string
          ban_id: string
          created_at?: string
          id?: string
          reason: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          appellant_discord_id?: string
          appellant_discord_name?: string
          ban_id?: string
          created_at?: string
          id?: string
          reason?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_ban_appeals_ban_id_fkey"
            columns: ["ban_id"]
            isOneToOne: false
            referencedRelation: "global_bans"
            referencedColumns: ["id"]
          },
        ]
      }
      global_ban_executions: {
        Row: {
          error_message: string | null
          executed: boolean
          executed_at: string | null
          global_ban_id: string
          guild_id: string
          id: string
        }
        Insert: {
          error_message?: string | null
          executed?: boolean
          executed_at?: string | null
          global_ban_id: string
          guild_id: string
          id?: string
        }
        Update: {
          error_message?: string | null
          executed?: boolean
          executed_at?: string | null
          global_ban_id?: string
          guild_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_ban_executions_global_ban_id_fkey"
            columns: ["global_ban_id"]
            isOneToOne: false
            referencedRelation: "global_bans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_ban_executions_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      global_ban_reports: {
        Row: {
          created_at: string
          evidence_urls: string[] | null
          id: string
          reason: string
          reporter_discord_id: string
          reporter_discord_name: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string | null
          status: Database["public"]["Enums"]["global_ban_status"]
          target_discord_id: string
          target_discord_name: string
        }
        Insert: {
          created_at?: string
          evidence_urls?: string[] | null
          id?: string
          reason: string
          reporter_discord_id: string
          reporter_discord_name: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: Database["public"]["Enums"]["global_ban_status"]
          target_discord_id: string
          target_discord_name: string
        }
        Update: {
          created_at?: string
          evidence_urls?: string[] | null
          id?: string
          reason?: string
          reporter_discord_id?: string
          reporter_discord_name?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: Database["public"]["Enums"]["global_ban_status"]
          target_discord_id?: string
          target_discord_name?: string
        }
        Relationships: []
      }
      global_bans: {
        Row: {
          banned_by: string | null
          created_at: string
          id: string
          reason: string
          report_id: string | null
          severity: string | null
          target_discord_id: string
          target_discord_name: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          id?: string
          reason: string
          report_id?: string | null
          severity?: string | null
          target_discord_id: string
          target_discord_name: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          id?: string
          reason?: string
          report_id?: string | null
          severity?: string | null
          target_discord_id?: string
          target_discord_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_bans_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "global_ban_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_bot_settings: {
        Row: {
          auto_backup_enabled: boolean | null
          auto_backup_interval: string | null
          auto_backup_last_run: string | null
          bot_activity_text: string | null
          bot_activity_type: string | null
          bot_avatar_url: string | null
          bot_client_id: string | null
          bot_name: string | null
          bot_public_key: string | null
          bot_status: string | null
          bot_token_encrypted: string | null
          command_prefix: string
          created_at: string
          global_ban_auto_action: string | null
          global_ban_opt_out: boolean
          global_ban_severity_filter: Json | null
          guild_id: string
          id: string
          is_active: boolean
          is_custom_bot: boolean
          last_connected_at: string | null
          updated_at: string
        }
        Insert: {
          auto_backup_enabled?: boolean | null
          auto_backup_interval?: string | null
          auto_backup_last_run?: string | null
          bot_activity_text?: string | null
          bot_activity_type?: string | null
          bot_avatar_url?: string | null
          bot_client_id?: string | null
          bot_name?: string | null
          bot_public_key?: string | null
          bot_status?: string | null
          bot_token_encrypted?: string | null
          command_prefix?: string
          created_at?: string
          global_ban_auto_action?: string | null
          global_ban_opt_out?: boolean
          global_ban_severity_filter?: Json | null
          guild_id: string
          id?: string
          is_active?: boolean
          is_custom_bot?: boolean
          last_connected_at?: string | null
          updated_at?: string
        }
        Update: {
          auto_backup_enabled?: boolean | null
          auto_backup_interval?: string | null
          auto_backup_last_run?: string | null
          bot_activity_text?: string | null
          bot_activity_type?: string | null
          bot_avatar_url?: string | null
          bot_client_id?: string | null
          bot_name?: string | null
          bot_public_key?: string | null
          bot_status?: string | null
          bot_token_encrypted?: string | null
          command_prefix?: string
          created_at?: string
          global_ban_auto_action?: string | null
          global_ban_opt_out?: boolean
          global_ban_severity_filter?: Json | null
          guild_id?: string
          id?: string
          is_active?: boolean
          is_custom_bot?: boolean
          last_connected_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_bot_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_commands: {
        Row: {
          category: string
          command_name: string
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          updated_at: string
        }
        Insert: {
          category: string
          command_name: string
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          category?: string
          command_name?: string
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_commands_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_modules: {
        Row: {
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          module_type: Database["public"]["Enums"]["module_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          module_type: Database["public"]["Enums"]["module_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          module_type?: Database["public"]["Enums"]["module_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_modules_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_premium_features: {
        Row: {
          created_at: string
          enabled: boolean
          enabled_at: string
          enabled_by: string | null
          expires_at: string | null
          feature: string
          guild_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          enabled_at?: string
          enabled_by?: string | null
          expires_at?: string | null
          feature: string
          guild_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          enabled_at?: string
          enabled_by?: string | null
          expires_at?: string | null
          feature?: string
          guild_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_premium_features_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      guilds: {
        Row: {
          auto_moderation_enabled: boolean
          automod_bypass_role_ids: string[]
          command_prefix: string
          created_at: string
          guild_icon: string | null
          guild_id: string
          guild_name: string
          id: string
          log_channel_id: string | null
          owner_id: string
          staff_role_id: string | null
          updated_at: string
          whitelist_role_id: string | null
        }
        Insert: {
          auto_moderation_enabled?: boolean
          automod_bypass_role_ids?: string[]
          command_prefix?: string
          created_at?: string
          guild_icon?: string | null
          guild_id: string
          guild_name: string
          id?: string
          log_channel_id?: string | null
          owner_id: string
          staff_role_id?: string | null
          updated_at?: string
          whitelist_role_id?: string | null
        }
        Update: {
          auto_moderation_enabled?: boolean
          automod_bypass_role_ids?: string[]
          command_prefix?: string
          created_at?: string
          guild_icon?: string | null
          guild_id?: string
          guild_name?: string
          id?: string
          log_channel_id?: string | null
          owner_id?: string
          staff_role_id?: string | null
          updated_at?: string
          whitelist_role_id?: string | null
        }
        Relationships: []
      }
      invite_tracker: {
        Row: {
          channel_id: string | null
          created_at: string
          expires_at: string | null
          guild_id: string
          id: string
          invite_code: string
          inviter_discord_id: string | null
          inviter_username: string | null
          max_uses: number | null
          updated_at: string
          uses: number
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          expires_at?: string | null
          guild_id: string
          id?: string
          invite_code: string
          inviter_discord_id?: string | null
          inviter_username?: string | null
          max_uses?: number | null
          updated_at?: string
          uses?: number
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          expires_at?: string | null
          guild_id?: string
          id?: string
          invite_code?: string
          inviter_discord_id?: string | null
          inviter_username?: string | null
          max_uses?: number | null
          updated_at?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_tracker_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_uses: {
        Row: {
          guild_id: string
          has_left: boolean
          id: string
          invite_code: string | null
          inviter_discord_id: string | null
          inviter_username: string | null
          is_fake: boolean
          joined_account_created_at: string | null
          joined_at: string
          joined_user_id: string
          joined_username: string | null
          left_at: string | null
        }
        Insert: {
          guild_id: string
          has_left?: boolean
          id?: string
          invite_code?: string | null
          inviter_discord_id?: string | null
          inviter_username?: string | null
          is_fake?: boolean
          joined_account_created_at?: string | null
          joined_at?: string
          joined_user_id: string
          joined_username?: string | null
          left_at?: string | null
        }
        Update: {
          guild_id?: string
          has_left?: boolean
          id?: string
          invite_code?: string | null
          inviter_discord_id?: string | null
          inviter_username?: string | null
          is_fake?: boolean
          joined_account_created_at?: string | null
          joined_at?: string
          joined_user_id?: string
          joined_username?: string | null
          left_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_uses_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      jtc_channels: {
        Row: {
          channel_id: string
          control_channel_id: string | null
          created_at: string
          guild_id: string
          id: string
          owner_id: string
          owner_name: string | null
          trigger_id: string | null
        }
        Insert: {
          channel_id: string
          control_channel_id?: string | null
          created_at?: string
          guild_id: string
          id?: string
          owner_id: string
          owner_name?: string | null
          trigger_id?: string | null
        }
        Update: {
          channel_id?: string
          control_channel_id?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          owner_id?: string
          owner_name?: string | null
          trigger_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jtc_channels_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jtc_channels_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "jtc_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      jtc_settings: {
        Row: {
          category_id: string | null
          channel_name_template: string | null
          created_at: string
          default_user_limit: number | null
          enabled: boolean
          guild_id: string
          id: string
          trigger_channel_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          channel_name_template?: string | null
          created_at?: string
          default_user_limit?: number | null
          enabled?: boolean
          guild_id: string
          id?: string
          trigger_channel_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          channel_name_template?: string | null
          created_at?: string
          default_user_limit?: number | null
          enabled?: boolean
          guild_id?: string
          id?: string
          trigger_channel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jtc_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      jtc_triggers: {
        Row: {
          category_id: string | null
          channel_name_template: string
          created_at: string
          default_user_limit: number
          enabled: boolean
          guild_id: string
          id: string
          name: string
          required_role_id: string | null
          required_role_name: string | null
          trigger_channel_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          channel_name_template?: string
          created_at?: string
          default_user_limit?: number
          enabled?: boolean
          guild_id: string
          id?: string
          name?: string
          required_role_id?: string | null
          required_role_name?: string | null
          trigger_channel_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          channel_name_template?: string
          created_at?: string
          default_user_limit?: number
          enabled?: boolean
          guild_id?: string
          id?: string
          name?: string
          required_role_id?: string | null
          required_role_name?: string | null
          trigger_channel_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jtc_triggers_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      level_roles: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          level_required: number
          role_id: string
          role_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          level_required: number
          role_id: string
          role_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          level_required?: number
          role_id?: string
          role_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "level_roles_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      leveling_settings: {
        Row: {
          blacklist_channels: string[] | null
          cooldown_seconds: number
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          level_up_channel_id: string | null
          level_up_message: string | null
          updated_at: string
          voice_xp_cooldown_seconds: number | null
          voice_xp_enabled: boolean | null
          voice_xp_per_minute: number | null
          xp_per_message_max: number
          xp_per_message_min: number
        }
        Insert: {
          blacklist_channels?: string[] | null
          cooldown_seconds?: number
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          level_up_channel_id?: string | null
          level_up_message?: string | null
          updated_at?: string
          voice_xp_cooldown_seconds?: number | null
          voice_xp_enabled?: boolean | null
          voice_xp_per_minute?: number | null
          xp_per_message_max?: number
          xp_per_message_min?: number
        }
        Update: {
          blacklist_channels?: string[] | null
          cooldown_seconds?: number
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          level_up_channel_id?: string | null
          level_up_message?: string | null
          updated_at?: string
          voice_xp_cooldown_seconds?: number | null
          voice_xp_enabled?: boolean | null
          voice_xp_per_minute?: number | null
          xp_per_message_max?: number
          xp_per_message_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "leveling_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      log_event_dedup: {
        Row: {
          created_at: string
          event_hash: string
          guild_id: string
          id: string
        }
        Insert: {
          created_at?: string
          event_hash: string
          guild_id: string
          id?: string
        }
        Update: {
          created_at?: string
          event_hash?: string
          guild_id?: string
          id?: string
        }
        Relationships: []
      }
      log_settings: {
        Row: {
          boost_channel_id: string | null
          created_at: string
          guild_id: string
          id: string
          log_avatar_change: boolean
          log_channel_create: boolean
          log_channel_delete: boolean
          log_channel_id: string | null
          log_channel_update: boolean
          log_command_used: boolean
          log_emoji_create: boolean
          log_emoji_delete: boolean
          log_emoji_update: boolean
          log_invite_create: boolean
          log_invite_delete: boolean
          log_member_ban: boolean
          log_member_join: boolean
          log_member_kick: boolean
          log_member_leave: boolean
          log_member_timeout: boolean | null
          log_member_unban: boolean
          log_member_untimeout: boolean | null
          log_member_voice_move: boolean
          log_message_bulk_delete: boolean
          log_message_delete: boolean
          log_message_edit: boolean
          log_message_pin: boolean | null
          log_message_unpin: boolean | null
          log_nickname_change: boolean
          log_role_add: boolean
          log_role_create: boolean
          log_role_delete: boolean
          log_role_remove: boolean
          log_role_update: boolean
          log_screen_share_start: boolean
          log_screen_share_stop: boolean
          log_server_boost: boolean
          log_server_boost_remove: boolean
          log_server_update: boolean | null
          log_sticker_create: boolean
          log_sticker_delete: boolean
          log_thread_archive: boolean
          log_thread_create: boolean
          log_thread_delete: boolean
          log_voice_join: boolean
          log_voice_leave: boolean
          log_voice_move: boolean
          log_voice_server_deafen: boolean
          log_voice_server_mute: boolean
          updated_at: string
        }
        Insert: {
          boost_channel_id?: string | null
          created_at?: string
          guild_id: string
          id?: string
          log_avatar_change?: boolean
          log_channel_create?: boolean
          log_channel_delete?: boolean
          log_channel_id?: string | null
          log_channel_update?: boolean
          log_command_used?: boolean
          log_emoji_create?: boolean
          log_emoji_delete?: boolean
          log_emoji_update?: boolean
          log_invite_create?: boolean
          log_invite_delete?: boolean
          log_member_ban?: boolean
          log_member_join?: boolean
          log_member_kick?: boolean
          log_member_leave?: boolean
          log_member_timeout?: boolean | null
          log_member_unban?: boolean
          log_member_untimeout?: boolean | null
          log_member_voice_move?: boolean
          log_message_bulk_delete?: boolean
          log_message_delete?: boolean
          log_message_edit?: boolean
          log_message_pin?: boolean | null
          log_message_unpin?: boolean | null
          log_nickname_change?: boolean
          log_role_add?: boolean
          log_role_create?: boolean
          log_role_delete?: boolean
          log_role_remove?: boolean
          log_role_update?: boolean
          log_screen_share_start?: boolean
          log_screen_share_stop?: boolean
          log_server_boost?: boolean
          log_server_boost_remove?: boolean
          log_server_update?: boolean | null
          log_sticker_create?: boolean
          log_sticker_delete?: boolean
          log_thread_archive?: boolean
          log_thread_create?: boolean
          log_thread_delete?: boolean
          log_voice_join?: boolean
          log_voice_leave?: boolean
          log_voice_move?: boolean
          log_voice_server_deafen?: boolean
          log_voice_server_mute?: boolean
          updated_at?: string
        }
        Update: {
          boost_channel_id?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          log_avatar_change?: boolean
          log_channel_create?: boolean
          log_channel_delete?: boolean
          log_channel_id?: string | null
          log_channel_update?: boolean
          log_command_used?: boolean
          log_emoji_create?: boolean
          log_emoji_delete?: boolean
          log_emoji_update?: boolean
          log_invite_create?: boolean
          log_invite_delete?: boolean
          log_member_ban?: boolean
          log_member_join?: boolean
          log_member_kick?: boolean
          log_member_leave?: boolean
          log_member_timeout?: boolean | null
          log_member_unban?: boolean
          log_member_untimeout?: boolean | null
          log_member_voice_move?: boolean
          log_message_bulk_delete?: boolean
          log_message_delete?: boolean
          log_message_edit?: boolean
          log_message_pin?: boolean | null
          log_message_unpin?: boolean | null
          log_nickname_change?: boolean
          log_role_add?: boolean
          log_role_create?: boolean
          log_role_delete?: boolean
          log_role_remove?: boolean
          log_role_update?: boolean
          log_screen_share_start?: boolean
          log_screen_share_stop?: boolean
          log_server_boost?: boolean
          log_server_boost_remove?: boolean
          log_server_update?: boolean | null
          log_sticker_create?: boolean
          log_sticker_delete?: boolean
          log_thread_archive?: boolean
          log_thread_create?: boolean
          log_thread_delete?: boolean
          log_voice_join?: boolean
          log_voice_leave?: boolean
          log_voice_move?: boolean
          log_voice_server_deafen?: boolean
          log_voice_server_mute?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      member_activity: {
        Row: {
          guild_id: string
          id: string
          last_message_at: string | null
          last_voice_at: string | null
          message_count_30d: number
          updated_at: string
          user_discord_id: string
          user_name: string | null
        }
        Insert: {
          guild_id: string
          id?: string
          last_message_at?: string | null
          last_voice_at?: string | null
          message_count_30d?: number
          updated_at?: string
          user_discord_id: string
          user_name?: string | null
        }
        Update: {
          guild_id?: string
          id?: string
          last_message_at?: string | null
          last_voice_at?: string | null
          message_count_30d?: number
          updated_at?: string
          user_discord_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_activity_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["moderation_action_type"]
          created_at: string
          duration_seconds: number | null
          guild_id: string
          id: string
          moderator_id: string
          moderator_name: string | null
          reason: string | null
          target_id: string
          target_name: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["moderation_action_type"]
          created_at?: string
          duration_seconds?: number | null
          guild_id: string
          id?: string
          moderator_id: string
          moderator_name?: string | null
          reason?: string | null
          target_id: string
          target_name?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["moderation_action_type"]
          created_at?: string
          duration_seconds?: number | null
          guild_id?: string
          id?: string
          moderator_id?: string
          moderator_name?: string | null
          reason?: string | null
          target_id?: string
          target_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_logs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_templates: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          name: string
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          name: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          name?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_templates_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      modmail_messages: {
        Row: {
          attachments: Json | null
          author_id: string
          author_name: string | null
          author_type: string
          content: string
          created_at: string
          id: string
          thread_id: string
        }
        Insert: {
          attachments?: Json | null
          author_id: string
          author_name?: string | null
          author_type: string
          content: string
          created_at?: string
          id?: string
          thread_id: string
        }
        Update: {
          attachments?: Json | null
          author_id?: string
          author_name?: string | null
          author_type?: string
          content?: string
          created_at?: string
          id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modmail_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "modmail_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      modmail_settings: {
        Row: {
          category_id: string | null
          close_message: string | null
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          log_channel_id: string | null
          staff_role_id: string | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          category_id?: string | null
          close_message?: string | null
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          log_channel_id?: string | null
          staff_role_id?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          category_id?: string | null
          close_message?: string | null
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          log_channel_id?: string | null
          staff_role_id?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modmail_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      modmail_threads: {
        Row: {
          channel_id: string | null
          claimed_by_id: string | null
          claimed_by_name: string | null
          closed_at: string | null
          created_at: string
          guild_id: string
          id: string
          status: string
          user_avatar: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          channel_id?: string | null
          claimed_by_id?: string | null
          claimed_by_name?: string | null
          closed_at?: string | null
          created_at?: string
          guild_id: string
          id?: string
          status?: string
          user_avatar?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          channel_id?: string | null
          claimed_by_id?: string | null
          claimed_by_name?: string | null
          closed_at?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          status?: string
          user_avatar?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modmail_threads_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      music_quiz_scores: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          last_played_at: string | null
          points: number
          rounds_played: number
          rounds_won: number
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          last_played_at?: string | null
          points?: number
          rounds_played?: number
          rounds_won?: number
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          last_played_at?: string | null
          points?: number
          rounds_played?: number
          rounds_won?: number
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "music_quiz_scores_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      music_quiz_settings: {
        Row: {
          channel_id: string | null
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          rounds: number
          time_per_round: number
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          rounds?: number
          time_per_round?: number
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          rounds?: number
          time_per_round?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_quiz_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      music_quiz_songs: {
        Row: {
          artist: string
          created_at: string
          difficulty: string
          guild_id: string | null
          hints: string[]
          id: string
          lyrics_snippet: string | null
          title: string
          updated_at: string
        }
        Insert: {
          artist: string
          created_at?: string
          difficulty?: string
          guild_id?: string | null
          hints?: string[]
          id?: string
          lyrics_snippet?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          artist?: string
          created_at?: string
          difficulty?: string
          guild_id?: string | null
          hints?: string[]
          id?: string
          lyrics_snippet?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_quiz_songs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_admin_emails: {
        Row: {
          created_at: string | null
          email: string
          id: string
          processed: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          processed?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          processed?: boolean | null
        }
        Relationships: []
      }
      polls: {
        Row: {
          channel_id: string | null
          created_at: string
          created_by: string
          ended: boolean
          ends_at: string | null
          guild_id: string
          id: string
          message_id: string | null
          options: Json
          question: string
          votes: Json
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          created_by: string
          ended?: boolean
          ends_at?: string | null
          guild_id: string
          id?: string
          message_id?: string | null
          options?: Json
          question: string
          votes?: Json
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          created_by?: string
          ended?: boolean
          ends_at?: string | null
          guild_id?: string
          id?: string
          message_id?: string | null
          options?: Json
          question?: string
          votes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "polls_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      protected_discord_ids: {
        Row: {
          added_by: string | null
          created_at: string
          discord_id: string
          id: string
          label: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          discord_id: string
          id?: string
          label?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          discord_id?: string
          id?: string
          label?: string | null
        }
        Relationships: []
      }
      quarantine_entries: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          quarantined_at: string
          reason: string | null
          released_at: string | null
          released_by: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          quarantined_at?: string
          reason?: string | null
          released_at?: string | null
          released_by?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          quarantined_at?: string
          reason?: string | null
          released_at?: string | null
          released_by?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quarantine_entries_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      quarantine_settings: {
        Row: {
          auto_quarantine_days: number
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          log_channel_id: string | null
          quarantine_role_id: string | null
          require_verification: boolean
          updated_at: string
        }
        Insert: {
          auto_quarantine_days?: number
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          log_channel_id?: string | null
          quarantine_role_id?: string | null
          require_verification?: boolean
          updated_at?: string
        }
        Update: {
          auto_quarantine_days?: number
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          log_channel_id?: string | null
          quarantine_role_id?: string | null
          require_verification?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quarantine_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      raid_logs: {
        Row: {
          action_taken: string
          created_at: string
          ended_at: string | null
          guild_id: string
          id: string
          join_count: number
          started_at: string
          user_ids: string[] | null
        }
        Insert: {
          action_taken: string
          created_at?: string
          ended_at?: string | null
          guild_id: string
          id?: string
          join_count: number
          started_at?: string
          user_ids?: string[] | null
        }
        Update: {
          action_taken?: string
          created_at?: string
          ended_at?: string | null
          guild_id?: string
          id?: string
          join_count?: number
          started_at?: string
          user_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "raid_logs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      raid_protection_settings: {
        Row: {
          action: string
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          join_threshold: number
          lockdown_duration_minutes: number
          log_channel_id: string | null
          notify_staff: boolean
          quarantine_role_id: string | null
          time_window_seconds: number
          updated_at: string
        }
        Insert: {
          action?: string
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          join_threshold?: number
          lockdown_duration_minutes?: number
          log_channel_id?: string | null
          notify_staff?: boolean
          quarantine_role_id?: string | null
          time_window_seconds?: number
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          join_threshold?: number
          lockdown_duration_minutes?: number
          log_channel_id?: string | null
          notify_staff?: boolean
          quarantine_role_id?: string | null
          time_window_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raid_protection_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_card_settings: {
        Row: {
          accent_color: string | null
          background_color: string | null
          background_image_url: string | null
          created_at: string
          guild_id: string
          id: string
          progress_bar_color: string | null
          show_level: boolean | null
          show_rank: boolean | null
          text_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          background_image_url?: string | null
          created_at?: string
          guild_id: string
          id?: string
          progress_bar_color?: string | null
          show_level?: boolean | null
          show_rank?: boolean | null
          text_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          background_image_url?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          progress_bar_color?: string | null
          show_level?: boolean | null
          show_rank?: boolean | null
          text_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rank_card_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      reaction_role_panels: {
        Row: {
          channel_id: string | null
          color: string | null
          created_at: string
          description: string | null
          guild_id: string
          id: string
          message_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          guild_id: string
          id?: string
          message_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          guild_id?: string
          id?: string
          message_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reaction_role_panels_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      reaction_roles: {
        Row: {
          channel_id: string
          created_at: string
          description: string | null
          emoji: string
          guild_id: string
          id: string
          message_id: string
          role_id: string
          role_name: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          description?: string | null
          emoji: string
          guild_id: string
          id?: string
          message_id: string
          role_id: string
          role_name?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          description?: string | null
          emoji?: string
          guild_id?: string
          id?: string
          message_id?: string
          role_id?: string
          role_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reaction_roles_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      realtime_events: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          created_at: string
          event_data: Json
          event_type: string
          guild_id: string
          id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          event_data?: Json
          event_type: string
          guild_id: string
          id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          event_data?: Json
          event_type?: string
          guild_id?: string
          id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "realtime_events_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          guild_id: string
          id: string
          is_recurring: boolean | null
          is_sent: boolean | null
          message: string
          recurrence_interval: string | null
          remind_at: string
          sent: boolean | null
          target_channel_id: string | null
          target_user_discord_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          guild_id: string
          id?: string
          is_recurring?: boolean | null
          is_sent?: boolean | null
          message: string
          recurrence_interval?: string | null
          remind_at: string
          sent?: boolean | null
          target_channel_id?: string | null
          target_user_discord_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          guild_id?: string
          id?: string
          is_recurring?: boolean | null
          is_sent?: boolean | null
          message?: string
          recurrence_interval?: string | null
          remind_at?: string
          sent?: boolean | null
          target_channel_id?: string | null
          target_user_discord_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      role_menus: {
        Row: {
          channel_id: string | null
          created_at: string
          guild_id: string
          id: string
          max_roles: number | null
          menu_type: string
          message_id: string | null
          name: string
          roles: Json
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          guild_id: string
          id?: string
          max_roles?: number | null
          menu_type?: string
          message_id?: string | null
          name: string
          roles?: Json
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          max_roles?: number | null
          menu_type?: string
          message_id?: string | null
          name?: string
          roles?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_menus_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_embeds: {
        Row: {
          created_at: string
          embed_data: Json
          guild_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          embed_data?: Json
          guild_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          embed_data?: Json
          guild_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_embeds_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_actions: {
        Row: {
          action_type: string
          created_at: string
          created_by: string
          execute_at: string
          executed: boolean
          executed_at: string | null
          guild_id: string
          id: string
          reason: string | null
          role_id: string | null
          target_discord_id: string
          target_name: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by: string
          execute_at: string
          executed?: boolean
          executed_at?: string | null
          guild_id: string
          id?: string
          reason?: string | null
          role_id?: string | null
          target_discord_id: string
          target_name?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by?: string
          execute_at?: string
          executed?: boolean
          executed_at?: string | null
          guild_id?: string
          id?: string
          reason?: string | null
          role_id?: string | null
          target_discord_id?: string
          target_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_actions_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          channel_id: string
          content: string | null
          created_at: string
          created_by_id: string
          created_by_name: string | null
          embed: Json | null
          guild_id: string
          id: string
          repeat_interval: string | null
          scheduled_at: string
          sent: boolean
          sent_at: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          content?: string | null
          created_at?: string
          created_by_id: string
          created_by_name?: string | null
          embed?: Json | null
          guild_id: string
          id?: string
          repeat_interval?: string | null
          scheduled_at: string
          sent?: boolean
          sent_at?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          content?: string | null
          created_at?: string
          created_by_id?: string
          created_by_name?: string | null
          embed?: Json | null
          guild_id?: string
          id?: string
          repeat_interval?: string | null
          scheduled_at?: string
          sent?: boolean
          sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      server_backups: {
        Row: {
          backup_data: Json
          backup_type: string
          created_at: string
          created_by: string | null
          description: string | null
          guild_id: string
          id: string
        }
        Insert: {
          backup_data?: Json
          backup_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          guild_id: string
          id?: string
        }
        Update: {
          backup_data?: Json
          backup_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          guild_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_backups_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      server_templates: {
        Row: {
          ban_count: number | null
          bans: Json | null
          bot_settings: Json
          categories: Json
          channels: Json
          created_at: string
          created_by: string
          description: string | null
          guild_id: string | null
          id: string
          is_public: boolean
          member_count: number | null
          members: Json | null
          message_count: number | null
          messages: Json | null
          name: string
          roles: Json
          server_settings: Json | null
          thread_count: number | null
          threads: Json | null
          updated_at: string
        }
        Insert: {
          ban_count?: number | null
          bans?: Json | null
          bot_settings?: Json
          categories?: Json
          channels?: Json
          created_at?: string
          created_by: string
          description?: string | null
          guild_id?: string | null
          id?: string
          is_public?: boolean
          member_count?: number | null
          members?: Json | null
          message_count?: number | null
          messages?: Json | null
          name: string
          roles?: Json
          server_settings?: Json | null
          thread_count?: number | null
          threads?: Json | null
          updated_at?: string
        }
        Update: {
          ban_count?: number | null
          bans?: Json | null
          bot_settings?: Json
          categories?: Json
          channels?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          guild_id?: string | null
          id?: string
          is_public?: boolean
          member_count?: number | null
          members?: Json | null
          message_count?: number | null
          messages?: Json | null
          name?: string
          roles?: Json
          server_settings?: Json | null
          thread_count?: number | null
          threads?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_templates_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      slowmode_schedules: {
        Row: {
          channel_id: string
          channel_name: string | null
          created_at: string
          days_of_week: number[]
          enabled: boolean
          end_hour: number
          guild_id: string
          id: string
          slowmode_seconds: number
          start_hour: number
          updated_at: string
        }
        Insert: {
          channel_id: string
          channel_name?: string | null
          created_at?: string
          days_of_week?: number[]
          enabled?: boolean
          end_hour?: number
          guild_id: string
          id?: string
          slowmode_seconds?: number
          start_hour?: number
          updated_at?: string
        }
        Update: {
          channel_id?: string
          channel_name?: string | null
          created_at?: string
          days_of_week?: number[]
          enabled?: boolean
          end_hour?: number
          guild_id?: string
          id?: string
          slowmode_seconds?: number
          start_hour?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slowmode_schedules_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      starboard_entries: {
        Row: {
          attachments: Json | null
          author_id: string
          author_name: string | null
          channel_id: string
          content: string | null
          created_at: string
          guild_id: string
          id: string
          message_id: string
          star_count: number
          starboard_message_id: string | null
        }
        Insert: {
          attachments?: Json | null
          author_id: string
          author_name?: string | null
          channel_id: string
          content?: string | null
          created_at?: string
          guild_id: string
          id?: string
          message_id: string
          star_count?: number
          starboard_message_id?: string | null
        }
        Update: {
          attachments?: Json | null
          author_id?: string
          author_name?: string | null
          channel_id?: string
          content?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          message_id?: string
          star_count?: number
          starboard_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "starboard_entries_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      starboard_settings: {
        Row: {
          channel_id: string | null
          created_at: string
          emoji: string
          enabled: boolean
          guild_id: string
          id: string
          ignore_self_star: boolean
          ignored_channels: string[] | null
          threshold: number
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          emoji?: string
          enabled?: boolean
          guild_id: string
          id?: string
          ignore_self_star?: boolean
          ignored_channels?: string[] | null
          threshold?: number
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          emoji?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          ignore_self_star?: boolean
          ignored_channels?: string[] | null
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "starboard_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      stats_channels: {
        Row: {
          channel_id: string | null
          created_at: string
          enabled: boolean | null
          format_template: string
          guild_id: string
          id: string
          stat_type: string
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          enabled?: boolean | null
          format_template?: string
          guild_id: string
          id?: string
          stat_type?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          enabled?: boolean | null
          format_template?: string
          guild_id?: string
          id?: string
          stat_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stats_channels_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      stats_force_update: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          requested_by: string | null
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          requested_by?: string | null
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          requested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stats_force_update_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_settings: {
        Row: {
          anonymous_mode: boolean | null
          channel_id: string | null
          color: string | null
          created_at: string
          enabled: boolean | null
          guild_id: string
          id: string
          updated_at: string
        }
        Insert: {
          anonymous_mode?: boolean | null
          channel_id?: string | null
          color?: string | null
          created_at?: string
          enabled?: boolean | null
          guild_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          anonymous_mode?: boolean | null
          channel_id?: string | null
          color?: string | null
          created_at?: string
          enabled?: boolean | null
          guild_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          author_id: string
          author_name: string | null
          channel_id: string | null
          content: string
          created_at: string
          downvoters: string[]
          downvotes: number | null
          guild_id: string
          id: string
          message_id: string | null
          responded_by: string | null
          staff_response: string | null
          status: string
          updated_at: string
          upvoters: string[]
          upvotes: number | null
        }
        Insert: {
          author_id: string
          author_name?: string | null
          channel_id?: string | null
          content: string
          created_at?: string
          downvoters?: string[]
          downvotes?: number | null
          guild_id: string
          id?: string
          message_id?: string | null
          responded_by?: string | null
          staff_response?: string | null
          status?: string
          updated_at?: string
          upvoters?: string[]
          upvotes?: number | null
        }
        Update: {
          author_id?: string
          author_name?: string | null
          channel_id?: string | null
          content?: string
          created_at?: string
          downvoters?: string[]
          downvotes?: number | null
          guild_id?: string
          id?: string
          message_id?: string | null
          responded_by?: string | null
          staff_response?: string | null
          status?: string
          updated_at?: string
          upvoters?: string[]
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      tebex_purchases: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          event_type: string
          guild_id: string
          id: string
          packages: Json | null
          player_discord_id: string | null
          player_name: string | null
          player_uuid: string | null
          raw_payload: Json | null
          status: string
          txn_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string | null
          event_type?: string
          guild_id: string
          id?: string
          packages?: Json | null
          player_discord_id?: string | null
          player_name?: string | null
          player_uuid?: string | null
          raw_payload?: Json | null
          status?: string
          txn_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          event_type?: string
          guild_id?: string
          id?: string
          packages?: Json | null
          player_discord_id?: string | null
          player_name?: string | null
          player_uuid?: string | null
          raw_payload?: Json | null
          status?: string
          txn_id?: string
        }
        Relationships: []
      }
      tebex_role_mappings: {
        Row: {
          created_at: string
          discord_role_id: string
          discord_role_name: string | null
          guild_id: string
          id: string
          tebex_package_id: number
          tebex_package_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          discord_role_id: string
          discord_role_name?: string | null
          guild_id: string
          id?: string
          tebex_package_id: number
          tebex_package_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          discord_role_id?: string
          discord_role_name?: string | null
          guild_id?: string
          id?: string
          tebex_package_id?: number
          tebex_package_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tebex_settings: {
        Row: {
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          notification_channel_id: string | null
          tebex_secret_encrypted: string | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          notification_channel_id?: string | null
          tebex_secret_encrypted?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          notification_channel_id?: string | null
          tebex_secret_encrypted?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tebex_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          button_color: number | null
          created_at: string
          description: string | null
          emoji: string | null
          form_fields: Json
          guild_id: string
          id: string
          name: string
          panel_id: string | null
          position: number | null
          questions: Json | null
          staff_role_id: string | null
          ticket_type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          button_color?: number | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          form_fields?: Json
          guild_id: string
          id?: string
          name: string
          panel_id?: string | null
          position?: number | null
          questions?: Json | null
          staff_role_id?: string | null
          ticket_type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          button_color?: number | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          form_fields?: Json
          guild_id?: string
          id?: string
          name?: string
          panel_id?: string | null
          position?: number | null
          questions?: Json | null
          staff_role_id?: string | null
          ticket_type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_categories_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_categories_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "ticket_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachments: Json | null
          author_avatar: string | null
          author_id: string
          author_name: string | null
          content: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          author_avatar?: string | null
          author_id: string
          author_name?: string | null
          content: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          author_avatar?: string | null
          author_id?: string
          author_name?: string | null
          content?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_panels: {
        Row: {
          button_emoji: string | null
          button_label: string | null
          button_style: number | null
          category_ids: Json
          channel_id: string | null
          component_style: string
          created_at: string
          embed_color: number | null
          embed_description: string | null
          embed_footer_text: string | null
          embed_image_url: string | null
          embed_thumbnail_url: string | null
          embed_title: string | null
          enabled: boolean
          guild_id: string
          id: string
          message_id: string | null
          name: string
          operating_hours: Json
          updated_at: string
        }
        Insert: {
          button_emoji?: string | null
          button_label?: string | null
          button_style?: number | null
          category_ids?: Json
          channel_id?: string | null
          component_style?: string
          created_at?: string
          embed_color?: number | null
          embed_description?: string | null
          embed_footer_text?: string | null
          embed_image_url?: string | null
          embed_thumbnail_url?: string | null
          embed_title?: string | null
          enabled?: boolean
          guild_id: string
          id?: string
          message_id?: string | null
          name: string
          operating_hours?: Json
          updated_at?: string
        }
        Update: {
          button_emoji?: string | null
          button_label?: string | null
          button_style?: number | null
          category_ids?: Json
          channel_id?: string | null
          component_style?: string
          created_at?: string
          embed_color?: number | null
          embed_description?: string | null
          embed_footer_text?: string | null
          embed_image_url?: string | null
          embed_thumbnail_url?: string | null
          embed_title?: string | null
          enabled?: boolean
          guild_id?: string
          id?: string
          message_id?: string | null
          name?: string
          operating_hours?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_panels_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_ratings: {
        Row: {
          comment: string | null
          created_at: string
          guild_id: string
          id: string
          rated_by_id: string
          rating: number
          staff_id: string | null
          staff_name: string | null
          ticket_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          guild_id: string
          id?: string
          rated_by_id: string
          rating: number
          staff_id?: string | null
          staff_name?: string | null
          ticket_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          rated_by_id?: string
          rating?: number
          staff_id?: string | null
          staff_name?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_ratings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_ratings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_settings: {
        Row: {
          created_at: string
          dm_transcript_to_user: boolean
          enable_ratings: boolean
          enable_transcripts: boolean
          guild_id: string
          id: string
          operating_hours: Json
          panel_channel_id: string | null
          panel_message_id: string | null
          ratings_dm_prompt: string | null
          thread_category_id: string | null
          transcript_channel_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dm_transcript_to_user?: boolean
          enable_ratings?: boolean
          enable_transcripts?: boolean
          guild_id: string
          id?: string
          operating_hours?: Json
          panel_channel_id?: string | null
          panel_message_id?: string | null
          ratings_dm_prompt?: string | null
          thread_category_id?: string | null
          transcript_channel_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dm_transcript_to_user?: boolean
          enable_ratings?: boolean
          enable_transcripts?: boolean
          guild_id?: string
          id?: string
          operating_hours?: Json
          panel_channel_id?: string | null
          panel_message_id?: string | null
          ratings_dm_prompt?: string | null
          thread_category_id?: string | null
          transcript_channel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_transcripts: {
        Row: {
          created_at: string
          guild_id: string
          html_url: string | null
          id: string
          message_count: number | null
          storage_path: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          guild_id: string
          html_url?: string | null
          id?: string
          message_count?: number | null
          storage_path?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          guild_id?: string
          html_url?: string | null
          id?: string
          message_count?: number | null
          storage_path?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_transcripts_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_transcripts_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          category_id: string | null
          channel_id: string
          claimed_by_id: string | null
          claimed_by_name: string | null
          closed_at: string | null
          closed_by_id: string | null
          closed_by_name: string | null
          created_at: string
          creator_id: string
          creator_name: string | null
          guild_id: string
          id: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string | null
          ticket_type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          channel_id: string
          claimed_by_id?: string | null
          claimed_by_name?: string | null
          closed_at?: string | null
          closed_by_id?: string | null
          closed_by_name?: string | null
          created_at?: string
          creator_id: string
          creator_name?: string | null
          guild_id: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string | null
          ticket_type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          channel_id?: string
          claimed_by_id?: string | null
          claimed_by_name?: string | null
          closed_at?: string | null
          closed_by_id?: string | null
          closed_by_name?: string | null
          created_at?: string
          creator_id?: string
          creator_name?: string | null
          guild_id?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string | null
          ticket_type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_accounts: {
        Row: {
          created_at: string
          custom_message: string | null
          display_name: string | null
          enabled: boolean
          guild_id: string
          id: string
          is_live: boolean | null
          last_check_at: string | null
          last_live_at: string | null
          last_video_id: string | null
          mention_role_id: string | null
          notification_channel_id: string
          profile_image_url: string | null
          tiktok_username: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_message?: string | null
          display_name?: string | null
          enabled?: boolean
          guild_id: string
          id?: string
          is_live?: boolean | null
          last_check_at?: string | null
          last_live_at?: string | null
          last_video_id?: string | null
          mention_role_id?: string | null
          notification_channel_id: string
          profile_image_url?: string | null
          tiktok_username: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_message?: string | null
          display_name?: string | null
          enabled?: boolean
          guild_id?: string
          id?: string
          is_live?: boolean | null
          last_check_at?: string | null
          last_live_at?: string | null
          last_video_id?: string | null
          mention_role_id?: string | null
          notification_channel_id?: string
          profile_image_url?: string | null
          tiktok_username?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_accounts_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_notification_logs: {
        Row: {
          channel_id: string | null
          created_at: string
          guild_id: string
          id: string
          message_id: string | null
          notification_type: string
          tiktok_account_id: string
          tiktok_username: string
          video_id: string | null
          video_title: string | null
          video_url: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          guild_id: string
          id?: string
          message_id?: string | null
          notification_type?: string
          tiktok_account_id: string
          tiktok_username: string
          video_id?: string | null
          video_title?: string | null
          video_url?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          message_id?: string | null
          notification_type?: string
          tiktok_account_id?: string
          tiktok_username?: string
          video_id?: string | null
          video_title?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_notification_logs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_notification_logs_tiktok_account_id_fkey"
            columns: ["tiktok_account_id"]
            isOneToOne: false
            referencedRelation: "tiktok_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_settings: {
        Row: {
          auto_embed_links: boolean
          created_at: string
          embed_color: string | null
          enabled: boolean
          guild_id: string
          id: string
          live_message: string | null
          live_notifications: boolean | null
          new_video_message: string | null
          offline_message: string | null
          updated_at: string
        }
        Insert: {
          auto_embed_links?: boolean
          created_at?: string
          embed_color?: string | null
          enabled?: boolean
          guild_id: string
          id?: string
          live_message?: string | null
          live_notifications?: boolean | null
          new_video_message?: string | null
          offline_message?: string | null
          updated_at?: string
        }
        Update: {
          auto_embed_links?: boolean
          created_at?: string
          embed_color?: string | null
          enabled?: boolean
          guild_id?: string
          id?: string
          live_message?: string | null
          live_notifications?: boolean | null
          new_video_message?: string | null
          offline_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      twitch_content_posts: {
        Row: {
          channel_id: string
          content_type: string
          created_at: string
          guild_id: string
          id: string
          posted_at: string
          streamer_id: string
          title: string | null
          twitch_content_id: string
          url: string | null
        }
        Insert: {
          channel_id: string
          content_type: string
          created_at?: string
          guild_id: string
          id?: string
          posted_at?: string
          streamer_id: string
          title?: string | null
          twitch_content_id: string
          url?: string | null
        }
        Update: {
          channel_id?: string
          content_type?: string
          created_at?: string
          guild_id?: string
          id?: string
          posted_at?: string
          streamer_id?: string
          title?: string | null
          twitch_content_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "twitch_content_posts_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twitch_content_posts_streamer_id_fkey"
            columns: ["streamer_id"]
            isOneToOne: false
            referencedRelation: "twitch_streamers"
            referencedColumns: ["id"]
          },
        ]
      }
      twitch_notification_logs: {
        Row: {
          channel_id: string
          created_at: string
          event_type: string
          game_name: string | null
          guild_id: string
          id: string
          message_id: string | null
          sent_at: string
          stream_title: string | null
          streamer_id: string
          thumbnail_url: string | null
          viewer_count: number | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          event_type: string
          game_name?: string | null
          guild_id: string
          id?: string
          message_id?: string | null
          sent_at?: string
          stream_title?: string | null
          streamer_id: string
          thumbnail_url?: string | null
          viewer_count?: number | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          event_type?: string
          game_name?: string | null
          guild_id?: string
          id?: string
          message_id?: string | null
          sent_at?: string
          stream_title?: string | null
          streamer_id?: string
          thumbnail_url?: string | null
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "twitch_notification_logs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twitch_notification_logs_streamer_id_fkey"
            columns: ["streamer_id"]
            isOneToOne: false
            referencedRelation: "twitch_streamers"
            referencedColumns: ["id"]
          },
        ]
      }
      twitch_partner_weekly_stats: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          minutes_streamed: number
          quota_hours_goal: number
          quota_met: boolean
          quota_streams_goal: number
          quota_type: string
          streamer_id: string
          streams_count: number
          week_start: string
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          minutes_streamed?: number
          quota_hours_goal?: number
          quota_met?: boolean
          quota_streams_goal?: number
          quota_type?: string
          streamer_id: string
          streams_count?: number
          week_start: string
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          minutes_streamed?: number
          quota_hours_goal?: number
          quota_met?: boolean
          quota_streams_goal?: number
          quota_type?: string
          streamer_id?: string
          streams_count?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "twitch_partner_weekly_stats_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twitch_partner_weekly_stats_streamer_id_fkey"
            columns: ["streamer_id"]
            isOneToOne: false
            referencedRelation: "twitch_streamers"
            referencedColumns: ["id"]
          },
        ]
      }
      twitch_schedule_settings: {
        Row: {
          auto_post_enabled: boolean
          created_at: string
          fetch_from_twitch: boolean
          guild_id: string
          id: string
          last_posted_at: string | null
          post_channel_id: string | null
          post_day: number
          post_time: string
          updated_at: string
        }
        Insert: {
          auto_post_enabled?: boolean
          created_at?: string
          fetch_from_twitch?: boolean
          guild_id: string
          id?: string
          last_posted_at?: string | null
          post_channel_id?: string | null
          post_day?: number
          post_time?: string
          updated_at?: string
        }
        Update: {
          auto_post_enabled?: boolean
          created_at?: string
          fetch_from_twitch?: boolean
          guild_id?: string
          id?: string
          last_posted_at?: string | null
          post_channel_id?: string | null
          post_day?: number
          post_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "twitch_schedule_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      twitch_settings: {
        Row: {
          clip_message: string | null
          clips_channel_id: string | null
          created_at: string
          enabled: boolean
          guild_id: string
          highlight_message: string | null
          highlights_channel_id: string | null
          id: string
          live_embed_color: string | null
          live_message: string | null
          live_role_id: string | null
          notify_clips: boolean
          notify_highlights: boolean
          notify_on_offline: boolean
          notify_vods: boolean
          offline_embed_color: string | null
          offline_message: string | null
          partner_inactive_role_id: string | null
          partner_staff_alert_template: string | null
          partner_staff_channel_id: string | null
          partner_tracking_enabled: boolean
          partner_warning_days_before: number
          partner_warning_dm: string | null
          show_game: boolean
          show_thumbnail: boolean
          show_viewers: boolean
          updated_at: string
          vod_message: string | null
          vods_channel_id: string | null
        }
        Insert: {
          clip_message?: string | null
          clips_channel_id?: string | null
          created_at?: string
          enabled?: boolean
          guild_id: string
          highlight_message?: string | null
          highlights_channel_id?: string | null
          id?: string
          live_embed_color?: string | null
          live_message?: string | null
          live_role_id?: string | null
          notify_clips?: boolean
          notify_highlights?: boolean
          notify_on_offline?: boolean
          notify_vods?: boolean
          offline_embed_color?: string | null
          offline_message?: string | null
          partner_inactive_role_id?: string | null
          partner_staff_alert_template?: string | null
          partner_staff_channel_id?: string | null
          partner_tracking_enabled?: boolean
          partner_warning_days_before?: number
          partner_warning_dm?: string | null
          show_game?: boolean
          show_thumbnail?: boolean
          show_viewers?: boolean
          updated_at?: string
          vod_message?: string | null
          vods_channel_id?: string | null
        }
        Update: {
          clip_message?: string | null
          clips_channel_id?: string | null
          created_at?: string
          enabled?: boolean
          guild_id?: string
          highlight_message?: string | null
          highlights_channel_id?: string | null
          id?: string
          live_embed_color?: string | null
          live_message?: string | null
          live_role_id?: string | null
          notify_clips?: boolean
          notify_highlights?: boolean
          notify_on_offline?: boolean
          notify_vods?: boolean
          offline_embed_color?: string | null
          offline_message?: string | null
          partner_inactive_role_id?: string | null
          partner_staff_alert_template?: string | null
          partner_staff_channel_id?: string | null
          partner_tracking_enabled?: boolean
          partner_warning_days_before?: number
          partner_warning_dm?: string | null
          show_game?: boolean
          show_thumbnail?: boolean
          show_viewers?: boolean
          updated_at?: string
          vod_message?: string | null
          vods_channel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "twitch_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      twitch_stream_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          enabled: boolean
          end_time: string
          game_name: string | null
          guild_id: string
          id: string
          start_time: string
          streamer_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          enabled?: boolean
          end_time: string
          game_name?: string | null
          guild_id: string
          id?: string
          start_time: string
          streamer_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          enabled?: boolean
          end_time?: string
          game_name?: string | null
          guild_id?: string
          id?: string
          start_time?: string
          streamer_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "twitch_stream_schedules_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twitch_stream_schedules_streamer_id_fkey"
            columns: ["streamer_id"]
            isOneToOne: false
            referencedRelation: "twitch_streamers"
            referencedColumns: ["id"]
          },
        ]
      }
      twitch_streamers: {
        Row: {
          allowed_games: string[] | null
          best_streak: number
          blocked_games: string[] | null
          created_at: string
          current_streak: number
          current_stream_started_at: string | null
          current_week_minutes: number
          current_week_streams: number
          custom_embed_color: string | null
          custom_live_message: string | null
          discord_user_id: string | null
          display_name: string | null
          guild_id: string
          id: string
          is_live: boolean
          is_muted: boolean | null
          is_partner: boolean
          last_game_name: string | null
          last_quota_reset_at: string
          last_stream_id: string | null
          last_stream_title: string | null
          last_went_live_at: string | null
          last_went_offline_at: string | null
          mention_role_id: string | null
          min_viewers: number | null
          notification_channel_id: string
          notification_cooldown_minutes: number | null
          peak_viewers: number | null
          profile_image_url: string | null
          quota_hours_per_week: number
          quota_met_this_week: boolean
          quota_streams_per_week: number
          quota_type: string
          stream_count: number | null
          total_stream_minutes: number | null
          total_viewers: number | null
          twitch_user_id: string | null
          twitch_username: string
          updated_at: string
          warning_sent_this_week: boolean
        }
        Insert: {
          allowed_games?: string[] | null
          best_streak?: number
          blocked_games?: string[] | null
          created_at?: string
          current_streak?: number
          current_stream_started_at?: string | null
          current_week_minutes?: number
          current_week_streams?: number
          custom_embed_color?: string | null
          custom_live_message?: string | null
          discord_user_id?: string | null
          display_name?: string | null
          guild_id: string
          id?: string
          is_live?: boolean
          is_muted?: boolean | null
          is_partner?: boolean
          last_game_name?: string | null
          last_quota_reset_at?: string
          last_stream_id?: string | null
          last_stream_title?: string | null
          last_went_live_at?: string | null
          last_went_offline_at?: string | null
          mention_role_id?: string | null
          min_viewers?: number | null
          notification_channel_id: string
          notification_cooldown_minutes?: number | null
          peak_viewers?: number | null
          profile_image_url?: string | null
          quota_hours_per_week?: number
          quota_met_this_week?: boolean
          quota_streams_per_week?: number
          quota_type?: string
          stream_count?: number | null
          total_stream_minutes?: number | null
          total_viewers?: number | null
          twitch_user_id?: string | null
          twitch_username: string
          updated_at?: string
          warning_sent_this_week?: boolean
        }
        Update: {
          allowed_games?: string[] | null
          best_streak?: number
          blocked_games?: string[] | null
          created_at?: string
          current_streak?: number
          current_stream_started_at?: string | null
          current_week_minutes?: number
          current_week_streams?: number
          custom_embed_color?: string | null
          custom_live_message?: string | null
          discord_user_id?: string | null
          display_name?: string | null
          guild_id?: string
          id?: string
          is_live?: boolean
          is_muted?: boolean | null
          is_partner?: boolean
          last_game_name?: string | null
          last_quota_reset_at?: string
          last_stream_id?: string | null
          last_stream_title?: string | null
          last_went_live_at?: string | null
          last_went_offline_at?: string | null
          mention_role_id?: string | null
          min_viewers?: number | null
          notification_channel_id?: string
          notification_cooldown_minutes?: number | null
          peak_viewers?: number | null
          profile_image_url?: string | null
          quota_hours_per_week?: number
          quota_met_this_week?: boolean
          quota_streams_per_week?: number
          quota_type?: string
          stream_count?: number | null
          total_stream_minutes?: number | null
          total_viewers?: number | null
          twitch_user_id?: string | null
          twitch_username?: string
          updated_at?: string
          warning_sent_this_week?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "twitch_streamers_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      user_guilds: {
        Row: {
          created_at: string
          discord_user_id: string
          guild_id: string
          has_admin_permission: boolean
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discord_user_id: string
          guild_id: string
          has_admin_permission?: boolean
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discord_user_id?: string
          guild_id?: string
          has_admin_permission?: boolean
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_guilds_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      user_levels: {
        Row: {
          created_at: string
          discord_username: string | null
          guild_id: string
          id: string
          last_message_at: string | null
          level: number
          total_messages: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          created_at?: string
          discord_username?: string | null
          guild_id: string
          id?: string
          last_message_at?: string | null
          level?: number
          total_messages?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          created_at?: string
          discord_username?: string | null
          guild_id?: string
          id?: string
          last_message_at?: string | null
          level?: number
          total_messages?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_levels_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      user_premium_features: {
        Row: {
          created_at: string
          enabled: boolean
          enabled_at: string
          enabled_by: string | null
          expires_at: string | null
          feature: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          enabled_at?: string
          enabled_by?: string | null
          expires_at?: string | null
          feature: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          enabled_at?: string
          enabled_by?: string | null
          expires_at?: string | null
          feature?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_logs: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          method: string | null
          success: boolean | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          method?: string | null
          success?: boolean | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          method?: string | null
          success?: boolean | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_logs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_settings: {
        Row: {
          channel_id: string | null
          created_at: string
          enabled: boolean | null
          guild_id: string
          id: string
          method: string | null
          panel_message_id: string | null
          rate_limit_per_minute: number | null
          role_id: string | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          enabled?: boolean | null
          guild_id: string
          id?: string
          method?: string | null
          panel_message_id?: string | null
          rate_limit_per_minute?: number | null
          role_id?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          enabled?: boolean | null
          guild_id?: string
          id?: string
          method?: string | null
          panel_message_id?: string | null
          rate_limit_per_minute?: number | null
          role_id?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      warning_settings: {
        Row: {
          created_at: string
          decay_days: number | null
          enabled: boolean
          guild_id: string
          id: string
          points_per_warn: number
          thresholds: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          decay_days?: number | null
          enabled?: boolean
          guild_id: string
          id?: string
          points_per_warn?: number
          thresholds?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          decay_days?: number | null
          enabled?: boolean
          guild_id?: string
          id?: string
          points_per_warn?: number
          thresholds?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warning_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      warnings: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          guild_id: string
          id: string
          moderator_id: string
          moderator_name: string | null
          points: number
          reason: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          guild_id: string
          id?: string
          moderator_id: string
          moderator_name?: string | null
          points?: number
          reason?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          guild_id?: string
          id?: string
          moderator_id?: string
          moderator_name?: string | null
          points?: number
          reason?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warnings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs: {
        Row: {
          avatar_url: string | null
          channel_id: string | null
          channel_name: string | null
          created_at: string
          enabled: boolean
          event_types: string[]
          guild_id: string
          id: string
          last_used_at: string | null
          name: string
          updated_at: string
          webhook_url: string
        }
        Insert: {
          avatar_url?: string | null
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          enabled?: boolean
          event_types?: string[]
          guild_id: string
          id?: string
          last_used_at?: string | null
          name: string
          updated_at?: string
          webhook_url: string
        }
        Update: {
          avatar_url?: string | null
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          enabled?: boolean
          event_types?: string[]
          guild_id?: string
          id?: string
          last_used_at?: string | null
          name?: string
          updated_at?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      welcome_settings: {
        Row: {
          auto_role_enabled: boolean
          auto_role_id: string | null
          auto_role_ids: string[] | null
          created_at: string
          dm_enabled: boolean
          dm_message: string | null
          embed_color: string | null
          embed_enabled: boolean
          embed_footer: string | null
          embed_image_url: string | null
          embed_title: string | null
          enabled: boolean
          guild_id: string
          id: string
          leave_channel_id: string | null
          leave_embed_enabled: boolean | null
          leave_enabled: boolean
          leave_message: string | null
          thumbnail_type: string
          updated_at: string
          welcome_channel_id: string | null
          welcome_message: string | null
        }
        Insert: {
          auto_role_enabled?: boolean
          auto_role_id?: string | null
          auto_role_ids?: string[] | null
          created_at?: string
          dm_enabled?: boolean
          dm_message?: string | null
          embed_color?: string | null
          embed_enabled?: boolean
          embed_footer?: string | null
          embed_image_url?: string | null
          embed_title?: string | null
          enabled?: boolean
          guild_id: string
          id?: string
          leave_channel_id?: string | null
          leave_embed_enabled?: boolean | null
          leave_enabled?: boolean
          leave_message?: string | null
          thumbnail_type?: string
          updated_at?: string
          welcome_channel_id?: string | null
          welcome_message?: string | null
        }
        Update: {
          auto_role_enabled?: boolean
          auto_role_id?: string | null
          auto_role_ids?: string[] | null
          created_at?: string
          dm_enabled?: boolean
          dm_message?: string | null
          embed_color?: string | null
          embed_enabled?: boolean
          embed_footer?: string | null
          embed_image_url?: string | null
          embed_title?: string | null
          enabled?: boolean
          guild_id?: string
          id?: string
          leave_channel_id?: string | null
          leave_embed_enabled?: boolean | null
          leave_enabled?: boolean
          leave_message?: string | null
          thumbnail_type?: string
          updated_at?: string
          welcome_channel_id?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "welcome_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_multipliers: {
        Row: {
          created_at: string
          enabled: boolean
          ends_at: string | null
          guild_id: string
          id: string
          multiplier: number
          multiplier_type: string
          name: string
          starts_at: string | null
          target_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          ends_at?: string | null
          guild_id: string
          id?: string
          multiplier?: number
          multiplier_type: string
          name: string
          starts_at?: string | null
          target_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          ends_at?: string | null
          guild_id?: string
          id?: string
          multiplier?: number
          multiplier_type?: string
          name?: string
          starts_at?: string | null
          target_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_multipliers_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_channels: {
        Row: {
          channel_name: string | null
          channel_url: string | null
          created_at: string
          custom_message: string | null
          enabled: boolean
          guild_id: string
          id: string
          is_live: boolean
          last_check_at: string | null
          last_live_at: string | null
          last_video_id: string | null
          live_channel_id: string | null
          mention_role_id: string | null
          notification_channel_id: string
          profile_image_url: string | null
          updated_at: string
          youtube_channel_id: string
        }
        Insert: {
          channel_name?: string | null
          channel_url?: string | null
          created_at?: string
          custom_message?: string | null
          enabled?: boolean
          guild_id: string
          id?: string
          is_live?: boolean
          last_check_at?: string | null
          last_live_at?: string | null
          last_video_id?: string | null
          live_channel_id?: string | null
          mention_role_id?: string | null
          notification_channel_id: string
          profile_image_url?: string | null
          updated_at?: string
          youtube_channel_id: string
        }
        Update: {
          channel_name?: string | null
          channel_url?: string | null
          created_at?: string
          custom_message?: string | null
          enabled?: boolean
          guild_id?: string
          id?: string
          is_live?: boolean
          last_check_at?: string | null
          last_live_at?: string | null
          last_video_id?: string | null
          live_channel_id?: string | null
          mention_role_id?: string | null
          notification_channel_id?: string
          profile_image_url?: string | null
          updated_at?: string
          youtube_channel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_channels_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_notification_logs: {
        Row: {
          channel_id: string | null
          created_at: string
          guild_id: string
          id: string
          message_id: string | null
          notification_type: string
          video_id: string | null
          video_title: string | null
          video_url: string | null
          youtube_channel_db_id: string | null
          youtube_channel_name: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          guild_id: string
          id?: string
          message_id?: string | null
          notification_type?: string
          video_id?: string | null
          video_title?: string | null
          video_url?: string | null
          youtube_channel_db_id?: string | null
          youtube_channel_name?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          message_id?: string | null
          notification_type?: string
          video_id?: string | null
          video_title?: string | null
          video_url?: string | null
          youtube_channel_db_id?: string | null
          youtube_channel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_notification_logs_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_notification_logs_youtube_channel_db_id_fkey"
            columns: ["youtube_channel_db_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_settings: {
        Row: {
          created_at: string
          embed_color: string | null
          enabled: boolean
          guild_id: string
          id: string
          live_message: string | null
          live_notifications: boolean
          new_video_message: string | null
          offline_message: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          embed_color?: string | null
          enabled?: boolean
          guild_id: string
          id?: string
          live_message?: string | null
          live_notifications?: boolean
          new_video_message?: string | null
          offline_message?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          embed_color?: string | null
          enabled?: boolean
          guild_id?: string
          id?: string
          live_message?: string | null
          live_notifications?: boolean
          new_video_message?: string | null
          offline_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_settings_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      guild_has_applications_pro: {
        Args: { _guild_id: string }
        Returns: boolean
      }
      has_admin_or_staff_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      application_status: "pending" | "approved" | "denied"
      automod_action: "warn" | "mute" | "kick" | "ban" | "delete"
      automod_rule_type:
        | "spam"
        | "links"
        | "words"
        | "mentions"
        | "caps"
        | "invites"
        | "ai_toxicity"
      character_status: "alive" | "dead" | "retired"
      global_ban_status: "pending" | "approved" | "rejected"
      moderation_action_type:
        | "ban"
        | "kick"
        | "mute"
        | "warn"
        | "delete"
        | "timeout"
        | "unban"
        | "unmute"
      module_type:
        | "moderation"
        | "music"
        | "leveling"
        | "utility"
        | "fun"
        | "economy"
        | "tickets"
        | "giveaway"
        | "tebex"
      ticket_status: "open" | "claimed" | "closed"
      ticket_type: "support" | "application"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      application_status: ["pending", "approved", "denied"],
      automod_action: ["warn", "mute", "kick", "ban", "delete"],
      automod_rule_type: [
        "spam",
        "links",
        "words",
        "mentions",
        "caps",
        "invites",
        "ai_toxicity",
      ],
      character_status: ["alive", "dead", "retired"],
      global_ban_status: ["pending", "approved", "rejected"],
      moderation_action_type: [
        "ban",
        "kick",
        "mute",
        "warn",
        "delete",
        "timeout",
        "unban",
        "unmute",
      ],
      module_type: [
        "moderation",
        "music",
        "leveling",
        "utility",
        "fun",
        "economy",
        "tickets",
        "giveaway",
        "tebex",
      ],
      ticket_status: ["open", "claimed", "closed"],
      ticket_type: ["support", "application"],
    },
  },
} as const
