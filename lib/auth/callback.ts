import { safeNextPath, SIGN_IN_PATH } from "./routes";

/** The two ways an email link proves who someone is. */
export type AuthLinkVerifier = {
  exchangeCodeForSession(code: string): Promise<{ error: unknown }>;
  verifyOtp(params: { type: EmailLinkType; token_hash: string }): Promise<{ error: unknown }>;
};

export type EmailLinkType = "email" | "magiclink" | "signup" | "invite";
const EMAIL_LINK_TYPES = new Set<string>(["email", "magiclink", "signup", "invite"]);

export const FINISH_PATH = "/auth/finish";

/**
 * Turn an email-link visit into a session and decide where to send the person. Returns a path on this site.
 * - `?code=`: Supabase's default magic-link email (works in the browser that asked for the link).
 * - `?token_hash=&type=`: the custom email templates in docs/DEPLOY.md (works in any browser).
 * - neither: an invite email, whose session sits after `#`, which servers never see. The browser
 *   keeps the `#` part across this redirect, and the finish page reads it there.
 */
export async function completeEmailSignIn(
  params: URLSearchParams,
  auth: AuthLinkVerifier | null,
): Promise<string> {
  const failed = `${SIGN_IN_PATH}?error=link`;
  if (!auth) return `${SIGN_IN_PATH}?error=not-configured`;
  if (params.get("error")) return failed;

  const next = safeNextPath(params.get("next"));
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");

  if (code) {
    const { error } = await auth.exchangeCodeForSession(code);
    return error ? failed : next;
  }
  if (tokenHash && type && EMAIL_LINK_TYPES.has(type)) {
    const { error } = await auth.verifyOtp({ type: type as EmailLinkType, token_hash: tokenHash });
    return error ? failed : next;
  }
  return `${FINISH_PATH}?next=${encodeURIComponent(next)}`;
}
