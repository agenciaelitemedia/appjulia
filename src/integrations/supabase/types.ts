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
