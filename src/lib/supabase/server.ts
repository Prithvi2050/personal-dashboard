import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig, requireSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export async function createClient() {
  return createClientWithConfig(requireSupabaseConfig());
}

export async function createOptionalClient() {
  const config = getSupabaseConfig();
  return config ? createClientWithConfig(config) : null;
}

async function createClientWithConfig(config: { url: string; publishableKey: string }) {
  const cookieStore = await cookies();
  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; src/proxy.ts refreshes them.
        }
      },
    },
  });
}
