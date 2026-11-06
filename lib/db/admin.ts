import "server-only";

import { type SupabaseClient, createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

/**
 * A typed Supabase client with the secret (service-role) key. It bypasses row-level security, so:
 * - only server code may import it (the `server-only` import makes a browser bundle fail to build);
 * - use it only inside a server action or route handler that has already checked who the caller is
 *   and which organization they may act for (AGENTS.md "Data rules");
 * - prefer the signed-in user's client (lib/supabase, Phase C) for everything a person does, so the
 *   database enforces the data wall.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set on the server");
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
