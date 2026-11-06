import { describe, expect, it, vi } from "vitest";
import { APP_HOME_PATH } from "../../lib/auth/routes";
import { endStaleSession } from "../../lib/auth/session-ended";

function auth(user: unknown) {
  return {
    getUser: vi.fn(async () => ({ data: { user } })),
    signOut: vi.fn(async () => ({ error: null })),
  };
}

describe("endStaleSession", () => {
  it("leaves a valid session alone, so a link here cannot sign anyone out", async () => {
    const a = auth({ id: "user-1" });
    expect(await endStaleSession(a, "/settings/profile")).toBe("/settings/profile");
    expect(a.signOut).not.toHaveBeenCalled();
  });

  it("clears a session Supabase no longer accepts and goes to sign-in", async () => {
    const a = auth(null);
    expect(await endStaleSession(a, "/settings")).toBe("/sign-in?next=%2Fsettings");
    expect(a.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("never sends anyone off the site", async () => {
    expect(await endStaleSession(auth({ id: "u" }), "/.//evil.example")).toBe(APP_HOME_PATH);
    expect(await endStaleSession(auth(null), "https://evil.example")).toBe(
      `/sign-in?next=${encodeURIComponent(APP_HOME_PATH)}`,
    );
  });

  it("goes to sign-in when Supabase is not configured", async () => {
    expect(await endStaleSession(null, null)).toBe(
      `/sign-in?next=${encodeURIComponent(APP_HOME_PATH)}`,
    );
  });
});
