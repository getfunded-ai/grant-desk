"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEmailClient } from "@/lib/supabase/email";
import { createClient } from "@/lib/supabase/server";
import {
  addPendingInvitation,
  findPendingInvitation,
  removePendingInvitation,
} from "./invitations";
import {
  addMember,
  createOrganization as insertOrganization,
  findUserIdByEmail,
  getRole,
  listMyOrganizations,
  updateDisplayName,
} from "./org-store";
import { acceptPendingInvitation, type AcceptResult } from "./invitation-accept";
import { getRequestOrigin } from "./origin";
import { INVITER_ROLES } from "./roles";
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
  await requireUser();
  const name = readName(formData, "name");
  if (name.length < 2 || name.length > 120) {
    return { status: "error", message: "Use a name between 2 and 120 characters." };
  }
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  let organizationId: string;
  try {
    organizationId = await insertOrganization(supabase, name);
  } catch (error) {
    console.error("createOrganization failed", error);
    return { status: "error", message: "We could not create the organization. Try again." };
  }
  await setActiveOrganization(organizationId);
  redirect(`${ONBOARDING_PATH}/invite`);
}

/**
 * Invite one teammate by email into an organization the caller owns or administers.
 * Nobody joins without accepting: the invitation waits on the invited person's account (see
 * lib/auth/invitations.ts) and they accept it in the app. New people get Supabase's invite email;
 * people who already have an account get a sign-in link. The caller sees the same message either
 * way, so the form cannot be used to find out who has an account.
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

  const failed: FormState = {
    status: "error",
    message: "We could not send the invitation. Try again.",
  };
  const busy: FormState = {
    status: "error",
    message: "Too many emails were sent just now. Wait a minute and try again.",
  };
  const redirectTo = `${await getRequestOrigin()}/auth/callback?next=${encodeURIComponent(APP_HOME_PATH)}`;

  try {
    let invitedUserId = await findUserIdByEmail(admin, email);
    if (invitedUserId) {
      if (await getRole(supabase, organization.id, invitedUserId)) {
        return {
          status: "success",
          message: `${email} is already a member of ${organization.name}.`,
        };
      }
      const { error } = await createEmailClient()!.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      if (error) {
        console.error("inviteTeammate notice failed", { status: error.status, code: error.code });
        return error.status === 429 ? busy : failed;
      }
    } else {
      const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (!invited.data.user) {
        console.error("inviteTeammate failed", {
          status: invited.error?.status,
          code: invited.error?.code,
        });
        return invited.error?.status === 429 ? busy : failed;
      }
      invitedUserId = invited.data.user.id;
    }

    await addPendingInvitation(admin, invitedUserId, {
      organizationId: organization.id,
      organizationName: organization.name,
      role: "editor",
      invitedBy: user.id,
      invitedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("inviteTeammate failed", error);
    return failed;
  }
  return {
    status: "success",
    message: `Invitation sent to ${email}. They join ${organization.name} when they accept it.`,
  };
}

/**
 * Accept an invitation waiting on the signed-in person's account. The invitation is read from the
 * account on the server (never from the form), and the inviter must still be an owner or admin.
 */
export async function acceptInvitation(organizationId: string): Promise<FormState> {
  const user = await requireUser();
  const admin = createAdminClient();
  if (!admin) return NOT_CONFIGURED;

  let result: AcceptResult;
  try {
    result = await acceptPendingInvitation({
      find: () => findPendingInvitation(admin, user.id, organizationId),
      inviterRole: (invitation) => getRole(admin, invitation.organizationId, invitation.invitedBy),
      addMember: (invitation) =>
        addMember(admin, invitation.organizationId, user.id, invitation.role),
      remove: (invitation) => removePendingInvitation(admin, user.id, invitation.organizationId),
    });
  } catch (error) {
    console.error("acceptInvitation failed", error);
    return { status: "error", message: "We could not accept the invitation. Try again." };
  }
  revalidatePath("/", "layout");
  if (result === "joined") {
    await setActiveOrganization(organizationId);
    return { status: "success", message: "Joined." };
  }
  return {
    status: "error",
    message: "This invitation is no longer valid. Ask for a new one.",
  };
}

export async function declineInvitation(organizationId: string): Promise<FormState> {
  const user = await requireUser();
  const admin = createAdminClient();
  if (!admin) return NOT_CONFIGURED;
  try {
    await removePendingInvitation(admin, user.id, organizationId);
  } catch (error) {
    console.error("declineInvitation failed", error);
    return { status: "error", message: "We could not decline the invitation. Try again." };
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Declined." };
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
  const displayName = readName(formData, "displayName");
  if (displayName.length > 120) return { status: "error", message: "Use at most 120 characters." };
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;
  try {
    await updateDisplayName(supabase, user.id, displayName || null);
  } catch (error) {
    console.error("updateProfile failed", error);
    return { status: "error", message: "We could not save your profile. Try again." };
  }
  return { status: "success", message: "Saved." };
}
