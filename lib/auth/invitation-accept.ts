import { INVITER_ROLES, type InvitedRole, type Role } from "./roles";

type Invitation = { organizationId: string; invitedBy: string; role: InvitedRole };

/** What accepting needs from the database. Passed in, so tests/auth can check the rules alone. */
export type AcceptSteps<T extends Invitation> = {
  /** The invitation stored on the signed-in person's own account, or null. Never the form's word. */
  find(): Promise<T | null>;
  inviterRole(invitation: T): Promise<Role | null>;
  addMember(invitation: T): Promise<unknown>;
  remove(invitation: T): Promise<void>;
};

export type AcceptResult = "joined" | "not-found" | "expired";

/**
 * Accept one invitation. The person joins only if the invitation is on their own account and the
 * inviter is still an owner or admin. The invitation is used up either way, and only after the
 * membership exists, so a failed insert leaves it in place to try again.
 */
export async function acceptPendingInvitation<T extends Invitation>(
  steps: AcceptSteps<T>,
): Promise<AcceptResult> {
  const invitation = await steps.find();
  if (!invitation) return "not-found";
  const inviterRole = await steps.inviterRole(invitation);
  if (!inviterRole || !INVITER_ROLES.includes(inviterRole)) {
    await steps.remove(invitation);
    return "expired";
  }
  await steps.addMember(invitation);
  await steps.remove(invitation);
  return "joined";
}
