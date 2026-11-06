import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export type Db = SupabaseClient<Database>;

/**
 * The signed-in person's client with the generated types, so row-level security decides what every
 * read and write may touch. Null when Supabase is not configured on this copy.
 */
export async function getDb(): Promise<Db | null> {
  const client = await createClient();
  return (client as unknown as Db | null) ?? null;
}

/** Turns a Supabase error into a plain Error with the message a person can act on. */
export function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? "no row was written"}`);
}
