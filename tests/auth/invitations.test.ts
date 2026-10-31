import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { readPendingInvitations } = await import("../../lib/auth/invitations");

const valid = {
  organizationId: "org-1",
  organizationName: "Alpha",
  role: "editor",
  invitedBy: "user-1",
  invitedAt: "2026-10-30T00:00:00.000Z",
};

describe("readPendingInvitations", () => {
  it("reads well-formed invitations", () => {
    expect(readPendingInvitations({ pending_invitations: [valid] })).toEqual([valid]);
  });

  it("treats missing or odd metadata as no invitations", () => {
    for (const metadata of [undefined, null, {}, { pending_invitations: "x" }, "x"]) {
      expect(readPendingInvitations(metadata)).toEqual([]);
    }
  });

  it("never accepts an invitation that would make someone an owner", () => {
    expect(readPendingInvitations({ pending_invitations: [{ ...valid, role: "owner" }] })).toEqual(
      [],
    );
  });

  it("drops entries with missing or wrongly typed fields", () => {
    const broken = [
      { ...valid, organizationId: 7 },
      { ...valid, invitedBy: undefined },
      { ...valid, role: "superuser" },
      null,
      "org-1",
    ];
    expect(readPendingInvitations({ pending_invitations: [...broken, valid] })).toEqual([valid]);
  });
});
