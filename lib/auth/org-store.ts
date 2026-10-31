import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The only file in Phase C that names database tables and functions (organizations, memberships,
 * profiles, create_organization from Phase B). When Phase B's typed client lands in lib/db, swap the
 * bodies here. Functions take the signed-in user's client, so row-level security applies, except
 * where the parameter is named `admin`: those need the service-key client and a checked caller.
 */

export type Role = "owner" | "admin" | "editor" | "viewer";
export type OrganizationSummary = {
  id: string;
  name: string;
  role: Role;
  /** When this person joined. The oldest membership is the default organization. */
  joinedAt: string;
};

/** Roles that may invite teammates in Phase C. Phase L owns the full permission model. */
export const INVITER_ROLES: readonly Role[] = ["owner", "admin"];

export async function listMyOrganizations(
  user: SupabaseClient,
  userId: string,
): Promise<OrganizationSummary[]> {
  const { data, error } = await user
    .from("memberships")
    .select("role, created_at, organizations(id, name)")
    .eq("user_id", userId);
  if (error) throw new Error(`Could not load organizations: ${error.message}`);

  const rows = (data ?? []) as unknown as {
    role: Role;
    created_at: string;
    organizations: { id: string; name: string } | null;
  }[];
  return rows
    .filter((row) => row.organizations)
    .map((row) => ({
      id: row.organizations!.id,
      name: row.organizations!.name,
      role: row.role,
      joinedAt: row.created_at,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The person's role in one organization, or null if they are not a member. */
export async function getRole(
  client: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<Role | null> {
  const { data, error } = await client
    .from("memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not check the membership: ${error.message}`);
  return (data?.role as Role | undefined) ?? null;
}

/** The account id for an email address, from the profile Phase B's trigger copies it into. */
export async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email) // Supabase Auth stores addresses in lower case; callers pass lower case.
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not look up the account: ${error.message}`);
  return (data?.id as string | undefined) ?? null;
}

export async function countMembers(
  user: SupabaseClient,
  organizationId: string,
): Promise<number | null> {
  const { count, error } = await user
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  return error ? null : count;
}

export async function getDisplayName(user: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await user
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return (data?.display_name as string | null | undefined) ?? null;
}

export async function updateDisplayName(
  user: SupabaseClient,
  userId: string,
  displayName: string | null,
): Promise<void> {
  const { data, error } = await user
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId)
    .select("id");
  if (error) throw new Error(`Could not save the profile: ${error.message}`);
  // No error and no row means nothing was saved (no profile, or not allowed): say so.
  if (!data?.length) throw new Error("Could not save the profile: no profile row was updated");
}

/** Create an organization with the caller as owner, in one database transaction (Phase B function). */
export async function createOrganization(user: SupabaseClient, name: string): Promise<string> {
  const { data, error } = await user.rpc("create_organization", { p_name: name });
  if (error || typeof data !== "string") {
    throw new Error(`Could not create the organization: ${error?.message ?? "no id returned"}`);
  }
  return data;
}

/**
 * Add a person to an organization. Called with the service-key client when an invited person
 * accepts, after the invitation was checked. Returns "exists" when they are already a member.
 */
export async function addMember(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  role: Exclude<Role, "owner">,
): Promise<"added" | "exists"> {
  const { error } = await admin
    .from("memberships")
    .insert({ organization_id: organizationId, user_id: userId, role });
  if (!error) return "added";
  if (error.code === "23505") return "exists"; // unique (organization_id, user_id)
  throw new Error(`Could not add the teammate: ${error.message}`);
}
