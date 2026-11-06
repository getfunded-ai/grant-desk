"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import { getRequestOrigin } from "@/lib/auth/origin";
import { requireActiveOrganization } from "@/lib/auth/session";
import { userDb, type Db } from "@/lib/pipeline/client";
import { canEdit } from "@/lib/pipeline/permissions";
import { checkFeedUrl, refreshFeed } from "./feeds";
import { FEED_PRESETS } from "./presets";
import { addFeed, listFeeds, removeFeed, setReminderMode as saveReminderMode } from "./store";
import { calendarPath, createToken, revokeToken } from "./tokens";

const NOT_CONFIGURED: FormState = {
  status: "error",
  message: "The database is not set up on this copy of Grant Desk yet. See docs/DEPLOY.md.",
};
const READ_ONLY: FormState = {
  status: "error",
  message: "Only an owner, admin or editor of this organization can change the calendar.",
};

type Editor = { db: Db; organizationId: string; userId: string };

async function requireEditor(): Promise<Editor | FormState> {
  const { user, active } = await requireActiveOrganization();
  if (!canEdit(active.role)) return READ_ONLY;
  const db = await userDb();
  if (!db) return NOT_CONFIGURED;
  return { db, organizationId: active.id, userId: user.id };
}

function isFormState(value: Editor | FormState): value is FormState {
  return "status" in value;
}

function text(formData: FormData, field: string, max = 500): string {
  return String(formData.get(field) ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Subscribe to an outside iCal or RSS feed: a preset, or any address typed in. Fetched at once. */
export async function subscribeFeed(_prev: FormState, formData: FormData): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;

  const presetId = text(formData, "preset", 40);
  const preset = FEED_PRESETS.find((p) => p.id === presetId);
  const rawUrl = preset?.url ?? text(formData, "url", 2000);
  const kind = preset?.kind ?? (text(formData, "kind", 10) === "rss" ? "rss" : "ical");
  const name = text(formData, "name", 200) || preset?.name || "";
  const checked = checkFeedUrl(rawUrl);
  if (!checked.ok) return { status: "error", message: checked.message };
  if (name === "") return { status: "error", message: "Give the feed a name." };

  try {
    const feed = await addFeed(editor.db, {
      organization_id: editor.organizationId,
      name,
      kind,
      url: checked.url,
    });
    const result = await refreshFeed(editor.db, feed);
    revalidatePath("/calendar");
    if (result.status === "error") {
      return {
        status: "error",
        message: `Subscribed, but the first fetch failed: ${result.message}. It will be tried again.`,
      };
    }
    const count = feed.kind === "ical" ? `${result.events} dates` : `${result.items} items`;
    return { status: "success", message: `Subscribed. ${count} loaded from ${name}.` };
  } catch (error) {
    console.error("subscribeFeed failed", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "We could not add the feed. Try again.",
    };
  }
}

export async function refreshAllFeeds(): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  try {
    const feeds = (await listFeeds(editor.db, editor.organizationId)).filter((f) => f.enabled);
    let failed = 0;
    for (const feed of feeds) {
      const result = await refreshFeed(editor.db, feed);
      if (result.status === "error") failed += 1;
    }
    revalidatePath("/calendar");
    if (feeds.length === 0) return { status: "success", message: "No feeds to refresh." };
    return failed
      ? {
          status: "error",
          message: `${failed} of ${feeds.length} feeds could not be read. See each feed's status.`,
        }
      : {
          status: "success",
          message: `Refreshed ${feeds.length} feed${feeds.length === 1 ? "" : "s"}.`,
        };
  } catch (error) {
    console.error("refreshAllFeeds failed", error);
    return { status: "error", message: "We could not refresh the feeds. Try again." };
  }
}

export async function unsubscribeFeed(feedId: string): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  try {
    await removeFeed(editor.db, editor.organizationId, feedId);
  } catch (error) {
    console.error("unsubscribeFeed failed", error);
    return { status: "error", message: "We could not remove the feed. Try again." };
  }
  revalidatePath("/calendar");
  return { status: "success", message: "Removed, with the dates it had added." };
}

/** Makes the organization's iCal address. The address is returned once and never shown again. */
export async function createCalendarAddress(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  const label = text(formData, "label", 200) || null;
  try {
    const token = await createToken(editor.db, editor.organizationId, label);
    const origin = await getRequestOrigin();
    revalidatePath("/calendar");
    return { status: "success", message: `${origin}${calendarPath(token)}` };
  } catch (error) {
    console.error("createCalendarAddress failed", error);
    return { status: "error", message: "We could not create the address. Try again." };
  }
}

export async function revokeCalendarAddress(tokenId: string): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  try {
    await revokeToken(editor.db, editor.organizationId, tokenId);
  } catch (error) {
    console.error("revokeCalendarAddress failed", error);
    return { status: "error", message: "We could not revoke the address. Try again." };
  }
  revalidatePath("/calendar");
  return { status: "success", message: "Revoked. Calendar apps using it stop getting updates." };
}

/** Every member sets their own reminder preference, viewers included. */
export async function updateReminderMode(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, active } = await requireActiveOrganization();
  const db = await userDb();
  if (!db) return NOT_CONFIGURED;
  const mode = text(formData, "mode", 10);
  if (mode !== "each" && mode !== "digest" && mode !== "off") {
    return { status: "error", message: "Pick one of the reminder options." };
  }
  try {
    await saveReminderMode(db, active.id, user.id, mode);
  } catch (error) {
    console.error("updateReminderMode failed", error);
    return { status: "error", message: "We could not save the setting. Try again." };
  }
  revalidatePath("/calendar");
  return { status: "success", message: "Saved." };
}
