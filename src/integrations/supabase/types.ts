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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      attendance: {
        Row: {
          clock_in: string | null
          clock_in_location: Json | null
          clock_out: string | null
          clock_out_location: Json | null
          corrected_at: string | null
          corrected_by: Json | null
          created_at: string
          date: string
          early_minutes: number
          id: string
          late_minutes: number
          login_status: string | null
          logout_status: string | null
          marked_by: Json | null
          note: string
          required_minutes: number | null
          staff_id: string
          status: string | null
          updated_at: string
          worked_minutes: number | null
          working_hours_diff: number | null
        }
        Insert: {
          clock_in?: string | null
          clock_in_location?: Json | null
          clock_out?: string | null
          clock_out_location?: Json | null
          corrected_at?: string | null
          corrected_by?: Json | null
          created_at?: string
          date: string
          early_minutes?: number
          id: string
          late_minutes?: number
          login_status?: string | null
          logout_status?: string | null
          marked_by?: Json | null
          note?: string
          required_minutes?: number | null
          staff_id: string
          status?: string | null
          updated_at?: string
          worked_minutes?: number | null
          working_hours_diff?: number | null
        }
        Update: {
          clock_in?: string | null
          clock_in_location?: Json | null
          clock_out?: string | null
          clock_out_location?: Json | null
          corrected_at?: string | null
          corrected_by?: Json | null
          created_at?: string
          date?: string
          early_minutes?: number
          id?: string
          late_minutes?: number
          login_status?: string | null
          logout_status?: string | null
          marked_by?: Json | null
          note?: string
          required_minutes?: number | null
          staff_id?: string
          status?: string | null
          updated_at?: string
          worked_minutes?: number | null
          working_hours_diff?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          description: string
          id: string
          name: string
          recurring: boolean
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string
          id: string
          name: string
          recurring?: boolean
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string
          id?: string
          name?: string
          recurring?: boolean
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_reasons: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_types: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          paid: boolean
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id: string
          name: string
          paid?: boolean
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          paid?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      leaves: {
        Row: {
          admin_note: string
          created_at: string
          days: number
          decided_at: string | null
          decided_by: Json | null
          from_date: string
          id: string
          reason: string
          requested_at: string
          requested_by: Json | null
          staff_id: string
          status: string
          to_date: string
          type: string
          updated_at: string
        }
        Insert: {
          admin_note?: string
          created_at?: string
          days?: number
          decided_at?: string | null
          decided_by?: Json | null
          from_date: string
          id: string
          reason?: string
          requested_at?: string
          requested_by?: Json | null
          staff_id: string
          status?: string
          to_date: string
          type?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string
          created_at?: string
          days?: number
          decided_at?: string | null
          decided_by?: Json | null
          from_date?: string
          id?: string
          reason?: string
          requested_at?: string
          requested_by?: Json | null
          staff_id?: string
          status?: string
          to_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      login_events: {
        Row: {
          at: string
          closed_at: string | null
          created_at: string
          department: string | null
          device: Json | null
          duration_minutes: number | null
          id: string
          location: Json | null
          logout_event_id: string | null
          reason: string | null
          role: string | null
          type: string
          user_id: string | null
          user_login_id: string | null
          user_name: string | null
        }
        Insert: {
          at?: string
          closed_at?: string | null
          created_at?: string
          department?: string | null
          device?: Json | null
          duration_minutes?: number | null
          id: string
          location?: Json | null
          logout_event_id?: string | null
          reason?: string | null
          role?: string | null
          type: string
          user_id?: string | null
          user_login_id?: string | null
          user_name?: string | null
        }
        Update: {
          at?: string
          closed_at?: string | null
          created_at?: string
          department?: string | null
          device?: Json | null
          duration_minutes?: number | null
          id?: string
          location?: Json | null
          logout_event_id?: string | null
          reason?: string | null
          role?: string | null
          type?: string
          user_id?: string | null
          user_login_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          auth_user_id: string | null
          avatar_color: string | null
          birth_date: string | null
          created_at: string
          department: string | null
          email: string | null
          id: string
          join_date: string | null
          login_id: string | null
          name: string
          phone: string | null
          role: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_color?: string | null
          birth_date?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          id: string
          join_date?: string | null
          login_id?: string | null
          name: string
          phone?: string | null
          role?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_color?: string | null
          birth_date?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          join_date?: string | null
          login_id?: string | null
          name?: string
          phone?: string | null
          role?: string | null
          status?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      my_staff_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
