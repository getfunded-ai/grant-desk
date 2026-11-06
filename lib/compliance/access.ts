import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { FormState } from "@/lib/auth/actions";
import { getRole } from "@/lib/auth/org-store";
import { type CurrentUser, requireUser } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/roles";
import type { Tables } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

/** The grant columns the award page and its actions read. */
export type GrantForAward = Pick<
  Tables<"grants">,
  | "id"
  | "organization_id"
  | "title"
  | "stage"
  | "currency"
  | "amount_awarded"
  | "award_start_date"
  | "award_end_date"
  | "funder_id"
>;

export const GRANT_COLUMNS =
  "id, organization_id, title, stage, currency, amount_awarded, award_start_date, award_end_date, funder_id";

/** Roles that may change post-award records. Viewers only read; row-level security backs this up. */
export const EDITOR_ROLES: readonly Role[] = ["owner", "admin", "editor"];

export type GrantAccess =
  | {
      ok: true;
      supabase: SupabaseClient;
      user: CurrentUser;
      grant: GrantForAward;
      organizationId: string;
      role: Role;
    }
  | { ok: false; state: FormState };

const NOT_CONFIGURED: FormState = {
  status: "error",
  message: "The database is not set up on this copy of Grant Desk yet. See docs/DEPLOY.md.",
};

/** The grant as the signed-in person sees it (row-level security applies), or null. */
export async function findGrant(
  supabase: SupabaseClient,
  grantId: string,
): Promise<GrantForAward | null> {
  if (!/^[0-9a-f-]{36}$/i.test(grantId)) return null;
  const { data, error } = await supabase
    .from("grants")
    .select(GRANT_COLUMNS)
    .eq("id", grantId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the grant: ${error.message}`);
  return (data as GrantForAward | null) ?? null;
}

/**
 * For server actions: the signed-in person, their client, the grant and their role in its
 * organization. Refuses viewers and people who cannot see the grant with a plain message. Every
 * write still goes through the person's own client, so the database enforces the same rule.
 */
export async function requireEditableGrant(grantId: string): Promise<GrantAccess> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, state: NOT_CONFIGURED };
  const grant = await findGrant(supabase, grantId);
  if (!grant) {
    return { ok: false, state: { status: "error", message: "This grant could not be found." } };
  }
  const role = await getRole(supabase, grant.organization_id, user.id);
  if (!role || !EDITOR_ROLES.includes(role)) {
    return {
      ok: false,
      state: { status: "error", message: "Only an editor, admin or owner can change this award." },
    };
  }
  return { ok: true, supabase, user, grant, organizationId: grant.organization_id, role };
}

/** The path of the award page, for revalidation and redirects. */
export function awardPath(grantId: string): string {
  return `/grants/${grantId}/award`;
}
