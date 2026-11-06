import type { Role } from "@/lib/auth/roles";

/** Pure. Mirrors private.can_edit in the database: owners, admins and editors write; viewers read. */
export const EDITOR_ROLES: readonly Role[] = ["owner", "admin", "editor"];

export function canEdit(role: Role): boolean {
  return EDITOR_ROLES.includes(role);
}
