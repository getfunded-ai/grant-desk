import { describe, expect, it } from "vitest";
import {
  APP_HOME_PATH,
  isPublicPath,
  redirectFor,
  safeNextPath,
  SIGN_IN_PATH,
} from "../../lib/auth/routes";

describe("isPublicPath", () => {
  it.each(["/", "/sign-in", "/auth/callback", "/auth/finish", "/api/ical/abc"])(
    "lets anyone open %s",
    (path) => expect(isPublicPath(path)).toBe(true),
  );

  it.each(["/settings", "/settings/profile", "/onboarding", "/grants", "/sign-in/extra", "/authx"])(
    "protects %s",
    (path) => expect(isPublicPath(path)).toBe(false),
  );
});

describe("redirectFor", () => {
  it("sends a signed-out visitor on a protected page to sign-in and remembers the page", () => {
    expect(redirectFor("/settings/profile", "?tab=1", false)).toBe(
      `${SIGN_IN_PATH}?next=${encodeURIComponent("/settings/profile?tab=1")}`,
    );
  });

  it("lets a signed-out visitor open public pages", () => {
    expect(redirectFor("/", "", false)).toBeNull();
    expect(redirectFor("/sign-in", "", false)).toBeNull();
  });

  it("sends a signed-in person away from sign-in", () => {
    expect(redirectFor("/sign-in", "", true)).toBe(APP_HOME_PATH);
  });

  it("lets a signed-in person open protected pages", () => {
    expect(redirectFor("/settings", "", true)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/settings", "/settings"],
    ["/settings/profile?x=1#top", "/settings/profile?x=1#top"],
    ["/a/../settings", "/settings"],
  ])("keeps the on-site path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "settings",
    "https://evil.example",
    "//evil.example",
    "//evil.example/settings",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/%5C%5Cevil.example",
  ])("falls back to the app home for %s", (input) => {
    const result = safeNextPath(input);
    expect(result.startsWith("/")).toBe(true);
    expect(result.startsWith("//")).toBe(false);
    expect(new URL(result, "https://grant-desk.test").origin).toBe("https://grant-desk.test");
  });

  it("rejects off-site destinations outright", () => {
    expect(safeNextPath("https://evil.example")).toBe(APP_HOME_PATH);
    expect(safeNextPath("//evil.example")).toBe(APP_HOME_PATH);
    expect(safeNextPath("/\\evil.example")).toBe(APP_HOME_PATH);
  });
});
