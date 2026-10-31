import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The only file in Phase C that names database tables (organizations, memberships, profiles from
 * docs/plan/phase-B.md). When Phase B's typed client lands in lib/db, swap the bodies here.
 *
 * `user` functions take the signed-in user's client, so row-level security applies.
 * `admin` functions take the service-key client; callers must check permissions first.
 */

export type Role = "owner" | "admin" | "editor" | "viewer";
export type OrganizationSummary = { id: string; name: string; role: Role };

/** Roles that may invite teammates in Phase C. Phase L owns the full permission model. */
export const INVITER_ROLES: readonly Role[] = ["owner", "admin"];

export async function listMyOrganizations(
  user: SupabaseClient,
  userId: string,
): Promise<OrganizationSummary[]> {
  const { data, error } = await user
    .from("memberships")
    .select("role, organizations(id, name)")
    .eq("user_id", userId);
  if (error) throw new Error(`Could not load organizations: ${error.message}`);

  const rows = (data ?? []) as unknown as {
    role: Role;
    organizations: { id: string; name: string } | null;
  }[];
  return rows
    .filter((row) => row.organizations)
    .map((row) => ({ id: row.organizations!.id, name: row.organizations!.name, role: row.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
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

export async function getProfileName(user: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await user.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return (data?.full_name as string | null | undefined) ?? null;
}

export async function updateProfileName(
  user: SupabaseClient,
  userId: string,
  fullName: string | null,
): Promise<void> {
  const { error } = await user.from("profiles").update({ full_name: fullName }).eq("id", userId);
  if (error) throw new Error(`Could not save the profile: ${error.message}`);
}

/** Create an organization with the creator as owner. Removes the organization if the second step fails. */
export async function createOrganizationWithOwner(
  admin: SupabaseClient,
  ownerId: string,
  name: string,
): Promise<string> {
  const { data: org, error } = await admin
    .from("organizations")
    .insert({ name })
    .select("id")
    .single();
  if (error || !org) throw new Error(`Could not create the organization: ${error?.message}`);

  const { error: memberError } = await admin
    .from("memberships")
    .insert({ organization_id: org.id, user_id: ownerId, role: "owner" });
  if (memberError) {
    await admin.from("organizations").delete().eq("id", org.id);
    throw new Error(`Could not add you to the organization: ${memberError.message}`);
  }
  return org.id as string;
}

/** Add a person to an organization. Returns "exists" when they are already a member. */
export async function addMember(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  role: Role,
): Promise<"added" | "exists"> {
  const { error } = await admin
    .from("memberships")
    .insert({ organization_id: organizationId, user_id: userId, role });
  if (!error) return "added";
  if (error.code === "23505") return "exists"; // unique (organization_id, user_id)
  throw new Error(`Could not add the teammate: ${error.message}`);
}
