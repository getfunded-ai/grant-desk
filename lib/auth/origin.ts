import "server-only";
import { headers } from "next/headers";

/**
 * The address this deployment is reached on, for links in sign-in and invite emails. Each Vercel
 * preview gets its own address, so this reads the request rather than a fixed setting. Supabase only
 * sends people to addresses on its redirect allow-list (docs/DEPLOY.md), so a forged host header
 * cannot send a sign-in link somewhere else.
 */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
