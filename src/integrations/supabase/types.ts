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
      chat_contacts: {
        Row: {
          avatar: string | null
          channel_source: string | null
          channel_type: string
          client_id: string
          cod_agent: string | null
          created_at: string | null
          id: string
          is_archived: boolean | null
          is_group: boolean | null
          is_muted: boolean | null
          last_message_at: string | null
          last_message_text: string | null
          name: string
          phone: string
          remote_jid: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          avatar?: string | null
          channel_source?: string | null
          channel_type?: string
          client_id: string
          cod_agent?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_group?: boolean | null
          is_muted?: boolean | null
          last_message_at?: string | null
          last_message_text?: string | null
          name: string
          phone: string
          remote_jid?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar?: string | null
          channel_source?: string | null
          channel_type?: string
          client_id?: string
          cod_agent?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_group?: boolean | null
          is_muted?: boolean | null
          last_message_at?: string | null
          last_message_text?: string | null
          name?: string
          phone?: string
          remote_jid?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          caption: string | null
          channel_type: string
          client_id: string
          contact_id: string
          created_at: string | null
          external_id: string | null
          file_name: string | null
          forwarded_score: number | null
          from_me: boolean | null
          id: string
          is_forwarded: boolean | null
          media_url: string | null
          message_id: string | null
          metadata: Json | null
          raw_payload: Json | null
          reply_to: string | null
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
          created_at?: string | null
          external_id?: string | null
          file_name?: string | null
          forwarded_score?: number | null
          from_me?: boolean | null
          id?: string
          is_forwarded?: boolean | null
          media_url?: string | null
          message_id?: string | null
          metadata?: Json | null
          raw_payload?: Json | null
          reply_to?: string | null
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
          created_at?: string | null
          external_id?: string | null
          file_name?: string | null
          forwarded_score?: number | null
          from_me?: boolean | null
          id?: string
          is_forwarded?: boolean | null
          media_url?: string | null
          message_id?: string | null
          metadata?: Json | null
          raw_payload?: Json | null
          reply_to?: string | null
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
        ]
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
          cod_agent: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          custom_fields: Json | null
          description: string | null
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
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          board_id: string
          cod_agent: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          custom_fields?: Json | null
          description?: string | null
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
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          board_id?: string
          cod_agent?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          custom_fields?: Json | null
          description?: string | null
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
      crm_pipelines: {
        Row: {
          board_id: string
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
      julia_orders: {
        Row: {
          billing_period: string | null
          checkout_url: string | null
          cod_agent: string | null
          created_at: string
          customer_address: string
          customer_document: string
          customer_email: string
          customer_name: string
          customer_whatsapp: string
          id: string
          infinitypay_transaction_nsu: string | null
          installments: number | null
          notes: string | null
          order_nsu: string | null
          paid_amount: number | null
          paid_at: string | null
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
          created_at?: string
          customer_address?: string
          customer_document: string
          customer_email?: string
          customer_name: string
          customer_whatsapp?: string
          id?: string
          infinitypay_transaction_nsu?: string | null
          installments?: number | null
          notes?: string | null
          order_nsu?: string | null
          paid_amount?: number | null
          paid_at?: string | null
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
          created_at?: string
          customer_address?: string
          customer_document?: string
          customer_email?: string
          customer_name?: string
          customer_whatsapp?: string
          id?: string
          infinitypay_transaction_nsu?: string | null
          installments?: number | null
          notes?: string | null
          order_nsu?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          plan_name?: string
          plan_price?: number
          receipt_url?: string | null
          status?: string
          updated_at?: string
          webhook_payload?: Json | null
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
      phone_call_logs: {
        Row: {
          answered_at: string | null
          call_id: string | null
          called: string | null
          caller: string | null
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
          api4com_domain: string
          api4com_token: string
          cod_agent: string
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
          api4com_domain: string
          api4com_token: string
          cod_agent: string
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
          api4com_domain?: string
          api4com_token?: string
          cod_agent?: string
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
          cod_agent: string
          created_at: string
          extension_number: string
          id: number
          is_active: boolean
          label: string | null
          provider: string
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
          cod_agent: string
          created_at?: string
          extension_number: string
          id?: number
          is_active?: boolean
          label?: string | null
          provider?: string
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
          cod_agent?: string
          created_at?: string
          extension_number?: string
          id?: number
          is_active?: boolean
          label?: string | null
          provider?: string
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
          client_name: string | null
          cod_agent: string
          due_date: string | null
          extra_extensions: number
          id: number
          is_active: boolean
          plan_id: number
          start_date: string
        }
        Insert: {
          assigned_at?: string
          billing_period?: string
          business_name?: string | null
          client_name?: string | null
          cod_agent: string
          due_date?: string | null
          extra_extensions?: number
          id?: number
          is_active?: boolean
          plan_id: number
          start_date?: string
        }
        Update: {
          assigned_at?: string
          billing_period?: string
          business_name?: string | null
          client_name?: string | null
          cod_agent?: string
          due_date?: string | null
          extra_extensions?: number
          id?: number
          is_active?: boolean
          plan_id?: number
          start_date?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
