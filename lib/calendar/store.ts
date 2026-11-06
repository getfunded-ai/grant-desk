import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Tables } from "@/lib/db/types";

type Client = SupabaseClient<Database>;

export type FeedItem = Tables<"feed_items">;
export type ReminderMode = Enums<"reminder_mode">;

export async function listFeeds(
  db: Client,
  organizationId: string,
): Promise<Tables<"external_feeds">[]> {
  const { data, error } = await db
    .from("external_feeds")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) throw new Error(`Could not load the feeds: ${error.message}`);
  return data ?? [];
}

export async function addFeed(
  db: Client,
  values: { organization_id: string; name: string; kind: Enums<"feed_kind">; url: string },
): Promise<Tables<"external_feeds">> {
  const { data, error } = await db.from("external_feeds").insert(values).select("*").single();
  if (error) {
    if (error.code === "23505")
      throw new Error("This organization already subscribes to that address.");
    throw new Error(`Could not add the feed: ${error.message}`);
  }
  return data;
}

export async function removeFeed(
  db: Client,
  organizationId: string,
  feedId: string,
): Promise<void> {
  const { data, error } = await db
    .from("external_feeds")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", feedId)
    .select("id");
  if (error) throw new Error(`Could not remove the feed: ${error.message}`);
  if (!data?.length) throw new Error("Could not remove the feed: nothing was removed");
}

export async function listFeedItems(
  db: Client,
  organizationId: string,
  limit = 20,
): Promise<FeedItem[]> {
  const { data, error } = await db
    .from("feed_items")
    .select("*")
    .eq("organization_id", organizationId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`Could not load the feed news: ${error.message}`);
  return data ?? [];
}

export async function getReminderMode(
  db: Client,
  organizationId: string,
  userId: string,
): Promise<ReminderMode | null> {
  const { data, error } = await db
    .from("reminder_preferences")
    .select("mode")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the reminder setting: ${error.message}`);
  return data?.mode ?? null;
}

export async function setReminderMode(
  db: Client,
  organizationId: string,
  userId: string,
  mode: ReminderMode,
): Promise<void> {
  const { error } = await db
    .from("reminder_preferences")
    .upsert(
      { organization_id: organizationId, user_id: userId, mode },
      { onConflict: "organization_id,user_id" },
    );
  if (error) throw new Error(`Could not save the reminder setting: ${error.message}`);
}

export async function listRecentReminders(
  db: Client,
  organizationId: string,
  userId: string,
  limit = 10,
): Promise<Tables<"reminder_log">[]> {
  const { data, error } = await db
    .from("reminder_log")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load the reminders sent: ${error.message}`);
  return data ?? [];
}
