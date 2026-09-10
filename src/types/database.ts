export type Database = {
  public: {
    Tables: {
      users: {
        Row: { id: string; email: string; name: string | null; avatar_url: string | null; timezone: string; created_at: string; updated_at: string };
        Insert: { id: string; email: string; name?: string | null; avatar_url?: string | null; timezone?: string; created_at?: string; updated_at?: string };
        Update: { email?: string; name?: string | null; avatar_url?: string | null; timezone?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
