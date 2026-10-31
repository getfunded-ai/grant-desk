import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The proxy's only outside dependency is Supabase's session check. Replace it with a stub that
// reports the claims (or error) each test sets, and can ask to refresh the session cookie.
const auth = vi.hoisted(() => ({
  claims: null as { sub: string } | null,
  error: null as Error | null,
  refreshedCookie: null as { name: string; value: string } | null,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (
          cookies: { name: string; value: string; options: object }[],
          headers: Record<string, string>,
        ) => void;
      };
    },
  ) => ({
    auth: {
      getClaims: async () => {
        if (auth.refreshedCookie) {
          options.cookies.setAll([{ ...auth.refreshedCookie, options: { path: "/" } }], {
            "Cache-Control": "private, no-store",
          });
        }
        return { data: auth.claims ? { claims: auth.claims } : null, error: auth.error };
      },
    },
  }),
}));

const { proxy } = await import("../../proxy");

const request = (path: string) => new NextRequest(new URL(path, "https://grant-desk.test"));

describe("proxy route protection", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    auth.claims = null;
    auth.error = null;
    auth.refreshedCookie = null;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("redirects a signed-out visitor from a protected page to sign-in", async () => {
    const response = await proxy(request("/settings?tab=team"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://grant-desk.test/sign-in?next=%2Fsettings%3Ftab%3Dteam",
    );
  });

  it("redirects when the session check fails, even if a cookie is present", async () => {
    auth.claims = { sub: "user-1" };
    auth.error = new Error("invalid JWT");
    const response = await proxy(request("/onboarding"));
    expect(response.headers.get("location")).toBe(
      "https://grant-desk.test/sign-in?next=%2Fonboarding",
    );
  });

  it("lets a signed-out visitor open the home and sign-in pages", async () => {
    for (const path of ["/", "/sign-in", "/auth/callback?code=x"]) {
      const response = await proxy(request(path));
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("lets a signed-in person through to protected pages", async () => {
    auth.claims = { sub: "user-1" };
    const response = await proxy(request("/settings"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("sends a signed-in person from sign-in to the app", async () => {
    auth.claims = { sub: "user-1" };
    const response = await proxy(request("/sign-in"));
    expect(response.headers.get("location")).toBe("https://grant-desk.test/settings");
  });

  it("keeps a refreshed session cookie on the response, including on redirects", async () => {
    auth.claims = { sub: "user-1" };
    auth.refreshedCookie = { name: "sb-test-auth-token", value: "fresh" };
    const through = await proxy(request("/settings"));
    expect(through.cookies.get("sb-test-auth-token")?.value).toBe("fresh");
    expect(through.headers.get("cache-control")).toBe("private, no-store");

    const redirected = await proxy(request("/sign-in"));
    expect(redirected.status).toBe(307);
    expect(redirected.cookies.get("sb-test-auth-token")?.value).toBe("fresh");
  });

  it("treats a deployment without Supabase settings as signed out", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    auth.claims = { sub: "user-1" };
    const response = await proxy(request("/settings"));
    expect(response.headers.get("location")).toBe(
      "https://grant-desk.test/sign-in?next=%2Fsettings",
    );
    expect((await proxy(request("/"))).headers.get("location")).toBeNull();
  });
});
