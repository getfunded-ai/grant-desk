import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/db/types";
import { parseICalendar } from "./ical-parse";
import { parseFeed } from "./rss-parse";

/**
 * Fetching an outside feed and writing what it says into the organization's own rows:
 * iCal events become deadlines (external_feed_id + external_uid, so a refresh updates in place),
 * RSS or Atom items become feed_items. The feed's own status is written to external_feeds.
 */

type Client = SupabaseClient<Database>;
export type Feed = Tables<"external_feeds">;

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000;
const USER_AGENT = "GrantDesk/0.1 (+https://getfunded.ai)";

export type RefreshResult =
  | { status: "ok"; events: number; items: number; skipped: number }
  | { status: "error"; message: string };

/** Only public http(s) addresses; never a private network, so the server cannot be pointed inward. */
export function checkFeedUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; message: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, message: "Enter a full address starting with https://." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, message: "Only http and https addresses can be subscribed." };
  }
  if (url.username || url.password) {
    return { ok: false, message: "Addresses with a password in them are not accepted." };
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".") ||
    isPrivateAddress(host)
  ) {
    return { ok: false, message: "That address is not on the public internet." };
  }
  return { ok: true, url: url.toString().slice(0, 2000) };
}

function isPrivateAddress(host: string): boolean {
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const bare = host.replace(/^\[|\]$/g, "");
  return bare.includes(":") && (bare === "::1" || /^(fc|fd|fe80)/i.test(bare) || bare === "::");
}

export async function fetchFeedText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept:
        "text/calendar, application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`The feed answered ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > MAX_BYTES) throw new Error("The feed is larger than 2 MB");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) throw new Error("The feed is larger than 2 MB");
  return new TextDecoder("utf-8").decode(buffer);
}

/** Fetch one feed and write its contents. Returns what happened; never throws. */
export async function refreshFeed(db: Client, feed: Feed): Promise<RefreshResult> {
  const checked = checkFeedUrl(feed.url);
  if (!checked.ok)
    return await recordStatus(db, feed, { status: "error", message: checked.message });
  let result: RefreshResult;
  try {
    const text = await fetchFeedText(checked.url);
    result =
      feed.kind === "ical" ? await writeEvents(db, feed, text) : await writeItems(db, feed, text);
  } catch (error) {
    result = { status: "error", message: shortError(error) };
  }
  return recordStatus(db, feed, result);
}

async function writeEvents(db: Client, feed: Feed, text: string): Promise<RefreshResult> {
  const calendar = parseICalendar(text);
  if (calendar.events.length === 0 && calendar.skipped === 0 && !/BEGIN:VCALENDAR/i.test(text)) {
    return { status: "error", message: "This address is not an iCal calendar" };
  }
  const rows = calendar.events.map((event) => ({
    organization_id: feed.organization_id,
    external_feed_id: feed.id,
    external_uid: event.uid,
    title: event.summary,
    kind: "other" as const,
    due_at: event.start.toISOString(),
    all_day: event.allDay,
    time_zone: event.timeZone,
    notes: [event.description, event.url].filter(Boolean).join("\n") || null,
  }));
  if (rows.length > 0) {
    const { error } = await db
      .from("deadlines")
      .upsert(rows, { onConflict: "external_feed_id,external_uid" });
    if (error) return { status: "error", message: `Could not save the events: ${error.message}` };
  }
  return { status: "ok", events: rows.length, items: 0, skipped: calendar.skipped };
}

async function writeItems(db: Client, feed: Feed, text: string): Promise<RefreshResult> {
  const parsed = parseFeed(text);
  if (parsed.items.length === 0 && !/<(rss|feed)[\s>]/i.test(text)) {
    return { status: "error", message: "This address is not an RSS or Atom feed" };
  }
  const rows = parsed.items.map((item) => ({
    organization_id: feed.organization_id,
    external_feed_id: feed.id,
    external_uid: item.uid,
    title: item.title,
    link: item.link,
    summary: item.summary,
    published_at: item.publishedAt ? item.publishedAt.toISOString() : null,
  }));
  if (rows.length > 0) {
    const { error } = await db
      .from("feed_items")
      .upsert(rows, { onConflict: "external_feed_id,external_uid" });
    if (error) return { status: "error", message: `Could not save the items: ${error.message}` };
  }
  return { status: "ok", events: 0, items: rows.length, skipped: 0 };
}

async function recordStatus(db: Client, feed: Feed, result: RefreshResult): Promise<RefreshResult> {
  const summary =
    result.status === "ok"
      ? feed.kind === "ical"
        ? `${result.events} event${result.events === 1 ? "" : "s"}${result.skipped ? `, ${result.skipped} skipped` : ""}`
        : `${result.items} item${result.items === 1 ? "" : "s"}`
      : "failed";
  const { error } = await db
    .from("external_feeds")
    .update({
      last_fetched_at: new Date().toISOString(),
      last_status: summary,
      last_error: result.status === "error" ? result.message.slice(0, 500) : null,
    })
    .eq("organization_id", feed.organization_id)
    .eq("id", feed.id);
  if (error)
    console.error("external_feeds status update failed", { feed: feed.id, error: error.message });
  return result;
}

function shortError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError")
      return "The feed took too long to answer";
    return error.message.slice(0, 300);
  }
  return "Unknown error";
}
