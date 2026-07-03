import { createClient } from "@supabase/supabase-js";

export function createSupabaseClient() {
  const url = import.meta.env.SUPABASE_URL;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_ANON_KEY. Add them to the repo root .env (see .env.example).",
    );
  }

  return createClient(url, anonKey);
}
