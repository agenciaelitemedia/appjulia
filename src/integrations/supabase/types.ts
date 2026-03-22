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
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          avatar?: string | null
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
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar?: string | null
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
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          caption: string | null
          client_id: string
          contact_id: string
          created_at: string | null
          file_name: string | null
          from_me: boolean | null
          id: string
          media_url: string | null
          message_id: string | null
          metadata: Json | null
          reply_to: string | null
          status: string | null
          text: string | null
          timestamp: string | null
          type: string | null
        }
        Insert: {
          caption?: string | null
          client_id: string
          contact_id: string
          created_at?: string | null
          file_name?: string | null
          from_me?: boolean | null
          id?: string
          media_url?: string | null
          message_id?: string | null
          metadata?: Json | null
          reply_to?: string | null
          status?: string | null
          text?: string | null
          timestamp?: string | null
          type?: string | null
        }
        Update: {
          caption?: string | null
          client_id?: string
          contact_id?: string
          created_at?: string | null
          file_name?: string | null
          from_me?: boolean | null
          id?: string
          media_url?: string | null
          message_id?: string | null
          metadata?: Json | null
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
          updated_at: string
        }
        Insert: {
          api4com_domain: string
          api4com_token: string
          cod_agent: string
          created_at?: string
          id?: number
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          api4com_domain?: string
          api4com_token?: string
          cod_agent?: string
          created_at?: string
          id?: number
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      phone_extension_plans: {
        Row: {
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          max_extensions: number
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          max_extensions?: number
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          max_extensions?: number
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      phone_extensions: {
        Row: {
          api4com_id: string | null
          assigned_member_id: number | null
          cod_agent: string
          created_at: string
          extension_number: string
          id: number
          is_active: boolean
          label: string | null
          updated_at: string
        }
        Insert: {
          api4com_id?: string | null
          assigned_member_id?: number | null
          cod_agent: string
          created_at?: string
          extension_number: string
          id?: number
          is_active?: boolean
          label?: string | null
          updated_at?: string
        }
        Update: {
          api4com_id?: string | null
          assigned_member_id?: number | null
          cod_agent?: string
          created_at?: string
          extension_number?: string
          id?: number
          is_active?: boolean
          label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      phone_user_plans: {
        Row: {
          assigned_at: string
          cod_agent: string
          id: number
          is_active: boolean
          plan_id: number
        }
        Insert: {
          assigned_at?: string
          cod_agent: string
          id?: number
          is_active?: boolean
          plan_id: number
        }
        Update: {
          assigned_at?: string
          cod_agent?: string
          id?: number
          is_active?: boolean
          plan_id?: number
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
