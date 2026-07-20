import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseServerEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";

export async function createClient() {
  const { url, anonKey } = requireSupabaseServerEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; middleware handles refresh writes.
        }
      },
    },
  });
}
