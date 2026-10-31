import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvitedRole } from "./roles";

/**
 * Pending invitations, kept on the invited person's account in Supabase Auth `app_metadata` until
 * they accept or decline. Only the service key can write `app_metadata`, so a person cannot invite
 * themselves into an organization. Nobody joins an organization without accepting.
 *
 * This is a stopgap: Phase B has no invitations table. Phase L (Team) replaces it with one.
 * Limits, because app_metadata travels in every session token and cookie: at most
 * MAX_PENDING_INVITATIONS per account (the oldest drops off) and a shortened organization name, so
 * nobody can grow someone else's cookie by sending many invitations. Two writes at the same moment
 * can still overwrite each other; the inviter then sends the invitation again.
 */

export const MAX_PENDING_INVITATIONS = 5;
const MAX_NAME_LENGTH = 80;

export type PendingInvitation = {
  organizationId: string;
  /** Shown to the invited person, copied at invite time. */
  organizationName: string;
  role: InvitedRole;
  invitedBy: string;
  invitedAt: string;
};

const KEY = "pending_invitations";
const INVITED_ROLES = new Set(["admin", "editor", "viewer"]);

/** Read and validate the list from an account's app_metadata. Anything malformed is dropped. */
export function readPendingInvitations(appMetadata: unknown): PendingInvitation[] {
  const list = (appMetadata as Record<string, unknown> | null | undefined)?.[KEY];
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item): item is PendingInvitation =>
      typeof item === "object" &&
      item !== null &&
      typeof item.organizationId === "string" &&
      typeof item.organizationName === "string" &&
      typeof item.invitedBy === "string" &&
      typeof item.invitedAt === "string" &&
      INVITED_ROLES.has(item.role),
  );
}

async function loadInvitations(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error(`Could not load the account: ${error?.message}`);
  return readPendingInvitations(data.user.app_metadata);
}

async function saveInvitations(admin: SupabaseClient, userId: string, list: PendingInvitation[]) {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { [KEY]: list },
  });
  if (error) throw new Error(`Could not save the invitation: ${error.message}`);
}

/**
 * The list with this invitation added: it replaces an older one to the same organization, the name
 * is shortened, and only the newest MAX_PENDING_INVITATIONS are kept.
 */
export function withInvitation(
  list: PendingInvitation[],
  invitation: PendingInvitation,
): PendingInvitation[] {
  const others = list.filter((item) => item.organizationId !== invitation.organizationId);
  const added = {
    ...invitation,
    organizationName: invitation.organizationName.slice(0, MAX_NAME_LENGTH),
  };
  return [...others, added].slice(-MAX_PENDING_INVITATIONS);
}

/** Record an invitation on the invited person's account. */
export async function addPendingInvitation(
  admin: SupabaseClient,
  userId: string,
  invitation: PendingInvitation,
): Promise<void> {
  const list = await loadInvitations(admin, userId);
  await saveInvitations(admin, userId, withInvitation(list, invitation));
}

/** The invitation to one organization waiting on this account, or null. */
export async function findPendingInvitation(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<PendingInvitation | null> {
  const list = await loadInvitations(admin, userId);
  return list.find((item) => item.organizationId === organizationId) ?? null;
}

/** Remove the invitation to one organization (accepted, declined or no longer valid). */
export async function removePendingInvitation(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<void> {
  const list = await loadInvitations(admin, userId);
  const rest = list.filter((item) => item.organizationId !== organizationId);
  if (rest.length !== list.length) await saveInvitations(admin, userId, rest);
}
