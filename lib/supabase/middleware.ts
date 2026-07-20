import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";

export async function updateSession(request: NextRequest) {
  const env = getSupabaseBrowserEnv();
  let response = NextResponse.next({ request });

  if (!env.isConfigured) {
    return response;
  }

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}
