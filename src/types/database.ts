import type { Food, Utensil, Calibration } from "@/lib/library/model";
import type { StoredMeal, StoredMealItem, QuickItem } from "@/lib/nutrition/quick-meal";
import type { PhotoDraft, ReviewedItem } from "@/lib/nutrition/photo-model";
import type { Sender } from "@/lib/gmail/core";
import type { Candidate, Transaction, MerchantRule } from "@/lib/spending/model";
import type { Account, Member, Draft, Entry, ParsedStatement, ReviewChoice } from "@/lib/statements/model";
type NullableNumber = number | null;
type LibraryTable<T extends { id: string; created_at: string }> = { Row: T; Insert: Omit<T, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<Omit<T, "id" | "created_at">>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      spending_households: { Row: { id: string; owner_id: string; created_at: string }; Insert: never; Update: never; Relationships: [] };
      spending_members: { Row: Member; Insert: never; Update: never; Relationships: [] };
      spending_invites: { Row: { household_id: string; email: string; expires_at: string }; Insert: never; Update: never; Relationships: [] };
      spending_accounts: { Row: Account; Insert: never; Update: never; Relationships: [] };
      statement_drafts: { Row: Draft; Insert: never; Update: never; Relationships: [] };
      statement_entries: { Row: Entry; Insert: never; Update: never; Relationships: [] };
      statement_imports: { Row: { id: string; household_id: string; account_id: string; file_hash: string; period_start: string | null; period_end: string | null; imported_by: string; created_at: string }; Insert: never; Update: never; Relationships: [] };
      transactions: { Row: Transaction; Insert: never; Update: never; Relationships: [] };
      merchant_rules: { Row: MerchantRule & { user_id: string; source_mode: "fixture"; updated_at: string }; Insert: never; Update: never; Relationships: [] };
      financial_senders: { Row: Sender; Insert: never; Update: never; Relationships: [] };
      gmail_connections: { Row: { user_id: string; id: string; email: string; created_at: string }; Insert: never; Update: never; Relationships: [] };
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
      manage_spending_household: { Args: { p_operation: string; p_value: string }; Returns: string };
      add_spending_account: { Args: { p_label: string; p_format: string; p_last_four: string; p_owner: string }; Returns: string };
      stage_statement_files: { Args: { p_files: ParsedStatement[] }; Returns: string };
      discard_statement_draft: { Args: { p_id: string }; Returns: undefined };
      confirm_statement_draft: { Args: { p_id: string; p_choices: ReviewChoice[] }; Returns: number };
      correct_statement_entry: { Args: { p_id: string; p_revision: number; p_merchant: string; p_kind: string; p_category: string }; Returns: undefined };
      import_fixture_transactions: { Args: { p_items: Candidate[] }; Returns: number };
      correct_fixture_transaction: { Args: { p_id: string; p_revision: number; p_merchant: string; p_category: string; p_time: string; p_account: string; p_description: string; p_save_rule: boolean }; Returns: undefined };
      remove_fixture_rule: { Args: { p_key: string }; Returns: undefined };
      save_financial_sender: { Args: { p_id: string | null; p_email: string; p_name: string; p_institution: string; p_enabled: boolean }; Returns: undefined };
      remove_financial_sender: { Args: { p_id: string }; Returns: undefined };
      connect_gmail: { Args: { p_email: string; p_ciphertext: string }; Returns: undefined };
      claim_gmail_check: { Args: Record<string, never>; Returns: string };
      disconnect_gmail: { Args: { p_id: string }; Returns: string | null };
      claim_photo_analysis: { Args: { p_id: string; p_model: string; p_references: string[] }; Returns: boolean };
      save_photo_meal: { Args: { p_draft_id: string; p_meal_type: string; p_items: ReviewedItem[] }; Returns: string };
      save_quick_meal: { Args: { p_request_id: string; p_meal_type: string; p_items: QuickItem[] }; Returns: string };
      save_user_settings: { Args: { p_calories: number; p_protein: number; p_carbs: NullableNumber; p_fat: NullableNumber; p_budget: number; p_timezone: string }; Returns: undefined }
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
