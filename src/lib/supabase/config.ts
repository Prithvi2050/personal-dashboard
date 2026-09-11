export const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
export const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
export const DEFAULT_TIMEZONE_ENV = "DEFAULT_TIMEZONE";
export const FALLBACK_TIMEZONE = "Asia/Kolkata";

export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

export function getMissingSupabaseEnv(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const missing: string[] = [];
  if (!env[SUPABASE_URL_ENV]?.trim()) missing.push(SUPABASE_URL_ENV);
  if (!env[SUPABASE_PUBLISHABLE_KEY_ENV]?.trim()) {
    missing.push(SUPABASE_PUBLISHABLE_KEY_ENV);
  }
  return missing;
}

export function getSupabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseConfig | null {
  const missing = getMissingSupabaseEnv(env);
  if (missing.length > 0) return null;

  return {
    url: env[SUPABASE_URL_ENV]!.trim(),
    publishableKey: env[SUPABASE_PUBLISHABLE_KEY_ENV]!.trim(),
  };
}

export function requireSupabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseConfig {
  const missing = getMissingSupabaseEnv(env);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Add them to .env.local. See docs/setup/supabase.md.`,
    );
  }

  return getSupabaseConfig(env)!;
}

export function getDefaultTimezone(env: NodeJS.ProcessEnv = process.env): string {
  return env[DEFAULT_TIMEZONE_ENV]?.trim() || FALLBACK_TIMEZONE;
}
