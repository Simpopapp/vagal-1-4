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
      cards: {
        Row: {
          card: Json
          generated_at: number
          headword: string
          user_id: string
          word_id: string
        }
        Insert: {
          card: Json
          generated_at: number
          headword: string
          user_id: string
          word_id: string
        }
        Update: {
          card?: Json
          generated_at?: number
          headword?: string
          user_id?: string
          word_id?: string
        }
        Relationships: []
      }
      dossiers: {
        Row: {
          dossier: Json
          generated_at: number
          headword: string
          user_id: string
          word_id: string
        }
        Insert: {
          dossier: Json
          generated_at: number
          headword: string
          user_id: string
          word_id: string
        }
        Update: {
          dossier?: Json
          generated_at?: number
          headword?: string
          user_id?: string
          word_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          correct: boolean
          due_at: number
          id: string
          kind: string
          lapse_count: number
          reviewed_at: number
          user_id: string
          word_id: string
        }
        Insert: {
          correct: boolean
          due_at: number
          id?: string
          kind: string
          lapse_count: number
          reviewed_at: number
          user_id: string
          word_id: string
        }
        Update: {
          correct?: boolean
          due_at?: number
          id?: string
          kind?: string
          lapse_count?: number
          reviewed_at?: number
          user_id?: string
          word_id?: string
        }
        Relationships: []
      }
      senses: {
        Row: {
          created_at: number
          headword: string
          id: string
          line: string
          line_index: number
          song_id: string
          stanza_index: number
          surface_form: string
          user_id: string
          word_id: string
        }
        Insert: {
          created_at: number
          headword: string
          id?: string
          line: string
          line_index: number
          song_id: string
          stanza_index: number
          surface_form: string
          user_id: string
          word_id: string
        }
        Update: {
          created_at?: number
          headword?: string
          id?: string
          line?: string
          line_index?: number
          song_id?: string
          stanza_index?: number
          surface_form?: string
          user_id?: string
          word_id?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          added_at: number
          artist: string
          id: string
          language: string
          lyrics: string
          source_url: string
          title: string
          user_id: string
        }
        Insert: {
          added_at: number
          artist: string
          id?: string
          language: string
          lyrics: string
          source_url: string
          title: string
          user_id: string
        }
        Update: {
          added_at?: number
          artist?: string
          id?: string
          language?: string
          lyrics?: string
          source_url?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          key: string
          user_id: string
          value: Json
        }
        Insert: {
          key: string
          user_id: string
          value: Json
        }
        Update: {
          key?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      words: {
        Row: {
          favorite: boolean
          first_seen_at: number
          headword: string
          id: string
          language: string
          last_seen_at: number
          level: string
          stage: string
          status: string
          surface_form: string
          user_id: string
        }
        Insert: {
          favorite?: boolean
          first_seen_at: number
          headword: string
          id?: string
          language: string
          last_seen_at: number
          level: string
          stage: string
          status: string
          surface_form: string
          user_id: string
        }
        Update: {
          favorite?: boolean
          first_seen_at?: number
          headword?: string
          id?: string
          language?: string
          last_seen_at?: number
          level?: string
          stage?: string
          status?: string
          surface_form?: string
          user_id?: string
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
