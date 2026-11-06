import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listCalendarItems } from "@/lib/calendar/events";
import { refreshFeed } from "@/lib/calendar/feeds";
import type { Database } from "@/lib/db/types";
import { pickReminders, reminderText, sentKey, type DueReminder } from "./reminders";
import { emailConfigured, sendEmail } from "./resend";

/**
 * One reminder run, for every organization. Called by the cron route with the service-key client
 * after the cron secret was checked. Order per organization: refresh its enabled outside feeds,
 * load the next 31 days, then for each member with reminders on, send what is due and log only
 * what the mail provider accepted.
 */

type Client = SupabaseClient<Database>;

export type RunSummary = {
  ranAt: string;
  emailConfigured: boolean;
  organizations: number;
  feedsRefreshed: number;
  feedsFailed: number;
  people: number;
  remindersDue: number;
  emailsSent: number;
  emailsSkipped: number;
  emailsFailed: number;
  notes: string[];
};

const WINDOW_DAYS = 31;
const MAX_FEEDS_PER_RUN = 200;

export async function runReminders(
  admin: Client,
  options: { now?: Date; appOrigin: string },
): Promise<RunSummary> {
  const now = options.now ?? new Date();
  const summary: RunSummary = {
    ranAt: now.toISOString(),
    emailConfigured: emailConfigured(),
    organizations: 0,
    feedsRefreshed: 0,
    feedsFailed: 0,
    people: 0,
    remindersDue: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    emailsFailed: 0,
    notes: [],
  };
  if (!summary.emailConfigured) {
    summary.notes.push(
      "Email is not configured (RESEND_API_KEY, EMAIL_FROM): reminders are counted, not sent.",
    );
  }

  // Outside feeds first, so new dates are in this run.
  const { data: feeds, error: feedsError } = await admin
    .from("external_feeds")
    .select("*")
    .eq("enabled", true)
    .order("last_fetched_at", { ascending: true, nullsFirst: true })
    .limit(MAX_FEEDS_PER_RUN);
  if (feedsError) summary.notes.push(`Could not list feeds: ${feedsError.message}`);
  for (const feed of feeds ?? []) {
    const result = await refreshFeed(admin, feed);
    if (result.status === "ok") summary.feedsRefreshed += 1;
    else summary.feedsFailed += 1;
  }

  const { data: organizations, error: orgError } = await admin
    .from("organizations")
    .select("id, name");
  if (orgError) {
    summary.notes.push(`Could not list organizations: ${orgError.message}`);
    return summary;
  }
  const calendarUrl = `${options.appOrigin}/calendar`;
  const window = { from: now, to: new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000) };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    let items;
    try {
      items = await listCalendarItems(admin, organization.id, window);
    } catch (error) {
      summary.notes.push(
        `${organization.id}: ${error instanceof Error ? error.message : "calendar failed"}`,
      );
      continue;
    }
    if (items.length === 0) continue;

    const [{ data: members }, { data: preferences }] = await Promise.all([
      admin.from("memberships").select("user_id").eq("organization_id", organization.id),
      admin
        .from("reminder_preferences")
        .select("user_id, mode")
        .eq("organization_id", organization.id),
    ]);
    const mode = new Map((preferences ?? []).map((p) => [p.user_id, p.mode]));
    const userIds = (members ?? []).map((m) => m.user_id);
    if (userIds.length === 0) continue;
    const [{ data: profiles }, { data: log }] = await Promise.all([
      admin.from("profiles").select("id, email").in("id", userIds),
      admin
        .from("reminder_log")
        .select("user_id, item_key, days_before")
        .eq("organization_id", organization.id)
        .in("user_id", userIds),
    ]);
    const email = new Map((profiles ?? []).map((p) => [p.id, p.email]));
    const sentByUser = new Map<string, Set<string>>();
    for (const row of log ?? []) {
      const set = sentByUser.get(row.user_id) ?? new Set<string>();
      set.add(sentKey(row.item_key, row.days_before));
      sentByUser.set(row.user_id, set);
    }

    for (const userId of userIds) {
      const userMode = mode.get(userId) ?? "digest";
      const to = email.get(userId);
      if (userMode === "off" || !to) continue;
      summary.people += 1;
      const due = pickReminders(items, sentByUser.get(userId) ?? new Set(), now);
      if (due.length === 0) continue;
      summary.remindersDue += due.length;
      const batches: DueReminder[][] = userMode === "each" ? due.map((d) => [d]) : [due];
      for (const batch of batches) {
        const message = reminderText(organization.name, batch, calendarUrl);
        const result = await sendEmail({ to, subject: message.subject, text: message.text });
        if (result.status === "sent") {
          summary.emailsSent += 1;
          const { error } = await admin.from("reminder_log").insert(
            batch.map((r) => ({
              organization_id: organization.id,
              user_id: userId,
              item_key: r.item.key,
              days_before: r.step,
              provider_message_id: result.id,
            })),
          );
          if (error) summary.notes.push(`reminder_log insert failed: ${error.message}`);
        } else if (result.status === "skipped") {
          summary.emailsSkipped += 1;
        } else {
          summary.emailsFailed += 1;
          summary.notes.push(`send failed for one person in ${organization.name}: ${result.error}`);
        }
      }
    }
  }
  return summary;
}
