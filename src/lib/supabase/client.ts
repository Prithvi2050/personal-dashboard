"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient(url: string, publishableKey: string) {
  return createBrowserClient<Database>(url, publishableKey);
}
