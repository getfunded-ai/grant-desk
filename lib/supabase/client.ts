import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";

/** Browser client. Uses only the publishable key; row-level security decides what it can read. */
export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env)
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  return createBrowserClient(env.url, env.publishableKey);
}
