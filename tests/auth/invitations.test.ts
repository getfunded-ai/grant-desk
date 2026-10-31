import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { MAX_PENDING_INVITATIONS, readPendingInvitations, withInvitation } =
  await import("../../lib/auth/invitations");
type PendingInvitation = import("../../lib/auth/invitations").PendingInvitation;

const valid: PendingInvitation = {
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

describe("withInvitation", () => {
  const invite = (n: number) => ({ ...valid, organizationId: `org-${n}`, invitedAt: `t${n}` });

  it("replaces an older invitation to the same organization", () => {
    const newer = { ...valid, invitedAt: "later" };
    expect(withInvitation([valid], newer)).toEqual([newer]);
  });

  it("keeps only the newest invitations, so nobody can grow another person's cookie", () => {
    let list: PendingInvitation[] = [];
    for (let n = 0; n < 50; n++) list = withInvitation(list, invite(n));
    expect(list).toHaveLength(MAX_PENDING_INVITATIONS);
    expect(list.at(-1)?.organizationId).toBe("org-49");
  });

  it("shortens a long organization name", () => {
    const [stored] = withInvitation([], { ...valid, organizationName: "x".repeat(500) });
    expect(stored.organizationName.length).toBeLessThanOrEqual(80);
  });
});
