import { NextResponse, type NextRequest } from "next/server";
import { redirectFor } from "./lib/auth/routes";
import { updateSession } from "./lib/supabase/proxy";

/**
 * Route protection. Refreshes the session cookie, then sends signed-out people to sign-in.
 * This is the first check, not the only one: pages and server actions check the user again.
 */
export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const target = redirectFor(request.nextUrl.pathname, request.nextUrl.search, signedIn);
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  // Skip static files and images; run on pages, server actions and API routes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
