import type { Food, Utensil, Calibration } from "@/lib/library/model";
import type { StoredMeal, StoredMealItem, QuickItem } from "@/lib/nutrition/quick-meal";
import type { PhotoDraft, ReviewedItem } from "@/lib/nutrition/photo-model";
type NullableNumber = number | null;
type LibraryTable<T extends { id: string; created_at: string }> = { Row: T; Insert: Omit<T, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<Omit<T, "id" | "created_at">>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      photo_drafts: { Row: PhotoDraft; Insert: never; Update: Partial<Pick<PhotoDraft, "status" | "result">>; Relationships: [] };
      meals: LibraryTable<StoredMeal>;
      meal_items: LibraryTable<StoredMealItem>;
      foods: LibraryTable<Food>;
      utensils: LibraryTable<Utensil>;
      utensil_food_profiles: { Row: Calibration; Insert: Calibration; Update: Partial<Calibration>; Relationships: [] };
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
    Functions: {
      claim_photo_analysis: { Args: { p_id: string; p_model: string; p_references: string[] }; Returns: boolean };
      save_photo_meal: { Args: { p_draft_id: string; p_meal_type: string; p_items: ReviewedItem[] }; Returns: string };
      save_quick_meal: { Args: { p_request_id: string; p_meal_type: string; p_items: QuickItem[] }; Returns: string };
      save_user_settings: { Args: { p_calories: number; p_protein: number; p_carbs: NullableNumber; p_fat: NullableNumber; p_budget: number; p_timezone: string }; Returns: undefined }
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
