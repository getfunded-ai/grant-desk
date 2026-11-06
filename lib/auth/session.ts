import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { readPendingInvitations, type PendingInvitation } from "./invitations";
import { listMyOrganizations, type OrganizationSummary } from "./org-store";
import { ONBOARDING_PATH, SESSION_ENDED_PATH } from "./routes";

/** Cookie that remembers which organization the person is working in. Checked against memberships on every read. */
export const ACTIVE_ORG_COOKIE = "gd_active_org";

export type CurrentUser = {
  id: string;
  email: string | null;
  /** Read fresh from Supabase Auth on each request, so a new invitation shows at once. */
  pendingInvitations: PendingInvitation[];
};

/** The signed-in person, checked with Supabase Auth (not just the cookie). Null when signed out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    pendingInvitations: readPendingInvitations(data.user.app_metadata),
  };
});

/**
 * The signed-in person, or a redirect. A missing user here means the proxy let a cookie through
 * whose session Supabase no longer accepts, so the stale cookie is cleared before sign-in.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(SESSION_ENDED_PATH);
  return user;
}

export type OrganizationContext = {
  user: CurrentUser;
  organizations: OrganizationSummary[];
  /** Null only when the person belongs to no organization yet. */
  active: OrganizationSummary | null;
};

/** The person, their organizations, and the one they are working in. */
export const getOrganizationContext = cache(async (): Promise<OrganizationContext> => {
  const user = await requireUser();
  const supabase = await createClient();
  const organizations = supabase ? await listMyOrganizations(supabase, user.id) : [];
  const wanted = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  // Without a valid cookie, use the organization joined first: never one picked by its name, which
  // whoever created it controls.
  const oldest = organizations.reduce<OrganizationSummary | null>(
    (first, org) => (!first || org.joinedAt < first.joinedAt ? org : first),
    null,
  );
  const active = organizations.find((org) => org.id === wanted) ?? oldest;
  return { user, organizations, active };
});

/** For pages that need an organization: sends people with none to onboarding. */
export async function requireActiveOrganization(): Promise<
  OrganizationContext & { active: OrganizationSummary }
> {
  const context = await getOrganizationContext();
  if (!context.active) redirect(ONBOARDING_PATH);
  return { ...context, active: context.active };
}
