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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          check_in_at: string | null
          check_out_at: string | null
          created_at: string
          hours_to_check_in: number | null
          id: string
          room_id: string
        }
        Insert: {
          check_in_at?: string | null
          check_out_at?: string | null
          created_at?: string
          hours_to_check_in?: number | null
          id?: string
          room_id: string
        }
        Update: {
          check_in_at?: string | null
          check_out_at?: string | null
          created_at?: string
          hours_to_check_in?: number | null
          id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          slug: string
          timezone: string | null
          total_levels: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          slug: string
          timezone?: string | null
          total_levels?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          slug?: string
          timezone?: string | null
          total_levels?: number | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          computed_at: string
          confidence: number
          confidence_tier: string
          detail_json: Json | null
          explanation_text: string | null
          id: string
          recommended_setpoint: number
          recovery_minutes: number
          room_id: string
          savings_estimate: number
        }
        Insert: {
          computed_at?: string
          confidence?: number
          confidence_tier: string
          detail_json?: Json | null
          explanation_text?: string | null
          id?: string
          recommended_setpoint: number
          recovery_minutes: number
          room_id: string
          savings_estimate: number
        }
        Update: {
          computed_at?: string
          confidence?: number
          confidence_tier?: string
          detail_json?: Json | null
          explanation_text?: string | null
          id?: string
          recommended_setpoint?: number
          recovery_minutes?: number
          room_id?: string
          savings_estimate?: number
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_facades: {
        Row: {
          compass_bearing_deg: number
          id: string
          room_id: string
          wall_area_m2: number
          wall_id: string | null
          window_area_m2: number
        }
        Insert: {
          compass_bearing_deg: number
          id?: string
          room_id: string
          wall_area_m2?: number
          wall_id?: string | null
          window_area_m2?: number
        }
        Update: {
          compass_bearing_deg?: number
          id?: string
          room_id?: string
          wall_area_m2?: number
          wall_id?: string | null
          window_area_m2?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_facades_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          ceiling_height_m: number
          created_at: string
          floor_number: number
          footprint_area_m2: number | null
          id: string
          label: string
          property_id: string
          raw_scan_json: Json | null
          source_file: string | null
        }
        Insert: {
          ceiling_height_m?: number
          created_at?: string
          floor_number?: number
          footprint_area_m2?: number | null
          id?: string
          label: string
          property_id: string
          raw_scan_json?: Json | null
          source_file?: string | null
        }
        Update: {
          ceiling_height_m?: number
          created_at?: string
          floor_number?: number
          footprint_area_m2?: number | null
          id?: string
          label?: string
          property_id?: string
          raw_scan_json?: Json | null
          source_file?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_cache: {
        Row: {
          facade_bearing_deg: number
          fetched_at: string
          hourly_json: Json
          id: string
          property_id: string
          tilt_deg: number
        }
        Insert: {
          facade_bearing_deg: number
          fetched_at?: string
          hourly_json: Json
          id?: string
          property_id: string
          tilt_deg?: number
        }
        Update: {
          facade_bearing_deg?: number
          fetched_at?: string
          hourly_json?: Json
          id?: string
          property_id?: string
          tilt_deg?: number
        }
        Relationships: [
          {
            foreignKeyName: "solar_cache_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_cache: {
        Row: {
          fetched_at: string
          hourly_json: Json
          id: string
          property_id: string
        }
        Insert: {
          fetched_at?: string
          hourly_json: Json
          id?: string
          property_id: string
        }
        Update: {
          fetched_at?: string
          hourly_json?: Json
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weather_cache_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
