type NullableNumber = number | null;

export type Database = {
  public: {
    Tables: {
      users: {
        Row: { id: string; email: string; name: string | null; timezone: string; created_at: string };
        Insert: { id: string; email: string; name?: string | null; timezone?: string; created_at?: string };
        Update: { email?: string; name?: string | null; timezone?: string };
        Relationships: [];
      };
      user_settings: {
        Row: { user_id: string; daily_calorie_goal: NullableNumber; daily_protein_goal: NullableNumber; daily_carbs_goal: NullableNumber; daily_fat_goal: NullableNumber; monthly_spending_budget: NullableNumber; timezone: string; created_at: string; updated_at: string; onboarding_completed_at: string | null };
        Insert: { user_id: string; daily_calorie_goal?: NullableNumber; daily_protein_goal?: NullableNumber; daily_carbs_goal?: NullableNumber; daily_fat_goal?: NullableNumber; monthly_spending_budget?: NullableNumber; timezone?: string; created_at?: string; updated_at?: string };
        Update: { daily_calorie_goal?: NullableNumber; daily_protein_goal?: NullableNumber; daily_carbs_goal?: NullableNumber; daily_fat_goal?: NullableNumber; monthly_spending_budget?: NullableNumber; timezone?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: { save_user_settings: { Args: { p_calories: number; p_protein: number; p_carbs: NullableNumber; p_fat: NullableNumber; p_budget: number; p_timezone: string }; Returns: undefined } };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
