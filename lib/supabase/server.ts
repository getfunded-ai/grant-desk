import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSupabasePublicEnv } from "./env";

/**
 * Server client acting as the signed-in user (publishable key + session cookie), so row-level
 * security applies. Returns null when Supabase is not configured.
 */
export async function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) return null;
  // Request-time only: the auth client reads the clock, which Cache Components forbids while prerendering.
  await connection();
  const cookieStore = await cookies();
  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the session on every request.
        }
      },
    },
  });
}
