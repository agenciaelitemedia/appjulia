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
      agent_aliases: {
        Row: {
          alias: string
          cod_agent: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          alias: string
          cod_agent: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          alias?: string
          cod_agent?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_change_log: {
        Row: {
          action: string
          agent_id: number
          change_summary: string | null
          changed_by: string | null
          changed_by_id: number | null
          changes: Json | null
          cod_agent: string
          created_at: string | null
          id: string
          snapshot: Json | null
        }
        Insert: {
          action?: string
          agent_id: number
          change_summary?: string | null
          changed_by?: string | null
          changed_by_id?: number | null
          changes?: Json | null
          cod_agent: string
          created_at?: string | null
          id?: string
          snapshot?: Json | null
        }
        Update: {
          action?: string
          agent_id?: number
          change_summary?: string | null
          changed_by?: string | null
          changed_by_id?: number | null
          changes?: Json | null
          cod_agent?: string
          created_at?: string | null
          id?: string
          snapshot?: Json | null
        }
        Relationships: []
      }
      ai_provider_keys: {
        Row: {
          api_key: string
          created_at: string
          provider: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          provider: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_agent_capacity: {
        Row: {
          agent_identifier: string
          agent_name: string | null
          client_id: string
          created_at: string
          current_load: number
          id: string
          is_active: boolean
          last_assigned_at: string | null
          max_concurrent: number
          status: string
          updated_at: string
        }
        Insert: {
          agent_identifier: string
          agent_name?: string | null
          client_id: string
          created_at?: string
          current_load?: number
          id?: string
          is_active?: boolean
          last_assigned_at?: string | null
          max_concurrent?: number
          status?: string
          updated_at?: string
        }
        Update: {
          agent_identifier?: string
          agent_name?: string | null
          client_id?: string
          created_at?: string
          current_load?: number
          id?: string
          is_active?: boolean
          last_assigned_at?: string | null
          max_concurrent?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_ai_autoreply_logs: {
        Row: {
          client_id: string
          confidence: number | null
          conversation_id: string
          created_at: string
          error_message: string | null
          generated_text: string | null
          id: string
          message_id: string | null
          rule_id: string | null
          sent: boolean
          used_kb_articles: string[] | null
        }
        Insert: {
          client_id: string
          confidence?: number | null
          conversation_id: string
          created_at?: string
          error_message?: string | null
          generated_text?: string | null
          id?: string
          message_id?: string | null
          rule_id?: string | null
          sent?: boolean
          used_kb_articles?: string[] | null
        }
        Update: {
          client_id?: string
          confidence?: number | null
          conversation_id?: string
          created_at?: string
          error_message?: string | null
          generated_text?: string | null
          id?: string
          message_id?: string | null
          rule_id?: string | null
          sent?: boolean
          used_kb_articles?: string[] | null
        }
        Relationships: []
      }
      chat_ai_autoreply_rules: {
        Row: {
          client_id: string
          cod_agent: string | null
          confidence_threshold: number
          created_at: string
          description: string | null
          execution_count: number
          handoff_after_max: boolean
          id: string
          is_active: boolean
          kb_category_id: string | null
          last_executed_at: string | null
          match_intents: string[]
          match_keywords: string[]
          max_replies_per_conversation: number
          model: string
          name: string
          only_business_hours: boolean
          position: number
          system_prompt: string | null
          updated_at: string
          use_knowledge_base: boolean
        }
        Insert: {
          client_id: string
          cod_agent?: string | null
          confidence_threshold?: number
          created_at?: string
          description?: string | null
          execution_count?: number
          handoff_after_max?: boolean
          id?: string
          is_active?: boolean
          kb_category_id?: string | null
          last_executed_at?: string | null
          match_intents?: string[]
          match_keywords?: string[]
          max_replies_per_conversation?: number
          model?: string
          name: string
          only_business_hours?: boolean
          position?: number
          system_prompt?: string | null
          updated_at?: string
          use_knowledge_base?: boolean
        }
        Update: {
          client_id?: string
          cod_agent?: string | null
          confidence_threshold?: number
          created_at?: string
          description?: string | null
          execution_count?: number
          handoff_after_max?: boolean
          id?: string
          is_active?: boolean
          kb_category_id?: string | null
          last_executed_at?: string | null
          match_intents?: string[]
          match_keywords?: string[]
          max_replies_per_conversation?: number
          model?: string
          name?: string
          only_business_hours?: boolean
          position?: number
          system_prompt?: string | null
          updated_at?: string
          use_knowledge_base?: boolean
        }
        Relationships: []
      }
      chat_ai_classifications: {
        Row: {
          client_id: string
          cod_agent: string | null
          confidence: number | null
          conversation_id: string
          created_at: string
          id: string
          intent: string | null
          language: string | null
          message_id: string | null
          model: string | null
          raw_response: Json | null
          sentiment: string | null
          topics: string[]
          urgency: string | null
        }
        Insert: {
          client_id: string
          cod_agent?: string | null
          confidence?: number | null
          conversation_id: string
          created_at?: string
          id?: string
          intent?: string | null
          language?: string | null
          message_id?: string | null
          model?: string | null
          raw_response?: Json | null
          sentiment?: string | null
          topics?: string[]
          urgency?: string | null
        }
        Update: {
          client_id?: string
          cod_agent?: string | null
          confidence?: number | null
          conversation_id?: string
          created_at?: string
          id?: string
          intent?: string | null
          language?: string | null
          message_id?: string | null
          model?: string | null
          raw_response?: Json | null
          sentiment?: string | null
          topics?: string[]
          urgency?: string | null
        }
        Relationships: []
      }
      chat_analytics_daily: {
        Row: {
          avg_first_response_seconds: number | null
          avg_resolution_seconds: number | null
          by_agent: Json
          by_channel: Json
          by_tag: Json
          client_id: string
          cod_agent: string | null
          created_at: string
          csat_avg: number | null
          csat_responses: number
          date: string
          id: string
          inbound_messages: number
          new_conversations: number
          outbound_messages: number
          resolved_conversations: number
          sla_compliance_pct: number | null
          total_conversations: number
          total_messages: number
          updated_at: string
        }
        Insert: {
          avg_first_response_seconds?: number | null
          avg_resolution_seconds?: number | null
          by_agent?: Json
          by_channel?: Json
          by_tag?: Json
          client_id: string
          cod_agent?: string | null
          created_at?: string
          csat_avg?: number | null
          csat_responses?: number
          date: string
          id?: string
          inbound_messages?: number
          new_conversations?: number
          outbound_messages?: number
          resolved_conversations?: number
          sla_compliance_pct?: number | null
          total_conversations?: number
          total_messages?: number
          updated_at?: string
        }
        Update: {
          avg_first_response_seconds?: number | null
          avg_resolution_seconds?: number | null
          by_agent?: Json
          by_channel?: Json
          by_tag?: Json
          client_id?: string
          cod_agent?: string | null
          created_at?: string
          csat_avg?: number | null
          csat_responses?: number
          date?: string
          id?: string
          inbound_messages?: number
          new_conversations?: number
          outbound_messages?: number
          resolved_conversations?: number
          sla_compliance_pct?: number | null
          total_conversations?: number
          total_messages?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_api_keys: {
        Row: {
          client_id: string
          cod_agent: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[]
        }
        Insert: {
          client_id: string
          cod_agent?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[]
        }
        Update: {
          client_id?: string
          cod_agent?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[]
        }
        Relationships: []
      }
      chat_audit_log: {
        Row: {
          action: string
          actor_identifier: string | null
          actor_ip: string | null
          actor_name: string | null
          after_state: Json | null
          before_state: Json | null
          client_id: string
          cod_agent: string | null
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string
          severity: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_identifier?: string | null
          actor_ip?: string | null
          actor_name?: string | null
          after_state?: Json | null
          before_state?: Json | null
          client_id: string
          cod_agent?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type: string
          severity?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_identifier?: string | null
          actor_ip?: string | null
          actor_name?: string | null
          after_state?: Json | null
          before_state?: Json | null
          client_id?: string
          cod_agent?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string
          severity?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      chat_automation_logs: {
        Row: {
          action_type: string
          client_id: string
          conversation_id: string | null
          details: Json | null
          error_message: string | null
          executed_at: string
          id: string
          rule_id: string
          success: boolean
          trigger_type: string
        }
        Insert: {
          action_type: string
          client_id: string
          conversation_id?: string | null
          details?: Json | null
          error_message?: string | null
          executed_at?: string
          id?: string
          rule_id: string
          success?: boolean
          trigger_type: string
        }
        Update: {
          action_type?: string
          client_id?: string
          conversation_id?: string | null
          details?: Json | null
          error_message?: string | null
          executed_at?: string
          id?: string
          rule_id?: string
          success?: boolean
          trigger_type?: string
        }
        Relationships: []
      }
      chat_automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          client_id: string
          cod_agent: string | null
          conditions: Json
          created_at: string
          description: string | null
          execution_count: number
          id: string
          is_active: boolean
          last_executed_at: string | null
          name: string
          position: number
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          client_id: string
          cod_agent?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name: string
          position?: number
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          client_id?: string
          cod_agent?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name?: string
          position?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_bot_flow_runs: {
        Row: {
          client_id: string
          contact_id: string | null
          context: Json
          conversation_id: string | null
          current_node_id: string | null
          finished_at: string | null
          flow_id: string
          id: string
          last_step_at: string
          started_at: string
          status: string
        }
        Insert: {
          client_id: string
          contact_id?: string | null
          context?: Json
          conversation_id?: string | null
          current_node_id?: string | null
          finished_at?: string | null
          flow_id: string
          id?: string
          last_step_at?: string
          started_at?: string
          status?: string
        }
        Update: {
          client_id?: string
          contact_id?: string | null
          context?: Json
          conversation_id?: string | null
          current_node_id?: string | null
          finished_at?: string | null
          flow_id?: string
          id?: string
          last_step_at?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_bot_flow_runs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chat_bot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_bot_flows: {
        Row: {
          client_id: string
          cod_agent: string | null
          created_at: string
          description: string | null
          edges: Json
          execution_count: number
          id: string
          is_active: boolean
          last_executed_at: string | null
          match_mode: string
          name: string
          nodes: Json
          only_business_hours: boolean
          position: number
          start_node_id: string | null
          trigger_keywords: string[]
          trigger_type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          cod_agent?: string | null
          created_at?: string
          description?: string | null
          edges?: Json
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          match_mode?: string
          name: string
          nodes?: Json
          only_business_hours?: boolean
          position?: number
          start_node_id?: string | null
          trigger_keywords?: string[]
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          cod_agent?: string | null
          created_at?: string
          description?: string | null
          edges?: Json
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          match_mode?: string
          name?: string
          nodes?: Json
          only_business_hours?: boolean
          position?: number
          start_node_id?: string | null
          trigger_keywords?: string[]
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_bots: {
        Row: {
          client_id: string
          cod_agent: string | null
          created_at: string
          description: string | null
          execution_count: number
          handoff_to_human: boolean
          id: string
          is_active: boolean
          last_executed_at: string | null
          match_mode: string
          name: string
          only_business_hours: boolean
          position: number
          response_text: string
          trigger_keywords: string[]
          trigger_type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          cod_agent?: string | null
          created_at?: string
          description?: string | null
          execution_count?: number
          handoff_to_human?: boolean
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          match_mode?: string
          name: string
          only_business_hours?: boolean
          position?: number
          response_text: string
          trigger_keywords?: string[]
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          cod_agent?: string | null
          created_at?: string
          description?: string | null
          execution_count?: number
          handoff_to_human?: boolean
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          match_mode?: string
          name?: string
          only_business_hours?: boolean
          position?: number
          response_text?: string
          trigger_keywords?: string[]
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_bulk_close_logs: {
        Row: {
          actor_identifier: string | null
          actor_name: string | null
          assignment_type: string
          batch_id: string
          client_id: string
          closed_at: string
          contact_id: string | null
          conversation_id: string
          filters: Json
          id: string
          previous_assigned_to: string | null
          previous_status: string | null
          protocol: string | null
          queue_id: string | null
        }
        Insert: {
          actor_identifier?: string | null
          actor_name?: string | null
          assignment_type: string
          batch_id: string
          client_id: string
          closed_at?: string
          contact_id?: string | null
          conversation_id: string
          filters?: Json
          id?: string
          previous_assigned_to?: string | null
          previous_status?: string | null
          protocol?: string | null
          queue_id?: string | null
        }
        Update: {
          actor_identifier?: string | null
          actor_name?: string | null
          assignment_type?: string
          batch_id?: string
          client_id?: string
          closed_at?: string
          contact_id?: string | null
          conversation_id?: string
          filters?: Json
          id?: string
          previous_assigned_to?: string | null
          previous_status?: string | null
          protocol?: string | null
          queue_id?: string | null
        }
        Relationships: []
      }
      chat_call_logs: {
        Row: {
          agent_identifier: string | null
          answered_at: string | null
          client_id: string
          cod_agent: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          external_call_id: string | null
          from_number: string | null
          id: string
          metadata: Json
          notes: string | null
          provider: string | null
          recording_url: string | null
          started_at: string
          status: string
          to_number: string | null
          transcription: string | null
          updated_at: string
        }
        Insert: {
          agent_identifier?: string | null
          answered_at?: string | null
          client_id: string
          cod_agent?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          from_number?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          provider?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string
          to_number?: string | null
          transcription?: string | null
          updated_at?: string
        }
        Update: {
          agent_identifier?: string | null
          answered_at?: string | null
          client_id?: string
          cod_agent?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          from_number?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          provider?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string
          to_number?: string | null
          transcription?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_campaign_recipients: {
        Row: {
          campaign_id: string
          contact_id: string
          converted_at: string | null
          created_at: string
          error_message: string | null
          id: string
          phone: string
          replied_at: string | null
          sent_at: string | null
          status: string
          variant_id: string | null
        }
        Insert: {
          campaign_id: string
          contact_id: string
          converted_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          phone: string
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          variant_id?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          converted_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          phone?: string
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "chat_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_campaign_schedules: {
        Row: {
          campaign_id: string
          client_id: string
          created_at: string
          cron_expression: string | null
          id: string
          is_active: boolean
          last_run_at: string | null
          max_runs: number | null
          next_run_at: string | null
          run_count: number
          timezone: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          client_id: string
          created_at?: string
          cron_expression?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          max_runs?: number | null
          next_run_at?: string | null
          run_count?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          client_id?: string
          created_at?: string
          cron_expression?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          max_runs?: number | null
          next_run_at?: string | null
          run_count?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_campaign_variants: {
        Row: {
          campaign_id: string
          contacts_converted: number
          contacts_delivered: number
          contacts_replied: number
          contacts_sent: number
          created_at: string
          id: string
          label: string
          media_type: string | null
          media_url: string | null
          message_text: string
          weight: number
        }
        Insert: {
          campaign_id: string
          contacts_converted?: number
          contacts_delivered?: number
          contacts_replied?: number
          contacts_sent?: number
          created_at?: string
          id?: string
          label: string
          media_type?: string | null
          media_url?: string | null
          message_text: string
          weight?: number
        }
        Update: {
          campaign_id?: string
          contacts_converted?: number
          contacts_delivered?: number
          contacts_replied?: number
          contacts_sent?: number
          created_at?: string
          id?: string
          label?: string
          media_type?: string | null
          media_url?: string | null
          message_text?: string
          weight?: number
        }
        Relationships: []
      }
      chat_campaigns: {
        Row: {
          client_id: string
          cod_agent: string | null
          completed_at: string | null
          contacts_failed: number
          contacts_sent: number
          contacts_total: number
          created_at: string
          created_by: string | null
          filter_channel: string | null
          filter_tags: string[]
          id: string
          media_type: string | null
          media_url: string | null
          message_text: string
          name: string
          scheduled_for: string | null
          started_at: string | null
          status: string
          throttle_seconds: number
          updated_at: string
        }
        Insert: {
          client_id: string
          cod_agent?: string | null
          completed_at?: string | null
          contacts_failed?: number
          contacts_sent?: number
          contacts_total?: number
          created_at?: string
          created_by?: string | null
          filter_channel?: string | null
          filter_tags?: string[]
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_text: string
          name: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          throttle_seconds?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          cod_agent?: string | null
          completed_at?: string | null
          contacts_failed?: number
          contacts_sent?: number
          contacts_total?: number
          created_at?: string
          created_by?: string | null
          filter_channel?: string | null
          filter_tags?: string[]
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_text?: string
          name?: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          throttle_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_client_settings: {
        Row: {
          client_business_name: string | null
          client_id: string
          client_name: string | null
          created_at: string
          id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          client_business_name?: string | null
          client_id: string
          client_name?: string | null
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          client_business_name?: string | null
          client_id?: string
          client_name?: string | null
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      chat_contacts: {
        Row: {
          avatar: string | null
          channel_source: string | null
          channel_type: string
          client_id: string
          cod_agent: string | null
          created_at: string | null
          history_backfilled: boolean
          id: string
          is_archived: boolean | null
          is_group: boolean | null
          is_muted: boolean | null
          last_message_at: string | null
          last_message_text: string | null
          lead_email: string | null
          lead_full_name: string | null
          lead_personalid: string | null
          name: string
          phone: string
          profile_fetched_at: string | null
          profile_source: string | null
          remote_jid: string | null
          unread_count: number | null
          updated_at: string | null
          wa_business: boolean | null
          wa_name: string | null
          wa_status: string | null
          wa_verified_name: string | null
        }
        Insert: {
          avatar?: string | null
          channel_source?: string | null
          channel_type?: string
          client_id: string
          cod_agent?: string | null
          created_at?: string | null
          history_backfilled?: boolean
          id?: string
          is_archived?: boolean | null
          is_group?: boolean | null
          is_muted?: boolean | null
          last_message_at?: string | null
          last_message_text?: string | null
          lead_email?: string | null
          lead_full_name?: string | null
          lead_personalid?: string | null
          name: string
          phone: string
          profile_fetched_at?: string | null
          profile_source?: string | null
          remote_jid?: string | null
          unread_count?: number | null
          updated_at?: string | null
          wa_business?: boolean | null
          wa_name?: string | null
          wa_status?: string | null
          wa_verified_name?: string | null
        }
        Update: {
          avatar?: string | null
          channel_source?: string | null
          channel_type?: string
          client_id?: string
          cod_agent?: string | null
          created_at?: string | null
          history_backfilled?: boolean
          id?: string
          is_archived?: boolean | null
          is_group?: boolean | null
          is_muted?: boolean | null
          last_message_at?: string | null
          last_message_text?: string | null
          lead_email?: string | null
          lead_full_name?: string | null
          lead_personalid?: string | null
          name?: string
          phone?: string
          profile_fetched_at?: string | null
          profile_source?: string | null
          remote_jid?: string | null
          unread_count?: number | null
          updated_at?: string | null
          wa_business?: boolean | null
          wa_name?: string | null
          wa_status?: string | null
          wa_verified_name?: string | null
        }
        Relationships: []
      }
      chat_conversation_history: {
        Row: {
          action: string
          actor_name: string | null
          conversation_id: string
          created_at: string
          from_value: string | null
          id: string
          notes: string | null
          to_value: string | null
        }
        Insert: {
          action: string
          actor_name?: string | null
          conversation_id: string
          created_at?: string
          from_value?: string | null
          id?: string
          notes?: string | null
          to_value?: string | null
        }
        Update: {
          action?: string
          actor_name?: string | null
          conversation_id?: string
          created_at?: string
          from_value?: string | null
          id?: string
          notes?: string | null
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversation_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversation_participants: {
        Row: {
          added_by: string | null
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_identifier: string
          user_name: string | null
        }
        Insert: {
          added_by?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          role?: string
          user_identifier: string
          user_name?: string | null
        }
        Update: {
          added_by?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_identifier?: string
          user_name?: string | null
        }
        Relationships: []
      }
      chat_conversation_presence: {
        Row: {
          conversation_id: string
          id: string
          last_seen_at: string
          user_avatar: string | null
          user_identifier: string
          user_name: string | null
        }
        Insert: {
          conversation_id: string
          id?: string
          last_seen_at?: string
          user_avatar?: string | null
          user_identifier: string
          user_name?: string | null
        }
        Update: {
          conversation_id?: string
          id?: string
          last_seen_at?: string
          user_avatar?: string | null
          user_identifier?: string
          user_name?: string | null
        }
        Relationships: []
      }
      chat_conversation_summaries: {
        Row: {
          atendimento: string | null
          client_id: string
          contact_id: string
          conversation_id: string
          created_at: string | null
          first_message_ts: string | null
          id: string
          last_message_ts: string | null
          message_count: number | null
          sentiment: string | null
          summary: string
          triggered_by: string | null
        }
        Insert: {
          atendimento?: string | null
          client_id: string
          contact_id: string
          conversation_id: string
          created_at?: string | null
          first_message_ts?: string | null
          id?: string
          last_message_ts?: string | null
          message_count?: number | null
          sentiment?: string | null
          summary: string
          triggered_by?: string | null
        }
        Update: {
          atendimento?: string | null
          client_id?: string
          contact_id?: string
          conversation_id?: string
          created_at?: string | null
          first_message_ts?: string | null
          id?: string
          last_message_ts?: string | null
          message_count?: number | null
          sentiment?: string | null
          summary?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      chat_conversation_tags: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "chat_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          assigned_to: string | null
          channel: string
          client_id: string
          close_note: string | null
          close_reason: string | null
          closed_at: string | null
          cod_agent: string | null
          contact_id: string
          created_at: string
          department: string | null
          first_response_at: string | null
          id: string
          last_customer_message_at: string | null
          last_message_from_me: boolean | null
          metadata: Json | null
          opened_at: string
          priority: string
          protocol: string
          queue_id: string | null
          resolved_at: string | null
          snooze_reason: string | null
          snoozed_by: string | null
          snoozed_until: string | null
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel?: string
          client_id: string
          close_note?: string | null
          close_reason?: string | null
          closed_at?: string | null
          cod_agent?: string | null
          contact_id: string
          created_at?: string
          department?: string | null
          first_response_at?: string | null
          id?: string
          last_customer_message_at?: string | null
          last_message_from_me?: boolean | null
          metadata?: Json | null
          opened_at?: string
          priority?: string
          protocol: string
          queue_id?: string | null
          resolved_at?: string | null
          snooze_reason?: string | null
          snoozed_by?: string | null
          snoozed_until?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          client_id?: string
          close_note?: string | null
          close_reason?: string | null
          closed_at?: string | null
          cod_agent?: string | null
          contact_id?: string
          created_at?: string
          department?: string | null
          first_response_at?: string | null
          id?: string
          last_customer_message_at?: string | null
          last_message_from_me?: boolean | null
          metadata?: Json | null
          opened_at?: string
          priority?: string
          protocol?: string
          queue_id?: string | null
          resolved_at?: string | null
          snooze_reason?: string | null
          snoozed_by?: string | null
          snoozed_until?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "chat_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "active_queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_crm_links: {
        Row: {
          client_id: string
          cod_agent: string | null
          contact_id: string | null
          conversation_id: string
          created_at: string
          external_id: string
          external_system: string
          external_url: string | null
          id: string
          last_synced_at: string | null
          metadata: Json
          sync_direction: string
          updated_at: string
        }
        Insert: {
          client_id: string
          cod_agent?: string | null
          contact_id?: string | null
          conversation_id: string
          created_at?: string
          external_id: string
          external_system?: string
          external_url?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          sync_direction?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          cod_agent?: string | null
          contact_id?: string | null
          conversation_id?: string
          created_at?: string
          external_id?: string
          external_system?: string
          external_url?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          sync_direction?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_csat_config: {
        Row: {
          auto_send_after_resolve: boolean
          client_id: string
          cod_agent: string | null
          created_at: string
          delay_minutes: number
          id: string
          is_active: boolean
          message_template: string
          survey_type: string
          thank_you_message: string
          updated_at: string
        }
        Insert: {
          auto_send_after_resolve?: boolean
          client_id: string
          cod_agent?: string | null
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          message_template?: string
          survey_type?: string
          thank_you_message?: string
          updated_at?: string
        }
        Update: {
          auto_send_after_resolve?: boolean
          client_id?: string
          cod_agent?: string | null
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          message_template?: string
          survey_type?: string
          thank_you_message?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_csat_responses: {
        Row: {
          client_id: string
          cod_agent: string | null
          contact_id: string | null
          conversation_id: string
          feedback: string | null
          id: string
          responded_at: string | null
          score: number
          sent_at: string
          status: string
          survey_type: string
        }
        Insert: {
          client_id: string
          cod_agent?: string | null
          contact_id?: string | null
          conversation_id: string
          feedback?: string | null
          id?: string
          responded_at?: string | null
          score: number
          sent_at?: string
          status?: string
          survey_type?: string
        }
        Update: {
          client_id?: string
          cod_agent?: string | null
          contact_id?: string | null
          conversation_id?: string
          feedback?: string | null
          id?: string
          responded_at?: string | null
          score?: number
          sent_at?: string
          status?: string
          survey_type?: string
        }
        Relationships: []
      }
      chat_departments: {
        Row: {
          agents: string[] | null
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          agents?: string[] | null
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          agents?: string[] | null
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_kb_articles: {
        Row: {
          category_id: string | null
          client_id: string
          cod_agent: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          keywords: string[]
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          use_count: number
          view_count: number
        }
        Insert: {
          category_id?: string | null
          client_id: string
          cod_agent?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          keywords?: string[]
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          use_count?: number
          view_count?: number
        }
        Update: {
          category_id?: string | null
          client_id?: string
          cod_agent?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          keywords?: string[]
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          use_count?: number
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_kb_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "chat_kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_kb_categories: {
        Row: {
          client_id: string
          color: string
          created_at: string
          icon: string | null
          id: string
          name: string
          position: number
        }
        Insert: {
          client_id: string
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          position?: number
        }
        Update: {
          client_id?: string
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      chat_lgpd_requests: {
        Row: {
          client_id: string
          cod_agent: string | null
          contact_id: string | null
          contact_phone: string | null
          created_at: string
          id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          request_type: string
          requested_by: string | null
          result_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          cod_agent?: string | null
          contact_id?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          request_type: string
          requested_by?: string | null
          result_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          cod_agent?: string | null
          contact_id?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          request_type?: string
          requested_by?: string | null
          result_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_mentions: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          mentioned_by: string | null
          mentioned_by_name: string | null
          mentioned_user: string
          mentioned_user_name: string | null
          message_id: string | null
          preview_text: string | null
          read_at: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          mentioned_by?: string | null
          mentioned_by_name?: string | null
          mentioned_user: string
          mentioned_user_name?: string | null
          message_id?: string | null
          preview_text?: string | null
          read_at?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          mentioned_by?: string | null
          mentioned_by_name?: string | null
          mentioned_user?: string
          mentioned_user_name?: string | null
          message_id?: string | null
          preview_text?: string | null
          read_at?: string | null
        }
        Relationships: []
      }
      chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          external_message_id: string | null
          from_me: boolean
          id: string
          message_id: string
          reactor: string
        }
        Insert: {
          created_at?: string
          emoji: string
          external_message_id?: string | null
          from_me?: boolean
          id?: string
          message_id: string
          reactor: string
        }
        Update: {
          created_at?: string
          emoji?: string
          external_message_id?: string | null
          from_me?: boolean
          id?: string
          message_id?: string
          reactor?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          caption: string | null
          channel_type: string
          client_id: string
          contact_id: string
          conversation_id: string | null
          created_at: string | null
          external_id: string | null
          file_name: string | null
          forwarded_score: number | null
          from_me: boolean | null
          id: string
          internal_note: boolean | null
          is_forwarded: boolean | null
          media_url: string | null
          message_id: string | null
          metadata: Json | null
          note_type: string | null
          raw_payload: Json | null
          reply_to: string | null
          sender_name: string | null
          status: string | null
          text: string | null
          timestamp: string | null
          type: string | null
        }
        Insert: {
          caption?: string | null
          channel_type?: string
          client_id: string
          contact_id: string
          conversation_id?: string | null
          created_at?: string | null
          external_id?: string | null
          file_name?: string | null
          forwarded_score?: number | null
          from_me?: boolean | null
          id?: string
          internal_note?: boolean | null
          is_forwarded?: boolean | null
          media_url?: string | null
          message_id?: string | null
          metadata?: Json | null
          note_type?: string | null
          raw_payload?: Json | null
          reply_to?: string | null
          sender_name?: string | null
          status?: string | null
          text?: string | null
          timestamp?: string | null
          type?: string | null
        }
        Update: {
          caption?: string | null
          channel_type?: string
          client_id?: string
          contact_id?: string
          conversation_id?: string | null
          created_at?: string | null
          external_id?: string | null
          file_name?: string | null
          forwarded_score?: number | null
          from_me?: boolean | null
          id?: string
          internal_note?: boolean | null
          is_forwarded?: boolean | null
          media_url?: string | null
          message_id?: string | null
          metadata?: Json | null
          note_type?: string | null
          raw_payload?: Json | null
          reply_to?: string | null
          sender_name?: string | null
          status?: string | null
          text?: string | null
          timestamp?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "chat_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_return_chat_runs: {
        Row: {
          candidates: number
          duration_ms: number
          errors: number
          id: string
          notes: string | null
          processed: number
          ran_at: string
          rpc_ms: number
          trigger: string
        }
        Insert: {
          candidates?: number
          duration_ms: number
          errors?: number
          id?: string
          notes?: string | null
          processed?: number
          ran_at?: string
          rpc_ms: number
          trigger?: string
        }
        Update: {
          candidates?: number
          duration_ms?: number
          errors?: number
          id?: string
          notes?: string | null
          processed?: number
          ran_at?: string
          rpc_ms?: number
          trigger?: string
        }
        Relationships: []
      }
      chat_role_permissions: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          permissions: Json
          role_name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          permissions?: Json
          role_name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          permissions?: Json
          role_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_routing_rules: {
        Row: {
          agent_pool: string[]
          client_id: string
          cod_agent: string | null
          conditions: Json
          created_at: string
          description: string | null
          execution_count: number
          fallback_assigned_to: string | null
          id: string
          is_active: boolean
          last_assigned_to: string | null
          last_executed_at: string | null
          name: string
          only_business_hours: boolean
          position: number
          strategy: string
          target_queue_id: string | null
          updated_at: string
        }
        Insert: {
          agent_pool?: string[]
          client_id: string
          cod_agent?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          execution_count?: number
          fallback_assigned_to?: string | null
          id?: string
          is_active?: boolean
          last_assigned_to?: string | null
          last_executed_at?: string | null
          name: string
          only_business_hours?: boolean
          position?: number
          strategy?: string
          target_queue_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_pool?: string[]
          client_id?: string
          cod_agent?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          execution_count?: number
          fallback_assigned_to?: string | null
          id?: string
          is_active?: boolean
          last_assigned_to?: string | null
          last_executed_at?: string | null
          name?: string
          only_business_hours?: boolean
          position?: number
          strategy?: string
          target_queue_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_saved_views: {
        Row: {
          client_id: string
          cod_agent: string | null
          color: string | null
          created_at: string
          filters: Json
          icon: string | null
          id: string
          is_shared: boolean
          name: string
          owner_identifier: string | null
          position: number
          updated_at: string
        }
        Insert: {
          client_id: string
          cod_agent?: string | null
          color?: string | null
          created_at?: string
          filters?: Json
          icon?: string | null
          id?: string
          is_shared?: boolean
          name: string
          owner_identifier?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          cod_agent?: string | null
          color?: string | null
          created_at?: string
          filters?: Json
          icon?: string | null
          id?: string
          is_shared?: boolean
          name?: string
          owner_identifier?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_scheduled_messages: {
        Row: {
          attempts: number
          caption: string | null
          client_id: string
          cod_agent: string | null
          contact_id: string
          conversation_id: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          file_name: string | null
          id: string
          last_error: string | null
          media_type: string | null
          media_url: string | null
          reply_to: string | null
          scheduled_for: string
          sent_at: string | null
          sent_message_id: string | null
          status: string
          text: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          caption?: string | null
          client_id: string
          cod_agent?: string | null
          contact_id: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          file_name?: string | null
          id?: string
          last_error?: string | null
          media_type?: string | null
          media_url?: string | null
          reply_to?: string | null
          scheduled_for: string
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string
          text?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          caption?: string | null
          client_id?: string
          cod_agent?: string | null
          contact_id?: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          file_name?: string | null
          id?: string
          last_error?: string | null
          media_type?: string | null
          media_url?: string | null
          reply_to?: string | null
          scheduled_for?: string
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string
          text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_sla_configs: {
        Row: {
          client_id: string
          cod_agent: string | null
          created_at: string
          first_response_minutes: number
          id: string
          is_active: boolean
          nrt_response_minutes: number
          priority: string
          resolution_minutes: number
          updated_at: string
        }
        Insert: {
          client_id: string
          cod_agent?: string | null
          created_at?: string
          first_response_minutes?: number
          id?: string
          is_active?: boolean
          nrt_response_minutes?: number
          priority?: string
          resolution_minutes?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          cod_agent?: string | null
          created_at?: string
          first_response_minutes?: number
          id?: string
          is_active?: boolean
          nrt_response_minutes?: number
          priority?: string
          resolution_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_tags: {
        Row: {
          client_id: string
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          client_id: string
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          client_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      chat_user_security: {
        Row: {
          backup_codes: Json | null
          created_at: string
          failed_attempts: number
          id: string
          last_login_at: string | null
          last_login_ip: string | null
          locked_until: string | null
          totp_enabled: boolean
          totp_secret: string | null
          totp_verified_at: string | null
          updated_at: string
          user_identifier: string
        }
        Insert: {
          backup_codes?: Json | null
          created_at?: string
          failed_attempts?: number
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          locked_until?: string | null
          totp_enabled?: boolean
          totp_secret?: string | null
          totp_verified_at?: string | null
          updated_at?: string
          user_identifier: string
        }
        Update: {
          backup_codes?: Json | null
          created_at?: string
          failed_attempts?: number
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          locked_until?: string | null
          totp_enabled?: boolean
          totp_secret?: string | null
          totp_verified_at?: string | null
          updated_at?: string
          user_identifier?: string
        }
        Relationships: []
      }
      chat_webhook_deliveries: {
        Row: {
          delivered_at: string
          error_message: string | null
          event: string
          id: string
          payload: Json
          status_code: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          delivered_at?: string
          error_message?: string | null
          event: string
          id?: string
          payload: Json
          status_code?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          delivered_at?: string
          error_message?: string | null
          event?: string
          id?: string
          payload?: Json
          status_code?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: []
      }
      chat_webhooks: {
        Row: {
          client_id: string
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          name: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          client_id: string
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          name: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          client_id?: string
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      client_ai_model_config: {
        Row: {
          client_id: string
          feature: string
          id: string
          model: string
          prompt: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          feature: string
          id?: string
          model?: string
          prompt?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          feature?: string
          id?: string
          model?: string
          prompt?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      client_ai_model_config_list: {
        Row: {
          created_at: string
          feature: string
          id: string
          is_default: boolean
          label: string
          model: string
          provider: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature: string
          id?: string
          is_default?: boolean
          label: string
          model: string
          provider: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          is_default?: boolean
          label?: string
          model?: string
          provider?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      contract_deletion_audit: {
        Row: {
          cod_agent: string | null
          cod_document: string
          deleted_at: string
          deleted_by: string | null
          id: string
          previous_status: string | null
          reason: string | null
          signer_name: string | null
          whatsapp: string | null
        }
        Insert: {
          cod_agent?: string | null
          cod_document: string
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          previous_status?: string | null
          reason?: string | null
          signer_name?: string | null
          whatsapp?: string | null
        }
        Update: {
          cod_agent?: string | null
          cod_document?: string
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          previous_status?: string | null
          reason?: string | null
          signer_name?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      contract_notification_configs: {
        Row: {
          cod_agent: string
          created_at: string
          delay_interval_minutes: number | null
          id: string
          is_active: boolean
          message_template: string | null
          msg_cadence: Json | null
          office_repeat_count: number | null
          stages_count: number | null
          step_cadence: Json | null
          target_numbers: string[] | null
          target_numbers_config: Json | null
          title_cadence: Json | null
          trigger_cadence: Json | null
          trigger_event: string | null
          type: string
          updated_at: string
        }
        Insert: {
          cod_agent: string
          created_at?: string
          delay_interval_minutes?: number | null
          id?: string
          is_active?: boolean
          message_template?: string | null
          msg_cadence?: Json | null
          office_repeat_count?: number | null
          stages_count?: number | null
          step_cadence?: Json | null
          target_numbers?: string[] | null
          target_numbers_config?: Json | null
          title_cadence?: Json | null
          trigger_cadence?: Json | null
          trigger_event?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          cod_agent?: string
          created_at?: string
          delay_interval_minutes?: number | null
          id?: string
          is_active?: boolean
          message_template?: string | null
          msg_cadence?: Json | null
          office_repeat_count?: number | null
          stages_count?: number | null
          step_cadence?: Json | null
          target_numbers?: string[] | null
          target_numbers_config?: Json | null
          title_cadence?: Json | null
          trigger_cadence?: Json | null
          trigger_event?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_notification_logs: {
        Row: {
          cod_agent: string | null
          config_id: string | null
          contract_cod_document: string | null
          created_at: string
          error_message: string | null
          id: string
          message_text: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: string
          step_number: number | null
          type: string | null
        }
        Insert: {
          cod_agent?: string | null
          config_id?: string | null
          contract_cod_document?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_text?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
          step_number?: number | null
          type?: string | null
        }
        Update: {
          cod_agent?: string | null
          config_id?: string | null
          contract_cod_document?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_text?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
          step_number?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_notification_logs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "contract_notification_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_audit_log: {
        Row: {
          action: string
          changes: Json
          client_id: string
          cod_agent: string
          created_at: string
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          changes?: Json
          client_id: string
          cod_agent: string
          created_at?: string
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          changes?: Json
          client_id?: string
          cod_agent?: string
          created_at?: string
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      crm_automation_logs: {
        Row: {
          deal_id: string
          details: Json | null
          executed_at: string
          from_pipeline_id: string | null
          id: string
          rule_id: string
          success: boolean
          to_pipeline_id: string | null
        }
        Insert: {
          deal_id: string
          details?: Json | null
          executed_at?: string
          from_pipeline_id?: string | null
          id?: string
          rule_id: string
          success?: boolean
          to_pipeline_id?: string | null
        }
        Update: {
          deal_id?: string
          details?: Json | null
          executed_at?: string
          from_pipeline_id?: string | null
          id?: string
          rule_id?: string
          success?: boolean
          to_pipeline_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_automation_logs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automation_logs_from_pipeline_id_fkey"
            columns: ["from_pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "crm_automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automation_logs_to_pipeline_id_fkey"
            columns: ["to_pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_automation_rules: {
        Row: {
          action_data: Json | null
          action_type: string
          board_id: string
          client_id: string | null
          cod_agent: string
          conditions: Json | null
          created_at: string
          description: string | null
          execution_count: number
          from_pipeline_id: string | null
          id: string
          is_active: boolean
          last_executed_at: string | null
          name: string
          position: number
          to_pipeline_id: string | null
          trigger_field: string | null
          trigger_operator: string | null
          trigger_type: string
          trigger_value: string | null
          updated_at: string
        }
        Insert: {
          action_data?: Json | null
          action_type?: string
          board_id: string
          client_id?: string | null
          cod_agent: string
          conditions?: Json | null
          created_at?: string
          description?: string | null
          execution_count?: number
          from_pipeline_id?: string | null
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name: string
          position?: number
          to_pipeline_id?: string | null
          trigger_field?: string | null
          trigger_operator?: string | null
          trigger_type?: string
          trigger_value?: string | null
          updated_at?: string
        }
        Update: {
          action_data?: Json | null
          action_type?: string
          board_id?: string
          client_id?: string | null
          cod_agent?: string
          conditions?: Json | null
          created_at?: string
          description?: string | null
          execution_count?: number
          from_pipeline_id?: string | null
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name?: string
          position?: number
          to_pipeline_id?: string | null
          trigger_field?: string | null
          trigger_operator?: string | null
          trigger_type?: string
          trigger_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_automation_rules_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "crm_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automation_rules_from_pipeline_id_fkey"
            columns: ["from_pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automation_rules_to_pipeline_id_fkey"
            columns: ["to_pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_boards: {
        Row: {
          client_id: string | null
          cod_agent: string
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          position: number
          settings: Json | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          cod_agent: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          name: string
          position?: number
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          cod_agent?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          position?: number
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_checklist_items: {
        Row: {
          checklist_id: string
          created_at: string
          deal_id: string
          id: string
          is_completed: boolean
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          checklist_id: string
          created_at?: string
          deal_id: string
          id?: string
          is_completed?: boolean
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          checklist_id?: string
          created_at?: string
          deal_id?: string
          id?: string
          is_completed?: boolean
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "crm_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_checklist_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_checklists: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          position: number
          title: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          position?: number
          title: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_checklists_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_comercial_cards: {
        Row: {
          assigned_to: number | null
          cod_agent: string | null
          company_name: string | null
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string | null
          created_by: number | null
          id: number
          notes: string | null
          origin: string | null
          stage_entered_at: string | null
          stage_id: number
          updated_at: string | null
          value: number | null
        }
        Insert: {
          assigned_to?: number | null
          cod_agent?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string | null
          created_by?: number | null
          id?: number
          notes?: string | null
          origin?: string | null
          stage_entered_at?: string | null
          stage_id: number
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          assigned_to?: number | null
          cod_agent?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string | null
          created_by?: number | null
          id?: number
          notes?: string | null
          origin?: string | null
          stage_entered_at?: string | null
          stage_id?: number
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_comercial_cards_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_comercial_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_comercial_history: {
        Row: {
          card_id: number
          changed_at: string | null
          changed_by: number | null
          from_stage_id: number | null
          id: number
          notes: string | null
          to_stage_id: number
        }
        Insert: {
          card_id: number
          changed_at?: string | null
          changed_by?: number | null
          from_stage_id?: number | null
          id?: number
          notes?: string | null
          to_stage_id: number
        }
        Update: {
          card_id?: number
          changed_at?: string | null
          changed_by?: number | null
          from_stage_id?: number | null
          id?: number
          notes?: string | null
          to_stage_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_comercial_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_comercial_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_comercial_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_comercial_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_comercial_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_comercial_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_comercial_stages: {
        Row: {
          color: string
          id: number
          is_active: boolean
          name: string
          position: number
        }
        Insert: {
          color?: string
          id?: number
          is_active?: boolean
          name: string
          position?: number
        }
        Update: {
          color?: string
          id?: number
          is_active?: boolean
          name?: string
          position?: number
        }
        Relationships: []
      }
      crm_copilot_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: number
        }
        Relationships: []
      }
      crm_copilot_config: {
        Row: {
          business_hours_end: string
          business_hours_start: string
          check_interval_business: number
          check_interval_off: number
          cod_agent: string
          created_at: string
          id: string
          is_active: boolean
          last_check_at: string | null
          last_data_hash: string | null
          timezone: string
          updated_at: string
          user_id: number
        }
        Insert: {
          business_hours_end?: string
          business_hours_start?: string
          check_interval_business?: number
          check_interval_off?: number
          cod_agent: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_check_at?: string | null
          last_data_hash?: string | null
          timezone?: string
          updated_at?: string
          user_id: number
        }
        Update: {
          business_hours_end?: string
          business_hours_start?: string
          check_interval_business?: number
          check_interval_off?: number
          cod_agent?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_check_at?: string | null
          last_data_hash?: string | null
          timezone?: string
          updated_at?: string
          user_id?: number
        }
        Relationships: []
      }
      crm_copilot_insights: {
        Row: {
          cod_agent: string
          created_at: string
          description: string
          id: string
          insight_type: string
          is_read: boolean
          related_cards: Json | null
          severity: string
          title: string
          user_id: number
        }
        Insert: {
          cod_agent: string
          created_at?: string
          description: string
          id?: string
          insight_type?: string
          is_read?: boolean
          related_cards?: Json | null
          severity?: string
          title: string
          user_id: number
        }
        Update: {
          cod_agent?: string
          created_at?: string
          description?: string
          id?: string
          insight_type?: string
          is_read?: boolean
          related_cards?: Json | null
          severity?: string
          title?: string
          user_id?: number
        }
        Relationships: []
      }
      crm_copilot_settings: {
        Row: {
          created_at: string
          custom_prompt_suffix: string | null
          enabled_insight_types: Json
          id: string
          max_insights_per_run: number
          updated_at: string
          user_id: number
        }
        Insert: {
          created_at?: string
          custom_prompt_suffix?: string | null
          enabled_insight_types?: Json
          id?: string
          max_insights_per_run?: number
          updated_at?: string
          user_id: number
        }
        Update: {
          created_at?: string
          custom_prompt_suffix?: string | null
          enabled_insight_types?: Json
          id?: string
          max_insights_per_run?: number
          updated_at?: string
          user_id?: number
        }
        Relationships: []
      }
      crm_custom_fields: {
        Row: {
          board_id: string
          client_id: string | null
          cod_agent: string
          created_at: string
          default_value: string | null
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_required: boolean
          is_visible: boolean
          options: Json | null
          position: number
          updated_at: string
        }
        Insert: {
          board_id: string
          client_id?: string | null
          cod_agent: string
          created_at?: string
          default_value?: string | null
          field_label: string
          field_name: string
          field_type?: string
          id?: string
          is_required?: boolean
          is_visible?: boolean
          options?: Json | null
          position?: number
          updated_at?: string
        }
        Update: {
          board_id?: string
          client_id?: string | null
          cod_agent?: string
          created_at?: string
          default_value?: string | null
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_required?: boolean
          is_visible?: boolean
          options?: Json | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_custom_fields_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "crm_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changes: Json | null
          deal_id: string
          from_pipeline_id: string | null
          id: string
          notes: string | null
          to_pipeline_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changes?: Json | null
          deal_id: string
          from_pipeline_id?: string | null
          id?: string
          notes?: string | null
          to_pipeline_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changes?: Json | null
          deal_id?: string
          from_pipeline_id?: string | null
          id?: string
          notes?: string | null
          to_pipeline_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_history_from_pipeline_id_fkey"
            columns: ["from_pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_history_to_pipeline_id_fkey"
            columns: ["to_pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          assigned_to: string | null
          board_id: string
          client_id: string | null
          cod_agent: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          custom_fields: Json | null
          description: string | null
          due_date: string | null
          expected_close_date: string | null
          id: string
          pipeline_id: string
          position: number
          priority: string | null
          stage_entered_at: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          updated_by: string | null
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          board_id: string
          client_id?: string | null
          cod_agent: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          custom_fields?: Json | null
          description?: string | null
          due_date?: string | null
          expected_close_date?: string | null
          id?: string
          pipeline_id: string
          position?: number
          priority?: string | null
          stage_entered_at?: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          updated_by?: string | null
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          board_id?: string
          client_id?: string | null
          cod_agent?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          custom_fields?: Json | null
          description?: string | null
          due_date?: string | null
          expected_close_date?: string | null
          id?: string
          pipeline_id?: string
          position?: number
          priority?: string | null
          stage_entered_at?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "crm_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_internal_notes: {
        Row: {
          author_id: string | null
          author_name: string
          cod_agent: string
          created_at: string
          id: string
          note_text: string
          whatsapp_number: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          cod_agent: string
          created_at?: string
          id?: string
          note_text: string
          whatsapp_number: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          cod_agent?: string
          created_at?: string
          id?: string
          note_text?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      crm_pipelines: {
        Row: {
          board_id: string
          client_id: string | null
          cod_agent: string
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
          updated_at: string
          win_probability: number | null
        }
        Insert: {
          board_id: string
          client_id?: string | null
          cod_agent: string
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          updated_at?: string
          win_probability?: number | null
        }
        Update: {
          board_id?: string
          client_id?: string | null
          cod_agent?: string
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          updated_at?: string
          win_probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipelines_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "crm_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      datajud_alerts: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          movement_data: Json
          process_id: string
          user_id: number
          whatsapp_error: string | null
          whatsapp_sent: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          movement_data?: Json
          process_id: string
          user_id: number
          whatsapp_error?: string | null
          whatsapp_sent?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          movement_data?: Json
          process_id?: string
          user_id?: number
          whatsapp_error?: string | null
          whatsapp_sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "datajud_alerts_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "datajud_monitored_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      datajud_monitored_processes: {
        Row: {
          client_phone: string | null
          created_at: string
          id: string
          last_check_at: string | null
          last_known_movements: Json | null
          name: string
          process_number: string
          process_number_formatted: string
          status: string
          tribunal: string | null
          updated_at: string
          user_id: number
        }
        Insert: {
          client_phone?: string | null
          created_at?: string
          id?: string
          last_check_at?: string | null
          last_known_movements?: Json | null
          name: string
          process_number: string
          process_number_formatted: string
          status?: string
          tribunal?: string | null
          updated_at?: string
          user_id: number
        }
        Update: {
          client_phone?: string | null
          created_at?: string
          id?: string
          last_check_at?: string | null
          last_known_movements?: Json | null
          name?: string
          process_number?: string
          process_number_formatted?: string
          status?: string
          tribunal?: string | null
          updated_at?: string
          user_id?: number
        }
        Relationships: []
      }
      datajud_notification_config: {
        Row: {
          created_at: string
          default_agent_cod: string | null
          id: string
          is_active: boolean
          office_phones: string[] | null
          updated_at: string
          user_id: number
        }
        Insert: {
          created_at?: string
          default_agent_cod?: string | null
          id?: string
          is_active?: boolean
          office_phones?: string[] | null
          updated_at?: string
          user_id: number
        }
        Update: {
          created_at?: string
          default_agent_cod?: string | null
          id?: string
          is_active?: boolean
          office_phones?: string[] | null
          updated_at?: string
          user_id?: number
        }
        Relationships: []
      }
      dispatcher_heartbeat: {
        Row: {
          id: string
          items_per_min: number
          last_seen_at: string
          metadata: Json
          started_at: string
          total_processed_session: number
          workers_active: number
          workers_max: number
        }
        Insert: {
          id: string
          items_per_min?: number
          last_seen_at?: string
          metadata?: Json
          started_at?: string
          total_processed_session?: number
          workers_active?: number
          workers_max?: number
        }
        Update: {
          id?: string
          items_per_min?: number
          last_seen_at?: string
          metadata?: Json
          started_at?: string
          total_processed_session?: number
          workers_active?: number
          workers_max?: number
        }
        Relationships: []
      }
      generation_agent_prompt_cases: {
        Row: {
          agent_prompt_id: string
          case_id: string
          case_info: string | null
          case_name: string | null
          closing_model_text: string | null
          contract_fields: Json | null
          created_at: string | null
          ctas: Json | null
          fees_text: string | null
          id: string
          negotiation_text: string | null
          position: number | null
          qualification_script: string | null
          semantic_words: string | null
          zapsign_doc_token: string | null
          zapsign_token: string | null
        }
        Insert: {
          agent_prompt_id: string
          case_id: string
          case_info?: string | null
          case_name?: string | null
          closing_model_text?: string | null
          contract_fields?: Json | null
          created_at?: string | null
          ctas?: Json | null
          fees_text?: string | null
          id?: string
          negotiation_text?: string | null
          position?: number | null
          qualification_script?: string | null
          semantic_words?: string | null
          zapsign_doc_token?: string | null
          zapsign_token?: string | null
        }
        Update: {
          agent_prompt_id?: string
          case_id?: string
          case_info?: string | null
          case_name?: string | null
          closing_model_text?: string | null
          contract_fields?: Json | null
          created_at?: string | null
          ctas?: Json | null
          fees_text?: string | null
          id?: string
          negotiation_text?: string | null
          position?: number | null
          qualification_script?: string | null
          semantic_words?: string | null
          zapsign_doc_token?: string | null
          zapsign_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_agent_prompt_cases_agent_prompt_id_fkey"
            columns: ["agent_prompt_id"]
            isOneToOne: false
            referencedRelation: "generation_agent_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_agent_prompt_cases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "generation_legal_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_agent_prompt_versions: {
        Row: {
          change_summary: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          prompt_id: string
          snapshot: Json | null
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          prompt_id: string
          snapshot?: Json | null
          version_number: number
        }
        Update: {
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          prompt_id?: string
          snapshot?: Json | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "generation_agent_prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "generation_agent_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_agent_prompts: {
        Row: {
          agent_name: string | null
          ai_name: string | null
          business_name: string | null
          cod_agent: string
          created_at: string | null
          created_by: string | null
          generated_prompt: string | null
          id: string
          is_active: boolean | null
          office_info: string | null
          practice_areas: string | null
          prompt_published_at: string | null
          prompt_published_by: string | null
          template_id: string | null
          updated_at: string | null
          updated_by: string | null
          welcome_message: string | null
          working_hours: string | null
        }
        Insert: {
          agent_name?: string | null
          ai_name?: string | null
          business_name?: string | null
          cod_agent: string
          created_at?: string | null
          created_by?: string | null
          generated_prompt?: string | null
          id?: string
          is_active?: boolean | null
          office_info?: string | null
          practice_areas?: string | null
          prompt_published_at?: string | null
          prompt_published_by?: string | null
          template_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          welcome_message?: string | null
          working_hours?: string | null
        }
        Update: {
          agent_name?: string | null
          ai_name?: string | null
          business_name?: string | null
          cod_agent?: string
          created_at?: string | null
          created_by?: string | null
          generated_prompt?: string | null
          id?: string
          is_active?: boolean | null
          office_info?: string | null
          practice_areas?: string | null
          prompt_published_at?: string | null
          prompt_published_by?: string | null
          template_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          welcome_message?: string | null
          working_hours?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_agent_prompts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "generation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_legal_case_versions: {
        Row: {
          case_id: string
          case_info: string | null
          case_name: string
          category: string
          change_summary: string | null
          changed_by: string | null
          created_at: string | null
          fees_info: string | null
          id: string
          qualification_script: string | null
          version_number: number
        }
        Insert: {
          case_id: string
          case_info?: string | null
          case_name: string
          category: string
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string | null
          fees_info?: string | null
          id?: string
          qualification_script?: string | null
          version_number: number
        }
        Update: {
          case_id?: string
          case_info?: string | null
          case_name?: string
          category?: string
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string | null
          fees_info?: string | null
          id?: string
          qualification_script?: string | null
          version_number?: number
        }
        Relationships: []
      }
      generation_legal_cases: {
        Row: {
          case_info: string | null
          case_name: string
          category: string
          created_at: string
          created_by: string | null
          fees_info: string | null
          id: string
          is_active: boolean
          qualification_script: string | null
          updated_at: string
        }
        Insert: {
          case_info?: string | null
          case_name: string
          category: string
          created_at?: string
          created_by?: string | null
          fees_info?: string | null
          id?: string
          is_active?: boolean
          qualification_script?: string | null
          updated_at?: string
        }
        Update: {
          case_info?: string | null
          case_name?: string
          category?: string
          created_at?: string
          created_by?: string | null
          fees_info?: string | null
          id?: string
          is_active?: boolean
          qualification_script?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      generation_prompt_config: {
        Row: {
          config_key: string
          created_at: string
          description: string | null
          id: string
          prompt_text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          created_at?: string
          description?: string | null
          id?: string
          prompt_text: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          created_at?: string
          description?: string | null
          id?: string
          prompt_text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      generation_template_versions: {
        Row: {
          change_summary: string | null
          changed_by: string | null
          closing_model_text: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          prompt_text: string
          template_id: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          changed_by?: string | null
          closing_model_text?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          prompt_text: string
          template_id: string
          version_number: number
        }
        Update: {
          change_summary?: string | null
          changed_by?: string | null
          closing_model_text?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          prompt_text?: string
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "generation_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "generation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_templates: {
        Row: {
          closing_model_text: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          prompt_text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closing_model_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          prompt_text: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closing_model_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          prompt_text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      instagram_config: {
        Row: {
          client_id: string
          cod_agent: string
          created_at: string
          id: string
          instagram_page_id: string | null
          instagram_user_id: string | null
          is_active: boolean
          page_access_token: string | null
          page_name: string | null
          queue_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          cod_agent: string
          created_at?: string
          id?: string
          instagram_page_id?: string | null
          instagram_user_id?: string | null
          is_active?: boolean
          page_access_token?: string | null
          page_name?: string | null
          queue_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          cod_agent?: string
          created_at?: string
          id?: string
          instagram_page_id?: string | null
          instagram_user_id?: string | null
          is_active?: boolean
          page_access_token?: string | null
          page_name?: string | null
          queue_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_config_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "active_queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_config_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      julia_contract_template: {
        Row: {
          body_markdown: string
          id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_markdown?: string
          id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_markdown?: string
          id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      julia_orders: {
        Row: {
          billing_period: string | null
          checkout_url: string | null
          cod_agent: string | null
          contract_body: string | null
          created_at: string
          customer_address: string
          customer_document: string
          customer_email: string
          customer_name: string
          customer_whatsapp: string
          fee_amount: number | null
          id: string
          infinitypay_transaction_nsu: string | null
          installments: number | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          net_amount: number | null
          notes: string | null
          order_nsu: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_gateway: string
          plan_name: string
          plan_price: number
          receipt_url: string | null
          status: string
          updated_at: string
          webhook_payload: Json | null
        }
        Insert: {
          billing_period?: string | null
          checkout_url?: string | null
          cod_agent?: string | null
          contract_body?: string | null
          created_at?: string
          customer_address?: string
          customer_document: string
          customer_email?: string
          customer_name: string
          customer_whatsapp?: string
          fee_amount?: number | null
          id?: string
          infinitypay_transaction_nsu?: string | null
          installments?: number | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          net_amount?: number | null
          notes?: string | null
          order_nsu?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_gateway?: string
          plan_name?: string
          plan_price?: number
          receipt_url?: string | null
          status?: string
          updated_at?: string
          webhook_payload?: Json | null
        }
        Update: {
          billing_period?: string | null
          checkout_url?: string | null
          cod_agent?: string | null
          contract_body?: string | null
          created_at?: string
          customer_address?: string
          customer_document?: string
          customer_email?: string
          customer_name?: string
          customer_whatsapp?: string
          fee_amount?: number | null
          id?: string
          infinitypay_transaction_nsu?: string | null
          installments?: number | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          net_amount?: number | null
          notes?: string | null
          order_nsu?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_gateway?: string
          plan_name?: string
          plan_price?: number
          receipt_url?: string | null
          status?: string
          updated_at?: string
          webhook_payload?: Json | null
        }
        Relationships: []
      }
      julia_payment_config: {
        Row: {
          config: Json
          created_at: string
          gateway: string
          id: string
          is_active: boolean
          is_sandbox: boolean
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          gateway: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          gateway?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      julia_plans: {
        Row: {
          color: string
          created_at: string
          features: Json
          icon: string
          id: string
          is_active: boolean
          is_popular: boolean
          name: string
          position: number
          price: number
          price_annual: number
          price_display: string
          price_monthly: number
          price_semiannual: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          features?: Json
          icon?: string
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name: string
          position?: number
          price?: number
          price_annual?: number
          price_display?: string
          price_monthly?: number
          price_semiannual?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          features?: Json
          icon?: string
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name?: string
          position?: number
          price?: number
          price_annual?: number
          price_display?: string
          price_monthly?: number
          price_semiannual?: number
          updated_at?: string
        }
        Relationships: []
      }
      module_embeds: {
        Row: {
          allowed_origins: string[] | null
          auth_mode: string
          code: string
          created_at: string
          hmac_secret: string | null
          hmac_ttl_seconds: number
          id: string
          iframe_referrer_policy: string
          iframe_sandbox: string
          is_active: boolean
          name: string | null
          open_in_new_tab: boolean
          updated_at: string
          url_template: string
          variables: Json
        }
        Insert: {
          allowed_origins?: string[] | null
          auth_mode?: string
          code: string
          created_at?: string
          hmac_secret?: string | null
          hmac_ttl_seconds?: number
          id?: string
          iframe_referrer_policy?: string
          iframe_sandbox?: string
          is_active?: boolean
          name?: string | null
          open_in_new_tab?: boolean
          updated_at?: string
          url_template?: string
          variables?: Json
        }
        Update: {
          allowed_origins?: string[] | null
          auth_mode?: string
          code?: string
          created_at?: string
          hmac_secret?: string | null
          hmac_ttl_seconds?: number
          id?: string
          iframe_referrer_policy?: string
          iframe_sandbox?: string
          is_active?: boolean
          name?: string | null
          open_in_new_tab?: boolean
          updated_at?: string
          url_template?: string
          variables?: Json
        }
        Relationships: []
      }
      phone_call_logs: {
        Row: {
          answered_at: string | null
          call_id: string | null
          called: string | null
          caller: string | null
          client_id: number | null
          cod_agent: string | null
          cost: number | null
          created_at: string
          direction: string | null
          duration_seconds: number | null
          ended_at: string | null
          extension_number: string | null
          hangup_cause: string | null
          id: number
          metadata: Json | null
          record_url: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          answered_at?: string | null
          call_id?: string | null
          called?: string | null
          caller?: string | null
          client_id?: number | null
          cod_agent?: string | null
          cost?: number | null
          created_at?: string
          direction?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          extension_number?: string | null
          hangup_cause?: string | null
          id?: number
          metadata?: Json | null
          record_url?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          answered_at?: string | null
          call_id?: string | null
          called?: string | null
          caller?: string | null
          client_id?: number | null
          cod_agent?: string | null
          cost?: number | null
          created_at?: string
          direction?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          extension_number?: string | null
          hangup_cause?: string | null
          id?: number
          metadata?: Json | null
          record_url?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      phone_config: {
        Row: {
          api4com_domain: string | null
          api4com_token: string | null
          client_id: number | null
          cod_agent: string | null
          created_at: string
          id: number
          is_active: boolean
          provider: string
          sip_domain: string | null
          threecplus_base_url: string | null
          threecplus_token: string | null
          threecplus_ws_url: string | null
          updated_at: string
        }
        Insert: {
          api4com_domain?: string | null
          api4com_token?: string | null
          client_id?: number | null
          cod_agent?: string | null
          created_at?: string
          id?: number
          is_active?: boolean
          provider?: string
          sip_domain?: string | null
          threecplus_base_url?: string | null
          threecplus_token?: string | null
          threecplus_ws_url?: string | null
          updated_at?: string
        }
        Update: {
          api4com_domain?: string | null
          api4com_token?: string | null
          client_id?: number | null
          cod_agent?: string | null
          created_at?: string
          id?: number
          is_active?: boolean
          provider?: string
          sip_domain?: string | null
          threecplus_base_url?: string | null
          threecplus_token?: string | null
          threecplus_ws_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      phone_extension_plans: {
        Row: {
          created_at: string
          description: string | null
          extra_extension_price: number
          id: number
          is_active: boolean
          max_extensions: number
          name: string
          price: number
          price_annual: number
          price_monthly: number
          price_quarterly: number
          price_semiannual: number
          setup_fee_annual: number | null
          setup_fee_monthly: number | null
          setup_fee_quarterly: number | null
          setup_fee_semiannual: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          extra_extension_price?: number
          id?: number
          is_active?: boolean
          max_extensions?: number
          name: string
          price?: number
          price_annual?: number
          price_monthly?: number
          price_quarterly?: number
          price_semiannual?: number
          setup_fee_annual?: number | null
          setup_fee_monthly?: number | null
          setup_fee_quarterly?: number | null
          setup_fee_semiannual?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          extra_extension_price?: number
          id?: number
          is_active?: boolean
          max_extensions?: number
          name?: string
          price?: number
          price_annual?: number
          price_monthly?: number
          price_quarterly?: number
          price_semiannual?: number
          setup_fee_annual?: number | null
          setup_fee_monthly?: number | null
          setup_fee_quarterly?: number | null
          setup_fee_semiannual?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      phone_extensions: {
        Row: {
          api4com_email: string | null
          api4com_first_name: string | null
          api4com_id: string | null
          api4com_last_name: string | null
          api4com_password: string | null
          api4com_ramal: string | null
          api4com_raw: Json | null
          assigned_member_id: number | null
          client_id: number | null
          cod_agent: string | null
          created_at: string
          extension_number: string
          id: number
          is_active: boolean
          label: string | null
          provider: string
          sip_manual_domain: string | null
          sip_manual_password: string | null
          sip_manual_username: string | null
          threecplus_agent_id: string | null
          threecplus_extension: string | null
          threecplus_raw: Json | null
          threecplus_sip_domain: string | null
          threecplus_sip_password: string | null
          threecplus_sip_username: string | null
          updated_at: string
        }
        Insert: {
          api4com_email?: string | null
          api4com_first_name?: string | null
          api4com_id?: string | null
          api4com_last_name?: string | null
          api4com_password?: string | null
          api4com_ramal?: string | null
          api4com_raw?: Json | null
          assigned_member_id?: number | null
          client_id?: number | null
          cod_agent?: string | null
          created_at?: string
          extension_number: string
          id?: number
          is_active?: boolean
          label?: string | null
          provider?: string
          sip_manual_domain?: string | null
          sip_manual_password?: string | null
          sip_manual_username?: string | null
          threecplus_agent_id?: string | null
          threecplus_extension?: string | null
          threecplus_raw?: Json | null
          threecplus_sip_domain?: string | null
          threecplus_sip_password?: string | null
          threecplus_sip_username?: string | null
          updated_at?: string
        }
        Update: {
          api4com_email?: string | null
          api4com_first_name?: string | null
          api4com_id?: string | null
          api4com_last_name?: string | null
          api4com_password?: string | null
          api4com_ramal?: string | null
          api4com_raw?: Json | null
          assigned_member_id?: number | null
          client_id?: number | null
          cod_agent?: string | null
          created_at?: string
          extension_number?: string
          id?: number
          is_active?: boolean
          label?: string | null
          provider?: string
          sip_manual_domain?: string | null
          sip_manual_password?: string | null
          sip_manual_username?: string | null
          threecplus_agent_id?: string | null
          threecplus_extension?: string | null
          threecplus_raw?: Json | null
          threecplus_sip_domain?: string | null
          threecplus_sip_password?: string | null
          threecplus_sip_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      phone_user_plans: {
        Row: {
          assigned_at: string
          billing_period: string
          business_name: string | null
          client_id: number | null
          client_name: string | null
          cod_agent: string | null
          due_date: string | null
          extra_extensions: number
          id: number
          is_active: boolean
          plan_id: number
          recording_enabled: boolean
          source_order_id: string | null
          start_date: string
          transcription_enabled: boolean
        }
        Insert: {
          assigned_at?: string
          billing_period?: string
          business_name?: string | null
          client_id?: number | null
          client_name?: string | null
          cod_agent?: string | null
          due_date?: string | null
          extra_extensions?: number
          id?: number
          is_active?: boolean
          plan_id: number
          recording_enabled?: boolean
          source_order_id?: string | null
          start_date?: string
          transcription_enabled?: boolean
        }
        Update: {
          assigned_at?: string
          billing_period?: string
          business_name?: string | null
          client_id?: number | null
          client_name?: string | null
          cod_agent?: string | null
          due_date?: string | null
          extra_extensions?: number
          id?: number
          is_active?: boolean
          plan_id?: number
          recording_enabled?: boolean
          source_order_id?: string | null
          start_date?: string
          transcription_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "phone_user_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "phone_extension_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notifications: {
        Row: {
          body: string
          created_at: string | null
          created_by: number | null
          error_count: number | null
          icon: string | null
          id: string
          sent_at: string | null
          sent_count: number | null
          status: string | null
          target_type: string
          target_value: string | null
          title: string
          url: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: number | null
          error_count?: number | null
          icon?: string | null
          id?: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string | null
          target_type?: string
          target_value?: string | null
          title: string
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: number | null
          error_count?: number | null
          icon?: string | null
          id?: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string | null
          target_type?: string
          target_value?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: number
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: number
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: number
        }
        Relationships: []
      }
      queue_agent_links: {
        Row: {
          cod_agent: string
          created_at: string
          id: string
          is_primary: boolean
          queue_id: string
        }
        Insert: {
          cod_agent: string
          created_at?: string
          id?: string
          is_primary?: boolean
          queue_id: string
        }
        Update: {
          cod_agent?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          queue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_agent_links_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "active_queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_agent_links_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_orders: {
        Row: {
          billing_period: string
          checkout_url: string | null
          client_id: string
          created_at: string
          customer_document: string
          customer_email: string
          customer_name: string
          customer_whatsapp: string | null
          extra_queues: number
          extra_queues_total: number
          fee_amount: number | null
          id: string
          metadata: Json | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          net_amount: number | null
          order_nsu: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_gateway: string
          plan_id: number
          plan_name: string
          plan_price: number
          provisioned_at: string | null
          provisioning_error: string | null
          setup_fee: number
          status: string
          total_amount: number
          updated_at: string
          user_plan_id: number | null
          webhook_payload: Json | null
        }
        Insert: {
          billing_period: string
          checkout_url?: string | null
          client_id: string
          created_at?: string
          customer_document: string
          customer_email: string
          customer_name: string
          customer_whatsapp?: string | null
          extra_queues?: number
          extra_queues_total?: number
          fee_amount?: number | null
          id?: string
          metadata?: Json | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          net_amount?: number | null
          order_nsu?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_gateway?: string
          plan_id: number
          plan_name: string
          plan_price?: number
          provisioned_at?: string | null
          provisioning_error?: string | null
          setup_fee?: number
          status?: string
          total_amount?: number
          updated_at?: string
          user_plan_id?: number | null
          webhook_payload?: Json | null
        }
        Update: {
          billing_period?: string
          checkout_url?: string | null
          client_id?: string
          created_at?: string
          customer_document?: string
          customer_email?: string
          customer_name?: string
          customer_whatsapp?: string | null
          extra_queues?: number
          extra_queues_total?: number
          fee_amount?: number | null
          id?: string
          metadata?: Json | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          net_amount?: number | null
          order_nsu?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_gateway?: string
          plan_id?: number
          plan_name?: string
          plan_price?: number
          provisioned_at?: string | null
          provisioning_error?: string | null
          setup_fee?: number
          status?: string
          total_amount?: number
          updated_at?: string
          user_plan_id?: number | null
          webhook_payload?: Json | null
        }
        Relationships: []
      }
      queue_plans: {
        Row: {
          created_at: string
          description: string | null
          extra_queue_price: number
          id: number
          is_active: boolean
          max_queues: number
          name: string
          price_annual: number
          price_monthly: number
          price_quarterly: number
          price_semiannual: number
          setup_fee_annual: number | null
          setup_fee_monthly: number | null
          setup_fee_quarterly: number | null
          setup_fee_semiannual: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          extra_queue_price?: number
          id?: number
          is_active?: boolean
          max_queues?: number
          name: string
          price_annual?: number
          price_monthly?: number
          price_quarterly?: number
          price_semiannual?: number
          setup_fee_annual?: number | null
          setup_fee_monthly?: number | null
          setup_fee_quarterly?: number | null
          setup_fee_semiannual?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          extra_queue_price?: number
          id?: number
          is_active?: boolean
          max_queues?: number
          name?: string
          price_annual?: number
          price_monthly?: number
          price_quarterly?: number
          price_semiannual?: number
          setup_fee_annual?: number | null
          setup_fee_monthly?: number | null
          setup_fee_quarterly?: number | null
          setup_fee_semiannual?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      queue_providers: {
        Row: {
          client_id: string
          created_at: string
          evo_apikey: string | null
          evo_url: string | null
          id: string
          instagram_page_id: string | null
          instagram_user_id: string | null
          is_active: boolean
          meta_app_id: string | null
          meta_app_secret: string | null
          name: string
          page_access_token: string | null
          page_name: string | null
          provider_type: string
          updated_at: string
          waba_business_id: string | null
          waba_token: string | null
          webchat_config_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          evo_apikey?: string | null
          evo_url?: string | null
          id?: string
          instagram_page_id?: string | null
          instagram_user_id?: string | null
          is_active?: boolean
          meta_app_id?: string | null
          meta_app_secret?: string | null
          name: string
          page_access_token?: string | null
          page_name?: string | null
          provider_type: string
          updated_at?: string
          waba_business_id?: string | null
          waba_token?: string | null
          webchat_config_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          evo_apikey?: string | null
          evo_url?: string | null
          id?: string
          instagram_page_id?: string | null
          instagram_user_id?: string | null
          is_active?: boolean
          meta_app_id?: string | null
          meta_app_secret?: string | null
          name?: string
          page_access_token?: string | null
          page_name?: string | null
          provider_type?: string
          updated_at?: string
          waba_business_id?: string | null
          waba_token?: string | null
          webchat_config_id?: string | null
        }
        Relationships: []
      }
      queue_user_plans: {
        Row: {
          assigned_at: string
          billing_period: string
          business_name: string | null
          client_id: number | null
          client_name: string | null
          cod_agent: number | null
          created_at: string
          due_date: string | null
          extra_queues: number
          id: number
          is_active: boolean
          plan_id: number
          start_date: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          billing_period?: string
          business_name?: string | null
          client_id?: number | null
          client_name?: string | null
          cod_agent?: number | null
          created_at?: string
          due_date?: string | null
          extra_queues?: number
          id?: number
          is_active?: boolean
          plan_id: number
          start_date?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          billing_period?: string
          business_name?: string | null
          client_id?: number | null
          client_name?: string | null
          cod_agent?: number | null
          created_at?: string
          due_date?: string | null
          extra_queues?: number
          id?: number
          is_active?: boolean
          plan_id?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_user_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "queue_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      queues: {
        Row: {
          channel_type: string
          client_id: string
          created_at: string
          deleted_at: string | null
          evo_apikey: string | null
          evo_instance: string | null
          evo_url: string | null
          hub: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          name: string
          phone_number: string | null
          phone_resolved_at: string | null
          settings: Json
          updated_at: string
          waba_id: string | null
          waba_number_id: string | null
          waba_token: string | null
        }
        Insert: {
          channel_type?: string
          client_id: string
          created_at?: string
          deleted_at?: string | null
          evo_apikey?: string | null
          evo_instance?: string | null
          evo_url?: string | null
          hub?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          name: string
          phone_number?: string | null
          phone_resolved_at?: string | null
          settings?: Json
          updated_at?: string
          waba_id?: string | null
          waba_number_id?: string | null
          waba_token?: string | null
        }
        Update: {
          channel_type?: string
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          evo_apikey?: string | null
          evo_instance?: string | null
          evo_url?: string | null
          hub?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          name?: string
          phone_number?: string | null
          phone_resolved_at?: string | null
          settings?: Json
          updated_at?: string
          waba_id?: string | null
          waba_number_id?: string | null
          waba_token?: string | null
        }
        Relationships: []
      }
      quick_messages: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          message_text: string
          position: number | null
          shortcut: string | null
          title: string
          updated_at: string | null
          use_locations: string[] | null
          user_id: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_text: string
          position?: number | null
          shortcut?: string | null
          title: string
          updated_at?: string | null
          use_locations?: string[] | null
          user_id: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_text?: string
          position?: number | null
          shortcut?: string | null
          title?: string
          updated_at?: string | null
          use_locations?: string[] | null
          user_id?: number
        }
        Relationships: []
      }
      support_assistant_config: {
        Row: {
          api_key: string | null
          api_url: string | null
          connection_status: string | null
          created_at: string | null
          id: string
          instance_name: string | null
          instance_token: string | null
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          connection_status?: string | null
          created_at?: string | null
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          connection_status?: string | null
          created_at?: string | null
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      support_group_messages: {
        Row: {
          created_at: string | null
          group_jid: string
          group_name: string | null
          id: string
          instance_name: string | null
          is_from_me: boolean | null
          is_transcribed: boolean | null
          media_url: string | null
          message_id: string | null
          message_text: string | null
          message_type: string | null
          raw_payload: Json | null
          sender_jid: string | null
          sender_name: string | null
          sender_role: string | null
          timestamp: string | null
          transcription: string | null
        }
        Insert: {
          created_at?: string | null
          group_jid: string
          group_name?: string | null
          id?: string
          instance_name?: string | null
          is_from_me?: boolean | null
          is_transcribed?: boolean | null
          media_url?: string | null
          message_id?: string | null
          message_text?: string | null
          message_type?: string | null
          raw_payload?: Json | null
          sender_jid?: string | null
          sender_name?: string | null
          sender_role?: string | null
          timestamp?: string | null
          transcription?: string | null
        }
        Update: {
          created_at?: string | null
          group_jid?: string
          group_name?: string | null
          id?: string
          instance_name?: string | null
          is_from_me?: boolean | null
          is_transcribed?: boolean | null
          media_url?: string | null
          message_id?: string | null
          message_text?: string | null
          message_type?: string | null
          raw_payload?: Json | null
          sender_jid?: string | null
          sender_name?: string | null
          sender_role?: string | null
          timestamp?: string | null
          transcription?: string | null
        }
        Relationships: []
      }
      support_monitored_groups: {
        Row: {
          auto_added: boolean
          created_at: string | null
          group_jid: string
          group_name: string
          id: string
          is_active: boolean
          picture_url: string | null
          updated_at: string | null
        }
        Insert: {
          auto_added?: boolean
          created_at?: string | null
          group_jid: string
          group_name?: string
          id?: string
          is_active?: boolean
          picture_url?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_added?: boolean
          created_at?: string | null
          group_jid?: string
          group_name?: string
          id?: string
          is_active?: boolean
          picture_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      support_team_members: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string
          role: string | null
          user_id: number | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone: string
          role?: string | null
          user_id?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string
          role?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      task_categories: {
        Row: {
          client_id: string
          color: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_items: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          position: number
          status: string
          task_id: string
          template_item_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          position?: number
          status?: string
          task_id: string
          template_item_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          position?: number
          status?: string
          task_id?: string
          template_item_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "task_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      task_points_ledger: {
        Row: {
          action: string
          client_id: string
          created_at: string
          id: string
          note: string | null
          points: number
          task_id: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          action?: string
          client_id: string
          created_at?: string
          id?: string
          note?: string | null
          points: number
          task_id?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          client_id?: string
          created_at?: string
          id?: string
          note?: string | null
          points?: number
          task_id?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_points_ledger_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_template_items: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          position: number
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          position?: number
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          position?: number
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          category: string | null
          category_id: string | null
          client_id: string
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          is_active: boolean
          points: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          category_id?: string | null
          client_id: string
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          points?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          category_id?: string | null
          client_id?: string
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          points?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_name: string | null
          assigned_to: string | null
          cancelled_at: string | null
          category: string | null
          category_id: string | null
          client_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          points: number
          started_at: string | null
          status: string
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_name?: string | null
          assigned_to?: string | null
          cancelled_at?: string | null
          category?: string | null
          category_id?: string | null
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          points?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_name?: string | null
          assigned_to?: string | null
          cancelled_at?: string | null
          category?: string | null
          category_id?: string | null
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          points?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_orders: {
        Row: {
          billing_period: string
          checkout_url: string | null
          client_id: string
          config_id: number | null
          created_at: string
          customer_document: string
          customer_email: string
          customer_name: string
          customer_whatsapp: string | null
          extra_extensions: number
          extra_extensions_total: number
          fee_amount: number | null
          id: string
          metadata: Json | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          net_amount: number | null
          order_nsu: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_gateway: string
          plan_id: number
          plan_name: string
          plan_price: number
          provider_id: number | null
          provisioned_at: string | null
          provisioning_error: string | null
          recording_enabled: boolean
          recording_total: number
          setup_fee: number
          status: string
          total_amount: number
          transcription_enabled: boolean
          transcription_total: number
          updated_at: string
          user_plan_id: number | null
          webhook_payload: Json | null
        }
        Insert: {
          billing_period: string
          checkout_url?: string | null
          client_id: string
          config_id?: number | null
          created_at?: string
          customer_document: string
          customer_email: string
          customer_name: string
          customer_whatsapp?: string | null
          extra_extensions?: number
          extra_extensions_total?: number
          fee_amount?: number | null
          id?: string
          metadata?: Json | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          net_amount?: number | null
          order_nsu?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_gateway?: string
          plan_id: number
          plan_name: string
          plan_price?: number
          provider_id?: number | null
          provisioned_at?: string | null
          provisioning_error?: string | null
          recording_enabled?: boolean
          recording_total?: number
          setup_fee?: number
          status?: string
          total_amount?: number
          transcription_enabled?: boolean
          transcription_total?: number
          updated_at?: string
          user_plan_id?: number | null
          webhook_payload?: Json | null
        }
        Update: {
          billing_period?: string
          checkout_url?: string | null
          client_id?: string
          config_id?: number | null
          created_at?: string
          customer_document?: string
          customer_email?: string
          customer_name?: string
          customer_whatsapp?: string | null
          extra_extensions?: number
          extra_extensions_total?: number
          fee_amount?: number | null
          id?: string
          metadata?: Json | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          net_amount?: number | null
          order_nsu?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_gateway?: string
          plan_id?: number
          plan_name?: string
          plan_price?: number
          provider_id?: number | null
          provisioned_at?: string | null
          provisioning_error?: string | null
          recording_enabled?: boolean
          recording_total?: number
          setup_fee?: number
          status?: string
          total_amount?: number
          transcription_enabled?: boolean
          transcription_total?: number
          updated_at?: string
          user_plan_id?: number | null
          webhook_payload?: Json | null
        }
        Relationships: []
      }
      telephony_providers: {
        Row: {
          api4com_domain: string | null
          api4com_token: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          provider: string
          sip_domain: string | null
          threecplus_base_url: string | null
          threecplus_token: string | null
          threecplus_ws_url: string | null
          updated_at: string
        }
        Insert: {
          api4com_domain?: string | null
          api4com_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          provider: string
          sip_domain?: string | null
          threecplus_base_url?: string | null
          threecplus_token?: string | null
          threecplus_ws_url?: string | null
          updated_at?: string
        }
        Update: {
          api4com_domain?: string | null
          api4com_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          provider?: string
          sip_domain?: string | null
          threecplus_base_url?: string | null
          threecplus_token?: string | null
          threecplus_ws_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      uazapi_history_items: {
        Row: {
          attempts: number
          contact_created: boolean
          conversation_created: boolean
          created_at: string
          duplicate_messages: number
          error: string | null
          id: string
          inserted_messages: number
          last_attempt_at: string | null
          locked_at: string | null
          payload: Json | null
          phone: string | null
          processed_at: string | null
          received_messages: number
          remote_jid: string
          run_id: string
          skipped_lid: number
          status: string
          worker_id: number | null
        }
        Insert: {
          attempts?: number
          contact_created?: boolean
          conversation_created?: boolean
          created_at?: string
          duplicate_messages?: number
          error?: string | null
          id?: string
          inserted_messages?: number
          last_attempt_at?: string | null
          locked_at?: string | null
          payload?: Json | null
          phone?: string | null
          processed_at?: string | null
          received_messages?: number
          remote_jid: string
          run_id: string
          skipped_lid?: number
          status?: string
          worker_id?: number | null
        }
        Update: {
          attempts?: number
          contact_created?: boolean
          conversation_created?: boolean
          created_at?: string
          duplicate_messages?: number
          error?: string | null
          id?: string
          inserted_messages?: number
          last_attempt_at?: string | null
          locked_at?: string | null
          payload?: Json | null
          phone?: string | null
          processed_at?: string | null
          received_messages?: number
          remote_jid?: string
          run_id?: string
          skipped_lid?: number
          status?: string
          worker_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "uazapi_history_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "uazapi_history_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      uazapi_history_runs: {
        Row: {
          client_id: string
          client_name: string | null
          created_at: string
          duplicate_messages: number
          error: string | null
          event: string
          finished_at: string | null
          group_messages: number
          id: string
          individual_chats: number
          inserted_contacts: number
          inserted_messages: number
          processed_chats: number
          queue_id: string | null
          queue_name: string | null
          received_at: string
          skipped_lid: number
          started_at: string | null
          status: string
          total_messages: number
          updated_at: string
        }
        Insert: {
          client_id: string
          client_name?: string | null
          created_at?: string
          duplicate_messages?: number
          error?: string | null
          event?: string
          finished_at?: string | null
          group_messages?: number
          id?: string
          individual_chats?: number
          inserted_contacts?: number
          inserted_messages?: number
          processed_chats?: number
          queue_id?: string | null
          queue_name?: string | null
          received_at?: string
          skipped_lid?: number
          started_at?: string | null
          status?: string
          total_messages?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_name?: string | null
          created_at?: string
          duplicate_messages?: number
          error?: string | null
          event?: string
          finished_at?: string | null
          group_messages?: number
          id?: string
          individual_chats?: number
          inserted_contacts?: number
          inserted_messages?: number
          processed_chats?: number
          queue_id?: string | null
          queue_name?: string | null
          received_at?: string
          skipped_lid?: number
          started_at?: string | null
          status?: string
          total_messages?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          client_id: number | null
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          user_agent: string | null
          user_id: number
          user_name: string | null
        }
        Insert: {
          client_id?: number | null
          created_at?: string
          event_type: string
          id?: string
          occurred_at?: string
          user_agent?: string | null
          user_id: number
          user_name?: string | null
        }
        Update: {
          client_id?: number | null
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          user_agent?: string | null
          user_id?: number
          user_name?: string | null
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          client_id: number
          last_seen_at: string
          updated_at: string
          user_id: number
        }
        Insert: {
          client_id: number
          last_seen_at?: string
          updated_at?: string
          user_id: number
        }
        Update: {
          client_id?: number
          last_seen_at?: string
          updated_at?: string
          user_id?: number
        }
        Relationships: []
      }
      vellip_call_logs: {
        Row: {
          cd_called_status: string | null
          cd_date: string | null
          cd_id: string | null
          cd_name: string | null
          cd_price: string | null
          cd_resp1: string | null
          cd_route: string | null
          cd_time: string | null
          cd_time_end: string | null
          cd_time_sec: number | null
          cd_time_sec2: number | null
          cd_time_start: string | null
          cd_value: string | null
          cod_agent: string | null
          created_at: string
          id: string
          phone: string | null
          raw_payload: Json | null
          saldo: string | null
        }
        Insert: {
          cd_called_status?: string | null
          cd_date?: string | null
          cd_id?: string | null
          cd_name?: string | null
          cd_price?: string | null
          cd_resp1?: string | null
          cd_route?: string | null
          cd_time?: string | null
          cd_time_end?: string | null
          cd_time_sec?: number | null
          cd_time_sec2?: number | null
          cd_time_start?: string | null
          cd_value?: string | null
          cod_agent?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          raw_payload?: Json | null
          saldo?: string | null
        }
        Update: {
          cd_called_status?: string | null
          cd_date?: string | null
          cd_id?: string | null
          cd_name?: string | null
          cd_price?: string | null
          cd_resp1?: string | null
          cd_route?: string | null
          cd_time?: string | null
          cd_time_end?: string | null
          cd_time_sec?: number | null
          cd_time_sec2?: number | null
          cd_time_start?: string | null
          cd_value?: string | null
          cod_agent?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          raw_payload?: Json | null
          saldo?: string | null
        }
        Relationships: []
      }
      video_call_records: {
        Row: {
          cod_agent: string
          contact_name: string | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          lead_id: number | null
          lead_waiting_at: string | null
          operator_id: number | null
          operator_joined_at: string | null
          operator_name: string | null
          recording_id: string | null
          recording_status: string | null
          recording_url: string | null
          room_name: string
          started_at: string | null
          status: string | null
          whatsapp_number: string | null
        }
        Insert: {
          cod_agent: string
          contact_name?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: number | null
          lead_waiting_at?: string | null
          operator_id?: number | null
          operator_joined_at?: string | null
          operator_name?: string | null
          recording_id?: string | null
          recording_status?: string | null
          recording_url?: string | null
          room_name: string
          started_at?: string | null
          status?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          cod_agent?: string
          contact_name?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: number | null
          lead_waiting_at?: string | null
          operator_id?: number | null
          operator_joined_at?: string | null
          operator_name?: string | null
          recording_id?: string | null
          recording_status?: string | null
          recording_url?: string | null
          room_name?: string
          started_at?: string | null
          status?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      video_orders: {
        Row: {
          billing_period: string
          checkout_url: string | null
          client_id: string
          created_at: string
          customer_document: string
          customer_email: string
          customer_name: string
          customer_whatsapp: string | null
          extra_minute_packs: number
          extras_total: number
          fee_amount: number | null
          id: string
          metadata: Json | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          net_amount: number | null
          order_nsu: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_gateway: string
          plan_id: number
          plan_name: string
          plan_price: number
          provisioned_at: string | null
          provisioning_error: string | null
          recording_enabled: boolean
          recording_total: number
          setup_fee: number
          status: string
          total_amount: number
          transcription_enabled: boolean
          transcription_total: number
          updated_at: string
          user_plan_id: number | null
          webhook_payload: Json | null
        }
        Insert: {
          billing_period: string
          checkout_url?: string | null
          client_id: string
          created_at?: string
          customer_document: string
          customer_email: string
          customer_name: string
          customer_whatsapp?: string | null
          extra_minute_packs?: number
          extras_total?: number
          fee_amount?: number | null
          id?: string
          metadata?: Json | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          net_amount?: number | null
          order_nsu?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_gateway?: string
          plan_id: number
          plan_name: string
          plan_price?: number
          provisioned_at?: string | null
          provisioning_error?: string | null
          recording_enabled?: boolean
          recording_total?: number
          setup_fee?: number
          status?: string
          total_amount?: number
          transcription_enabled?: boolean
          transcription_total?: number
          updated_at?: string
          user_plan_id?: number | null
          webhook_payload?: Json | null
        }
        Update: {
          billing_period?: string
          checkout_url?: string | null
          client_id?: string
          created_at?: string
          customer_document?: string
          customer_email?: string
          customer_name?: string
          customer_whatsapp?: string | null
          extra_minute_packs?: number
          extras_total?: number
          fee_amount?: number | null
          id?: string
          metadata?: Json | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          net_amount?: number | null
          order_nsu?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_gateway?: string
          plan_id?: number
          plan_name?: string
          plan_price?: number
          provisioned_at?: string | null
          provisioning_error?: string | null
          recording_enabled?: boolean
          recording_total?: number
          setup_fee?: number
          status?: string
          total_amount?: number
          transcription_enabled?: boolean
          transcription_total?: number
          updated_at?: string
          user_plan_id?: number | null
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "video_orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "video_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      video_plans: {
        Row: {
          created_at: string
          description: string | null
          extra_minutes_pack_price: number
          extra_minutes_pack_size: number
          id: number
          included_minutes: number
          is_active: boolean
          max_concurrent_rooms: number
          name: string
          price_annual: number
          price_monthly: number
          price_quarterly: number
          price_semiannual: number
          recording_addon_price: number
          recording_included: boolean
          setup_fee_annual: number | null
          setup_fee_monthly: number | null
          setup_fee_quarterly: number | null
          setup_fee_semiannual: number | null
          slug: string | null
          sort_order: number
          transcription_addon_price: number
          transcription_included: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          extra_minutes_pack_price?: number
          extra_minutes_pack_size?: number
          id?: number
          included_minutes?: number
          is_active?: boolean
          max_concurrent_rooms?: number
          name: string
          price_annual?: number
          price_monthly?: number
          price_quarterly?: number
          price_semiannual?: number
          recording_addon_price?: number
          recording_included?: boolean
          setup_fee_annual?: number | null
          setup_fee_monthly?: number | null
          setup_fee_quarterly?: number | null
          setup_fee_semiannual?: number | null
          slug?: string | null
          sort_order?: number
          transcription_addon_price?: number
          transcription_included?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          extra_minutes_pack_price?: number
          extra_minutes_pack_size?: number
          id?: number
          included_minutes?: number
          is_active?: boolean
          max_concurrent_rooms?: number
          name?: string
          price_annual?: number
          price_monthly?: number
          price_quarterly?: number
          price_semiannual?: number
          recording_addon_price?: number
          recording_included?: boolean
          setup_fee_annual?: number | null
          setup_fee_monthly?: number | null
          setup_fee_quarterly?: number | null
          setup_fee_semiannual?: number | null
          slug?: string | null
          sort_order?: number
          transcription_addon_price?: number
          transcription_included?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      video_user_plans: {
        Row: {
          activated_at: string
          billing_period: string
          cancelled_at: string | null
          client_id: string
          created_at: string
          id: number
          max_concurrent_rooms: number
          metadata: Json | null
          minutes_quota: number
          minutes_used: number
          period_end: string
          period_start: string
          plan_id: number
          recording_enabled: boolean
          status: string
          transcription_enabled: boolean
          updated_at: string
        }
        Insert: {
          activated_at?: string
          billing_period: string
          cancelled_at?: string | null
          client_id: string
          created_at?: string
          id?: number
          max_concurrent_rooms?: number
          metadata?: Json | null
          minutes_quota?: number
          minutes_used?: number
          period_end: string
          period_start?: string
          plan_id: number
          recording_enabled?: boolean
          status?: string
          transcription_enabled?: boolean
          updated_at?: string
        }
        Update: {
          activated_at?: string
          billing_period?: string
          cancelled_at?: string | null
          client_id?: string
          created_at?: string
          id?: number
          max_concurrent_rooms?: number
          metadata?: Json | null
          minutes_quota?: number
          minutes_used?: number
          period_end?: string
          period_start?: string
          plan_id?: number
          recording_enabled?: boolean
          status?: string
          transcription_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_user_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "video_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      webchat_config: {
        Row: {
          allowed_domains: string[] | null
          auto_open_delay_seconds: number | null
          client_id: string
          cod_agent: string
          collect_email: boolean | null
          collect_name: boolean | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          offline_message: string | null
          position: string
          primary_color: string
          updated_at: string
          welcome_message: string | null
          widget_title: string
        }
        Insert: {
          allowed_domains?: string[] | null
          auto_open_delay_seconds?: number | null
          client_id: string
          cod_agent: string
          collect_email?: boolean | null
          collect_name?: boolean | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          offline_message?: string | null
          position?: string
          primary_color?: string
          updated_at?: string
          welcome_message?: string | null
          widget_title?: string
        }
        Update: {
          allowed_domains?: string[] | null
          auto_open_delay_seconds?: number | null
          client_id?: string
          cod_agent?: string
          collect_email?: boolean | null
          collect_name?: boolean | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          offline_message?: string | null
          position?: string
          primary_color?: string
          updated_at?: string
          welcome_message?: string | null
          widget_title?: string
        }
        Relationships: []
      }
      webchat_sessions: {
        Row: {
          client_id: string
          cod_agent: string
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          last_seen_at: string | null
          metadata: Json | null
          status: string
          updated_at: string
          visitor_email: string | null
          visitor_id: string
          visitor_name: string | null
        }
        Insert: {
          client_id: string
          cod_agent: string
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string | null
          metadata?: Json | null
          status?: string
          updated_at?: string
          visitor_email?: string | null
          visitor_id: string
          visitor_name?: string | null
        }
        Update: {
          client_id?: string
          cod_agent?: string
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string | null
          metadata?: Json | null
          status?: string
          updated_at?: string
          visitor_email?: string | null
          visitor_id?: string
          visitor_name?: string | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          cod_agent: string | null
          contact_id: string | null
          created_at: string
          forwarded: boolean | null
          from_number: string | null
          id: string
          message: string | null
          message_id: string | null
          message_type: string | null
          payload: Json | null
          phone_number_id: string | null
          source: string
          status_type: string | null
          waba_id: string | null
        }
        Insert: {
          cod_agent?: string | null
          contact_id?: string | null
          created_at?: string
          forwarded?: boolean | null
          from_number?: string | null
          id?: string
          message?: string | null
          message_id?: string | null
          message_type?: string | null
          payload?: Json | null
          phone_number_id?: string | null
          source?: string
          status_type?: string | null
          waba_id?: string | null
        }
        Update: {
          cod_agent?: string | null
          contact_id?: string | null
          created_at?: string
          forwarded?: boolean | null
          from_number?: string | null
          id?: string
          message?: string | null
          message_id?: string | null
          message_type?: string | null
          payload?: Json | null
          phone_number_id?: string | null
          source?: string
          status_type?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
      webhook_queue: {
        Row: {
          contacts: Json | null
          created_at: string
          error_message: string | null
          from_number: string | null
          id: string
          message_id: string | null
          message_type: string | null
          n8n_response_status: number | null
          payload: Json
          phone_number_id: string | null
          retries: number
          sent_at: string | null
          status: string
          waba_id: string | null
        }
        Insert: {
          contacts?: Json | null
          created_at?: string
          error_message?: string | null
          from_number?: string | null
          id?: string
          message_id?: string | null
          message_type?: string | null
          n8n_response_status?: number | null
          payload?: Json
          phone_number_id?: string | null
          retries?: number
          sent_at?: string | null
          status?: string
          waba_id?: string | null
        }
        Update: {
          contacts?: Json | null
          created_at?: string
          error_message?: string | null
          from_number?: string | null
          id?: string
          message_id?: string | null
          message_type?: string | null
          n8n_response_status?: number | null
          payload?: Json
          phone_number_id?: string | null
          retries?: number
          sent_at?: string | null
          status?: string
          waba_id?: string | null
        }
        Relationships: []
      }
      whatsapp_sync_job_logs: {
        Row: {
          contact_created: boolean
          created_at: string
          error: string | null
          id: string
          job_id: string
          messages_found: number
          messages_inserted: number
          phone: string
          processed_at: string | null
          status: string
        }
        Insert: {
          contact_created?: boolean
          created_at?: string
          error?: string | null
          id?: string
          job_id: string
          messages_found?: number
          messages_inserted?: number
          phone: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          contact_created?: boolean
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string
          messages_found?: number
          messages_inserted?: number
          phone?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sync_job_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sync_jobs: {
        Row: {
          agent_name: string | null
          cancel_requested: boolean
          client_id: string
          client_name: string | null
          cod_agent: string | null
          created_at: string
          created_by: string | null
          date_from: string | null
          date_to: string | null
          error: string | null
          evo_token: string | null
          evo_url: string | null
          finished_at: string | null
          id: string
          inserted_contacts: number
          inserted_messages: number
          numbers: Json
          phase: string
          processed_numbers: number
          queue_id: string | null
          queue_name: string | null
          started_at: string | null
          status: string
          total_numbers: number
          updated_at: string
        }
        Insert: {
          agent_name?: string | null
          cancel_requested?: boolean
          client_id: string
          client_name?: string | null
          cod_agent?: string | null
          created_at?: string
          created_by?: string | null
          date_from?: string | null
          date_to?: string | null
          error?: string | null
          evo_token?: string | null
          evo_url?: string | null
          finished_at?: string | null
          id?: string
          inserted_contacts?: number
          inserted_messages?: number
          numbers?: Json
          phase?: string
          processed_numbers?: number
          queue_id?: string | null
          queue_name?: string | null
          started_at?: string | null
          status?: string
          total_numbers?: number
          updated_at?: string
        }
        Update: {
          agent_name?: string | null
          cancel_requested?: boolean
          client_id?: string
          client_name?: string | null
          cod_agent?: string | null
          created_at?: string
          created_by?: string | null
          date_from?: string | null
          date_to?: string | null
          error?: string | null
          evo_token?: string | null
          evo_url?: string | null
          finished_at?: string | null
          id?: string
          inserted_contacts?: number
          inserted_messages?: number
          numbers?: Json
          phase?: string
          processed_numbers?: number
          queue_id?: string | null
          queue_name?: string | null
          started_at?: string | null
          status?: string
          total_numbers?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_queues: {
        Row: {
          channel_type: string | null
          client_id: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          channel_type?: string | null
          client_id?: string | null
          id?: string | null
          name?: string | null
        }
        Update: {
          channel_type?: string | null
          client_id?: string | null
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      uazapi_history_pending_by_client: {
        Row: {
          client_id: string | null
          client_name: string | null
          oldest_pending_at: string | null
          pending_count: number | null
        }
        Relationships: []
      }
      user_last_activity: {
        Row: {
          last_login_at: string | null
          last_logout_at: string | null
          last_logout_type: string | null
          user_id: number | null
        }
        Relationships: []
      }
      user_presence_status: {
        Row: {
          client_id: number | null
          is_away: boolean | null
          is_online: boolean | null
          last_seen_at: string | null
          seconds_since_seen: number | null
          user_id: number | null
        }
        Insert: {
          client_id?: number | null
          is_away?: never
          is_online?: never
          last_seen_at?: string | null
          seconds_since_seen?: never
          user_id?: number | null
        }
        Update: {
          client_id?: number | null
          is_away?: never
          is_online?: never
          last_seen_at?: string | null
          seconds_since_seen?: never
          user_id?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_queue_limit_from_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      clear_user_presence: { Args: { p_user_id: number }; Returns: undefined }
      get_db_cache_hit_ratio: {
        Args: never
        Returns: {
          heap_hit_ratio: number
          index_hit_ratio: number
          measured_at: string
        }[]
      }
      get_db_top_queries: {
        Args: { limit_rows?: number }
        Returns: {
          calls: number
          mean_ms: number
          query: string
          rows_total: number
          total_ms: number
        }[]
      }
      get_infra_stats: { Args: never; Returns: Json }
      get_return_chat_candidates: {
        Args: { batch_limit?: number }
        Returns: {
          assigned_to: string
          channel: string
          client_id: string
          contact_id: string
          id: string
          last_customer_message_at: string
          nrt_minutes: number
          priority: string
          queue_id: string
          tolerance_minutes: number
        }[]
      }
      get_return_chat_run_stats: {
        Args: never
        Returns: {
          avg_rpc_ms: number
          avg_total_ms: number
          candidates: number
          errors: number
          max_rpc_ms: number
          max_total_ms: number
          p50_rpc_ms: number
          p50_total_ms: number
          p95_rpc_ms: number
          p95_total_ms: number
          processed: number
          runs: number
          window_label: string
        }[]
      }
      get_task_ranking: {
        Args: { p_client_id: string; p_since?: string }
        Returns: {
          total_points: number
          user_id: string
          user_name: string
        }[]
      }
      increment_contact_unread: {
        Args: { p_contact_id: string; p_last_at?: string; p_preview?: string }
        Returns: undefined
      }
      map_priority_chat_to_crm: { Args: { p: string }; Returns: string }
      map_priority_crm_to_chat: { Args: { p: string }; Returns: string }
      merge_duplicate_chat_contacts: {
        Args: { p_limit?: number }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      touch_user_presence: {
        Args: { p_client_id: number; p_user_id: number }
        Returns: string
      }
      uazapi_pick_pending_items: {
        Args: { p_limit?: number; p_worker_id: number }
        Returns: {
          attempts: number
          id: string
          payload: Json
          phone: string
          remote_jid: string
          run_id: string
        }[]
      }
      uazapi_release_stale_locks: { Args: never; Returns: number }
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
    Enums: {},
  },
} as const
