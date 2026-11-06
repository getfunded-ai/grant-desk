import { describe, expect, it, vi } from "vitest";
import { acceptPendingInvitation } from "../../lib/auth/invitation-accept";
import type { Role } from "../../lib/auth/roles";

const invitation = { organizationId: "org-1", invitedBy: "inviter-1", role: "editor" as const };

/** Fake database steps. `stored` is what the person's own account holds. */
function steps(stored: typeof invitation | null, inviterRole: Role | null) {
  const calls: string[] = [];
  return {
    calls,
    find: vi.fn(async () => stored),
    inviterRole: vi.fn(async () => inviterRole),
    addMember: vi.fn(async () => void calls.push("addMember")),
    remove: vi.fn(async () => void calls.push("remove")),
  };
}

describe("acceptPendingInvitation", () => {
  it("joins when the invitation is on the account and the inviter may still invite", async () => {
    for (const role of ["owner", "admin"] as const) {
      const s = steps(invitation, role);
      expect(await acceptPendingInvitation(s)).toBe("joined");
      expect(s.addMember).toHaveBeenCalledWith(invitation);
      // The invitation is used up only after the membership exists.
      expect(s.calls).toEqual(["addMember", "remove"]);
    }
  });

  it("adds nobody when the account holds no such invitation", async () => {
    const s = steps(null, "owner");
    expect(await acceptPendingInvitation(s)).toBe("not-found");
    expect(s.addMember).not.toHaveBeenCalled();
    expect(s.remove).not.toHaveBeenCalled();
  });

  it("adds nobody, and uses up the invitation, when the inviter lost the right to invite", async () => {
    for (const role of ["editor", "viewer", null] as const) {
      const s = steps(invitation, role);
      expect(await acceptPendingInvitation(s)).toBe("expired");
      expect(s.addMember).not.toHaveBeenCalled();
      expect(s.calls).toEqual(["remove"]);
    }
  });

  it("keeps the invitation when adding the membership fails", async () => {
    const s = steps(invitation, "owner");
    s.addMember.mockRejectedValueOnce(new Error("insert failed"));
    await expect(acceptPendingInvitation(s)).rejects.toThrow("insert failed");
    expect(s.remove).not.toHaveBeenCalled();
  });
});
