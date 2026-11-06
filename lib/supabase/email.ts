import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

/**
 * A client that only asks Supabase to email someone else a sign-in link (for example a teammate
 * invited by the signed-in person). It keeps no session and uses the link format that works in any
 * browser, because the link is opened by the recipient, not by whoever asked for it.
 */
export function createEmailClient() {
  const env = getSupabasePublicEnv();
  if (!env) return null;
  return createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
  });
}
