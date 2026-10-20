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
      admin_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: number
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target_id?: string | null
        }
        Relationships: []
      }
      admin_seeds: {
        Row: {
          claimed_at: string | null
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          claimed_at?: string | null
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          claimed_at?: string | null
          email?: string
          full_name?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          id: number
          ip: string
          kind: string
          success: boolean
        }
        Insert: {
          created_at?: string
          id?: number
          ip: string
          kind: string
          success: boolean
        }
        Update: {
          created_at?: string
          id?: number
          ip?: string
          kind?: string
          success?: boolean
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          approval: boolean
          assignment: boolean
          changes: boolean
          due: boolean
          safety: boolean
          user_id: string
        }
        Insert: {
          approval?: boolean
          assignment?: boolean
          changes?: boolean
          due?: boolean
          safety?: boolean
          user_id?: string
        }
        Update: {
          approval?: boolean
          assignment?: boolean
          changes?: boolean
          due?: boolean
          safety?: boolean
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          dedup_key: string
          id: string
          kind: string
          read_at: string | null
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedup_key: string
          id?: string
          kind: string
          read_at?: string | null
          task_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedup_key?: string
          id?: string
          kind?: string
          read_at?: string | null
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          code_hash: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          active?: boolean
          code_hash?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
        }
        Update: {
          active?: boolean
          code_hash?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          task_id: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_decisions: {
        Row: {
          approved_amount: number | null
          body: string
          created_at: string
          id: string
          next_status: Database["public"]["Enums"]["task_status"]
          outcome: string
          request_key: string
          task_id: string
          user_id: string
        }
        Insert: {
          approved_amount?: number | null
          body: string
          created_at?: string
          id?: string
          next_status: Database["public"]["Enums"]["task_status"]
          outcome: string
          request_key: string
          task_id: string
          user_id?: string
        }
        Update: {
          approved_amount?: number | null
          body?: string
          created_at?: string
          id?: string
          next_status?: Database["public"]["Enums"]["task_status"]
          outcome?: string
          request_key?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_decisions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          path: string
          size: number | null
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          path: string
          size?: number | null
          task_id: string
          uploaded_by?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          path?: string
          size?: number | null
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          action: string
          created_at: string
          field: string | null
          id: number
          new_value: string | null
          old_value: string | null
          task_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          field?: string | null
          id?: number
          new_value?: string | null
          old_value?: string | null
          task_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          field?: string | null
          id?: number
          new_value?: string | null
          old_value?: string | null
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived: boolean
          assignee_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          delay_impact: string | null
          delay_reason: string | null
          description: string | null
          due_date: string | null
          equipment_disabled: boolean
          explicit_status: boolean
          external_party: string | null
          id: string
          is_safety: boolean
          location: string | null
          next_step: string | null
          number: number
          parent_id: string | null
          related_task_id: string | null
          repair_notes: string | null
          request_key: string | null
          requested_amount: number | null
          safety_check: string | null
          safety_checked_at: string | null
          safety_checked_by: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          updated_by: string | null
          urgency: Database["public"]["Enums"]["task_urgency"]
          waiting_since: string | null
        }
        Insert: {
          archived?: boolean
          assignee_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          delay_impact?: string | null
          delay_reason?: string | null
          description?: string | null
          due_date?: string | null
          equipment_disabled?: boolean
          explicit_status?: boolean
          external_party?: string | null
          id?: string
          is_safety?: boolean
          location?: string | null
          next_step?: string | null
          number?: never
          parent_id?: string | null
          related_task_id?: string | null
          repair_notes?: string | null
          request_key?: string | null
          requested_amount?: number | null
          safety_check?: string | null
          safety_checked_at?: string | null
          safety_checked_by?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          updated_by?: string | null
          urgency?: Database["public"]["Enums"]["task_urgency"]
          waiting_since?: string | null
        }
        Update: {
          archived?: boolean
          assignee_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          delay_impact?: string | null
          delay_reason?: string | null
          description?: string | null
          due_date?: string | null
          equipment_disabled?: boolean
          explicit_status?: boolean
          external_party?: string | null
          id?: string
          is_safety?: boolean
          location?: string | null
          next_step?: string | null
          number?: never
          parent_id?: string | null
          related_task_id?: string | null
          repair_notes?: string | null
          request_key?: string | null
          requested_amount?: number | null
          safety_check?: string | null
          safety_checked_at?: string | null
          safety_checked_by?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          updated_by?: string | null
          urgency?: Database["public"]["Enums"]["task_urgency"]
          waiting_since?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_safety_checked_by_fkey"
            columns: ["safety_checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_save_user: {
        Args: {
          _active: boolean
          _actor: string
          _email: string
          _hash?: string
          _id: string
          _name: string
          _phone: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_waiting: {
        Args: { s: Database["public"]["Enums"]["task_status"] }
        Returns: boolean
      }
      record_decision: {
        Args: {
          _amount: number
          _body: string
          _expected: string
          _key: string
          _next: Database["public"]["Enums"]["task_status"]
          _outcome: string
          _task: string
        }
        Returns: string
      }
      refresh_due_notifications: { Args: never; Returns: undefined }
      submit_report: {
        Args: { _description: string; _title: string }
        Returns: {
          id: string
          number: number
        }[]
      }
      submit_report_once: {
        Args: { _description: string; _key: string; _title: string }
        Returns: {
          id: string
          number: number
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "staff" | "user"
      task_status:
        | "new"
        | "in_progress"
        | "waiting_decision"
        | "waiting_approval"
        | "waiting_external"
        | "paused"
        | "done_pending_close"
        | "closed"
        | "recurring_fault"
        | "cancelled"
        | "approved"
      task_type: "task" | "fault" | "request" | "decision"
      task_urgency: "normal" | "high" | "critical"
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
      app_role: ["super_admin", "staff", "user"],
      task_status: [
        "new",
        "in_progress",
        "waiting_decision",
        "waiting_approval",
        "waiting_external",
        "paused",
        "done_pending_close",
        "closed",
        "recurring_fault",
        "cancelled",
        "approved",
      ],
      task_type: ["task", "fault", "request", "decision"],
      task_urgency: ["normal", "high", "critical"],
    },
  },
} as const
