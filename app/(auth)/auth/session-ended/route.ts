import { NextResponse, type NextRequest } from "next/server";
import { endStaleSession } from "@/lib/auth/session-ended";
import { createClient } from "@/lib/supabase/server";

/**
 * Pages send people here when the session cookie is no longer valid (the account was removed, or the
 * session was signed out elsewhere). The proxy only checks the token's signature, so without this it
 * would keep sending them back from sign-in to the page. Clears the stale cookie, then shows sign-in.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const target = await endStaleSession(
    supabase?.auth ?? null,
    request.nextUrl.searchParams.get("next"),
  );
  return NextResponse.redirect(new URL(target, request.url));
}
