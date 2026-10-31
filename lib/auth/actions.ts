"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  addMember,
  createOrganizationWithOwner,
  INVITER_ROLES,
  listMyOrganizations,
  updateProfileName,
} from "./org-store";
import { getRequestOrigin } from "./origin";
import { APP_HOME_PATH, ONBOARDING_PATH, safeNextPath, SIGN_IN_PATH } from "./routes";
import { ACTIVE_ORG_COOKIE, requireUser } from "./session";

export type FormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const NOT_CONFIGURED: FormState = {
  status: "error",
  message: "Sign-in is not set up on this copy of Grant Desk yet. See docs/DEPLOY.md.",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEmail(formData: FormData): string | null {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function readName(formData: FormData, field: string): string {
  return String(formData.get(field) ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

async function setActiveOrganization(organizationId: string) {
  (await cookies()).set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Email a one-time sign-in link. Anyone may ask; Supabase creates the account on first use. */
export async function requestMagicLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = readEmail(formData);
  if (!email) return { status: "error", message: "Enter a valid email address." };
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const next = safeNextPath(String(formData.get("next") ?? ""));
  const origin = await getRequestOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    console.error("requestMagicLink failed", { status: error.status, code: error.code });
    const busy = error.status === 429;
    return {
      status: "error",
      message: busy
        ? "Too many sign-in emails were sent just now. Wait a minute and try again."
        : "We could not send the sign-in email. Try again in a minute.",
    };
  }
  return {
    status: "success",
    message: `Check ${email} for a sign-in link. Open it in this browser.`,
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  redirect(SIGN_IN_PATH);
}

/** Create an organization with the signed-in person as owner, and switch to it. */
export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = readName(formData, "name");
  if (name.length < 2 || name.length > 120) {
    return { status: "error", message: "Use a name between 2 and 120 characters." };
  }
  const admin = createAdminClient();
  if (!admin) return NOT_CONFIGURED;

  let organizationId: string;
  try {
    organizationId = await createOrganizationWithOwner(admin, user.id, name);
  } catch (error) {
    console.error("createOrganization failed", error);
    return { status: "error", message: "We could not create the organization. Try again." };
  }
  await setActiveOrganization(organizationId);
  redirect(`${ONBOARDING_PATH}/invite`);
}

/**
 * Invite one teammate by email into an organization the caller owns or administers.
 * New people get Supabase's invite email. People who already have an account are added and see the
 * organization in their switcher next time they sign in.
 */
export async function inviteTeammate(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const email = readEmail(formData);
  if (!email) return { status: "error", message: "Enter a valid email address." };
  if (email === user.email?.toLowerCase()) {
    return { status: "error", message: "That is your own address." };
  }
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NOT_CONFIGURED;

  // The permission check uses the caller's own session, so row-level security backs it up.
  const organizationId = String(formData.get("organizationId") ?? "");
  const organization = (await listMyOrganizations(supabase, user.id)).find(
    (org) => org.id === organizationId,
  );
  if (!organization || !INVITER_ROLES.includes(organization.role)) {
    return {
      status: "error",
      message: "Only an owner or admin of this organization can invite people.",
    };
  }

  const origin = await getRequestOrigin();
  const invited = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(APP_HOME_PATH)}`,
  });

  let invitedUserId: string;
  let alreadyHadAccount = false;
  if (invited.data.user) {
    invitedUserId = invited.data.user.id;
  } else if (invited.error?.code === "email_exists") {
    // generateLink returns the existing account without sending anything.
    const existing = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (existing.error || !existing.data.user) {
      console.error("inviteTeammate lookup failed", { code: existing.error?.code });
      return { status: "error", message: "We could not invite that person. Try again." };
    }
    invitedUserId = existing.data.user.id;
    alreadyHadAccount = true;
  } else {
    console.error("inviteTeammate failed", {
      status: invited.error?.status,
      code: invited.error?.code,
    });
    const busy = invited.error?.status === 429;
    return {
      status: "error",
      message: busy
        ? "Too many emails were sent just now. Wait a minute and try again."
        : "We could not send the invitation. Try again.",
    };
  }

  try {
    const result = await addMember(admin, organization.id, invitedUserId, "editor");
    if (result === "exists") {
      return {
        status: "success",
        message: `${email} is already a member of ${organization.name}.`,
      };
    }
  } catch (error) {
    console.error("inviteTeammate membership failed", error);
    return { status: "error", message: "We could not add that person. Try again." };
  }
  return {
    status: "success",
    message: alreadyHadAccount
      ? `${email} already has an account. They now see ${organization.name} when they sign in.`
      : `Invitation sent to ${email}. They join ${organization.name} when they open the email.`,
  };
}

/** Switch the organization the person is working in. Only organizations they belong to are accepted. */
export async function switchOrganization(organizationId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return;
  const organizations = await listMyOrganizations(supabase, user.id);
  if (!organizations.some((org) => org.id === organizationId)) return;
  await setActiveOrganization(organizationId);
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const fullName = readName(formData, "fullName");
  if (fullName.length > 120) return { status: "error", message: "Use at most 120 characters." };
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;
  try {
    await updateProfileName(supabase, user.id, fullName || null);
  } catch (error) {
    console.error("updateProfile failed", error);
    return { status: "error", message: "We could not save your profile. Try again." };
  }
  return { status: "success", message: "Saved." };
}
