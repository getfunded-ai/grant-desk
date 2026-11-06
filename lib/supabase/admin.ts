import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

/**
 * Service-key client. It bypasses row-level security, so call it only from a server action or route
 * handler after checking who the caller is and what they may do. Returns null when not configured.
 */
export function createAdminClient() {
  const env = getSupabasePublicEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!env || !secretKey) return null;
  return createClient(env.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
