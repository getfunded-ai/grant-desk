/** Membership roles (Phase B's `membership_role` enum). Pure, so tests and client code can import it. */
export type Role = "owner" | "admin" | "editor" | "viewer";

/** Roles an invitation can grant. Owner is never granted by invitation. */
export type InvitedRole = Exclude<Role, "owner">;

/** Roles that may invite teammates in Phase C. Phase L owns the full permission model. */
export const INVITER_ROLES: readonly Role[] = ["owner", "admin"];
