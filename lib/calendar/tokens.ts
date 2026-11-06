import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/db/types";

/**
 * The organization's own iCal address is `/api/ical/<token>/calendar.ics`. The token is 32 random
 * bytes; only its sha256 is stored, so a database read cannot give the address away. The address
 * is shown once, when it is made, and an editor can revoke it.
 */

type Client = SupabaseClient<Database>;
export type CalendarToken = Tables<"calendar_tokens">;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isTokenShaped(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export function calendarPath(token: string): string {
  return `/api/ical/${token}/calendar.ics`;
}

export async function listTokens(db: Client, organizationId: string): Promise<CalendarToken[]> {
  const { data, error } = await db
    .from("calendar_tokens")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load the calendar addresses: ${error.message}`);
  return data ?? [];
}

/** Makes a token and returns it once. Only its hash is stored. */
export async function createToken(
  db: Client,
  organizationId: string,
  label: string | null,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { error } = await db
    .from("calendar_tokens")
    .insert({ organization_id: organizationId, token_hash: hashToken(token), label });
  if (error) throw new Error(`Could not create the calendar address: ${error.message}`);
  return token;
}

export async function revokeToken(db: Client, organizationId: string, id: string): Promise<void> {
  const { data, error } = await db
    .from("calendar_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("revoked_at", null)
    .select("id");
  if (error) throw new Error(`Could not revoke the calendar address: ${error.message}`);
  if (!data?.length) throw new Error("Could not revoke the calendar address: nothing changed");
}

/**
 * The organization behind a token, or null. Called by the feed route with the service-key client
 * (the route has no signed-in person), and only after the token's shape was checked.
 */
export async function resolveToken(
  admin: Client,
  token: string,
): Promise<{ organizationId: string; organizationName: string } | null> {
  if (!isTokenShaped(token)) return null;
  const { data, error } = await admin
    .from("calendar_tokens")
    .select("organization_id")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return null;
  const { data: organization } = await admin
    .from("organizations")
    .select("name")
    .eq("id", data.organization_id)
    .maybeSingle();
  return {
    organizationId: data.organization_id,
    organizationName: organization?.name ?? "Grant Desk",
  };
}
