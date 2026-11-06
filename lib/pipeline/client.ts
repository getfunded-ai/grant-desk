import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

export type Db = SupabaseClient<Database>;

/**
 * The signed-in person's client (Phase C) with Phase B's generated types, so row-level security
 * applies to everything the pipeline and the calendar read and write. Null when not configured.
 */
export async function userDb(): Promise<Db | null> {
  const client = await createClient();
  return (client as unknown as Db | null) ?? null;
}
