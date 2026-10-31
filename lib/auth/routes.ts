/** Route rules for sign-in. Pure functions, so tests/auth can check them without a server. */

export const SIGN_IN_PATH = "/sign-in";
export const ONBOARDING_PATH = "/onboarding";
/** Where a signed-in person lands. Phase E moves this to the pipeline (/grants). */
export const APP_HOME_PATH = "/settings";

/**
 * Pages anyone may open. Everything else needs a signed-in person (deny by default).
 * `/api/` routes are let through because each one checks its own caller (cron secret, feed token,
 * webhook signature); a sign-in redirect would break them.
 */
const PUBLIC_EXACT = new Set(["/", SIGN_IN_PATH]);
const PUBLIC_PREFIXES = ["/auth/", "/api/"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Where the proxy should send this request, or null to let it through.
 * Signed out on a protected page: to sign-in, remembering the page. Signed in on sign-in: to the app.
 */
export function redirectFor(pathname: string, search: string, signedIn: boolean): string | null {
  if (!signedIn && !isPublicPath(pathname)) {
    return `${SIGN_IN_PATH}?next=${encodeURIComponent(pathname + search)}`;
  }
  if (signedIn && pathname === SIGN_IN_PATH) return APP_HOME_PATH;
  return null;
}

/**
 * Accept a post-sign-in destination only if it is a path on this site. Anything else (another
 * host, a protocol, `//host`, a backslash trick) falls back to the app home, so a sign-in link
 * can never be used to bounce someone to another website.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return APP_HOME_PATH;
  }
  const base = "https://grant-desk.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return APP_HOME_PATH;
  }
  if (url.origin !== base) return APP_HOME_PATH;
  return url.pathname + url.search + url.hash;
}
