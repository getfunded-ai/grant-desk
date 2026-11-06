import { describe, expect, it, vi } from "vitest";
import { completeEmailSignIn, type AuthLinkVerifier } from "../../lib/auth/callback";
import { APP_HOME_PATH } from "../../lib/auth/routes";

function verifier(error: unknown = null) {
  return {
    exchangeCodeForSession: vi.fn(async () => ({ error })),
    verifyOtp: vi.fn(async () => ({ error })),
  } satisfies AuthLinkVerifier;
}

const params = (query: string) => new URLSearchParams(query);

describe("completeEmailSignIn", () => {
  it("exchanges a magic-link code and goes to the remembered page", async () => {
    const auth = verifier();
    expect(await completeEmailSignIn(params("code=abc&next=%2Fsettings%2Fprofile"), auth)).toBe(
      "/settings/profile",
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("verifies a token hash from the custom email template", async () => {
    const auth = verifier();
    expect(await completeEmailSignIn(params("token_hash=h1&type=magiclink"), auth)).toBe(
      APP_HOME_PATH,
    );
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "magiclink", token_hash: "h1" });
  });

  it("refuses token types that are not sign-in links", async () => {
    const auth = verifier();
    expect(await completeEmailSignIn(params("token_hash=h1&type=recovery"), auth)).toMatch(
      /^\/auth\/finish/,
    );
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("sends a failed link back to sign-in with a message", async () => {
    expect(await completeEmailSignIn(params("code=bad"), verifier(new Error("expired")))).toBe(
      "/sign-in?error=link",
    );
    expect(
      await completeEmailSignIn(params("token_hash=h&type=email"), verifier(new Error("x"))),
    ).toBe("/sign-in?error=link");
  });

  it("treats an error from Supabase as a failed link", async () => {
    const auth = verifier();
    expect(
      await completeEmailSignIn(params("error=access_denied&error_code=otp_expired"), auth),
    ).toBe("/sign-in?error=link");
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("never redirects off the site, whatever `next` says", async () => {
    for (const next of ["https://evil.example", "//evil.example", "/\\evil.example"]) {
      const target = await completeEmailSignIn(
        params(`code=abc&next=${encodeURIComponent(next)}`),
        verifier(),
      );
      expect(target).toBe(APP_HOME_PATH);
    }
  });

  it("hands invite links (session after #) to the finish page, keeping a safe next", async () => {
    expect(await completeEmailSignIn(params("next=%2F%2Fevil.example"), verifier())).toBe(
      `/auth/finish?next=${encodeURIComponent(APP_HOME_PATH)}`,
    );
  });

  it("says so when sign-in is not configured", async () => {
    expect(await completeEmailSignIn(params("code=abc"), null)).toBe(
      "/sign-in?error=not-configured",
    );
  });
});
