export function getSupabaseBrowserEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      isConfigured: false as const,
      error: "لم يتم إعداد Supabase بعد. أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY داخل .env.local.",
      url: "",
      anonKey: "",
    };
  }

  return {
    isConfigured: true as const,
    error: null,
    url,
    anonKey,
  };
}

export function requireSupabaseServerEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
  }

  return { url, anonKey };
}
