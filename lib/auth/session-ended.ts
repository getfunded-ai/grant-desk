import { safeNextPath, SIGN_IN_PATH } from "./routes";

export type StaleSessionAuth = {
  getUser(): Promise<{ data: { user: unknown } }>;
  signOut(options: { scope: "local" }): Promise<unknown>;
};

/**
 * Decide what /auth/session-ended does. A session Supabase still accepts is left alone (so a link
 * to the route cannot sign anyone out) and the person goes on to `next`. Otherwise the stale cookie
 * is cleared and they go to sign-in. Returns a path on this site.
 */
export async function endStaleSession(
  auth: StaleSessionAuth | null,
  nextParam: string | null,
): Promise<string> {
  const next = safeNextPath(nextParam);
  if (auth) {
    const { data } = await auth.getUser();
    if (data.user) return next;
    await auth.signOut({ scope: "local" });
  }
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`;
}
