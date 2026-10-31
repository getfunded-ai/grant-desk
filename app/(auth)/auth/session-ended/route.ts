import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath, SIGN_IN_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Pages send people here when the session cookie is no longer valid (the account was removed, or the
 * session was signed out elsewhere). The proxy only checks the token's signature, so without this it
 * would keep sending them back from sign-in to the page. Clears the stale cookie, then shows sign-in.
 * A still-valid session is left alone, so a link to this page cannot sign anyone out.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data.user) return NextResponse.redirect(new URL(next, request.url));
    await supabase.auth.signOut({ scope: "local" });
  }
  return NextResponse.redirect(
    new URL(`${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`, request.url),
  );
}
