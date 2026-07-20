import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";

export function createClient() {
  const env = getSupabaseBrowserEnv();

  if (!env.isConfigured) {
    throw new Error(env.error);
  }

  return createBrowserClient<Database>(env.url, env.anonKey);
}
