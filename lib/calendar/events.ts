import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { isEndOfDayUtc } from "@/lib/pipeline/format";
import { STAGES_BEFORE_DECISION, stageLabel } from "@/lib/pipeline/stages";
import { dateInZone } from "./tz";

/**
 * Everything that belongs on the organization's calendar, from four places: deadlines (by hand or
 * from an outside feed, including the report dates Phase G writes), open tasks with a due date, and
 * the dates on the grant itself. Works with the person's client or, for the feed route and the
 * cron, the service-key client, which the caller has already checked.
 */

type Client = SupabaseClient<Database>;

export type CalendarItem = {
  /** Stable across refreshes: "deadline:<id>", "task:<id>", "grant_due:<id>", "grant_decision:<id>"… */
  key: string;
  title: string;
  at: Date;
  allDay: boolean;
  timeZone: string | null;
  kind: "deadline" | "task" | "grant" | "feed";
  grantId: string | null;
  grantTitle: string | null;
  /** Where the item came from, for the label on the calendar. */
  source: string;
  url: string | null;
  notes: string | null;
};

export type CalendarWindow = { from: Date; to: Date };

export async function listCalendarItems(
  db: Client,
  organizationId: string,
  window: CalendarWindow,
): Promise<CalendarItem[]> {
  const from = window.from.toISOString();
  const to = window.to.toISOString();
  const fromDate = from.slice(0, 10);
  const toDate = to.slice(0, 10);

  const [deadlines, tasks, grants, feeds] = await Promise.all([
    db
      .from("deadlines")
      .select("id, grant_id, external_feed_id, title, kind, due_at, all_day, time_zone, notes")
      .eq("organization_id", organizationId)
      .gte("due_at", from)
      .lte("due_at", to)
      .order("due_at"),
    db
      .from("tasks")
      .select("id, grant_id, title, due_date, status")
      .eq("organization_id", organizationId)
      .eq("status", "open")
      .gte("due_date", fromDate)
      .lte("due_date", toDate)
      .order("due_date"),
    db
      .from("grants")
      .select("id, title, stage, preset, submission_due_at, decision_date, award_end_date")
      .eq("organization_id", organizationId),
    db.from("external_feeds").select("id, name").eq("organization_id", organizationId),
  ]);
  for (const result of [deadlines, tasks, grants, feeds]) {
    if (result.error) throw new Error(`Could not load the calendar: ${result.error.message}`);
  }

  const grantTitle = new Map((grants.data ?? []).map((g) => [g.id, g.title]));
  const feedName = new Map((feeds.data ?? []).map((f) => [f.id, f.name]));
  const items: CalendarItem[] = [];

  for (const d of deadlines.data ?? []) {
    items.push({
      key: `deadline:${d.id}`,
      title: d.title,
      at: new Date(d.due_at),
      allDay: d.all_day,
      timeZone: d.time_zone,
      kind: d.external_feed_id ? "feed" : "deadline",
      grantId: d.grant_id,
      grantTitle: d.grant_id ? (grantTitle.get(d.grant_id) ?? null) : null,
      source: d.external_feed_id
        ? (feedName.get(d.external_feed_id) ?? "Outside feed")
        : `${DEADLINE_KIND_LABELS[d.kind]} deadline`,
      url: null,
      notes: d.notes,
    });
  }

  for (const t of tasks.data ?? []) {
    if (!t.due_date) continue;
    items.push({
      key: `task:${t.id}`,
      title: t.title,
      at: new Date(`${t.due_date}T00:00:00Z`),
      allDay: true,
      timeZone: null,
      kind: "task",
      grantId: t.grant_id,
      grantTitle: t.grant_id ? (grantTitle.get(t.grant_id) ?? null) : null,
      source: "Task",
      url: null,
      notes: null,
    });
  }

  for (const g of grants.data ?? []) {
    if (g.submission_due_at && STAGES_BEFORE_DECISION.includes(g.stage)) {
      const at = new Date(g.submission_due_at);
      if (at >= window.from && at <= window.to) {
        items.push({
          key: `grant_due:${g.id}`,
          title: `${g.title}: submission due`,
          at,
          allDay: isEndOfDayUtc(at),
          timeZone: null,
          kind: "grant",
          grantId: g.id,
          grantTitle: g.title,
          source: `Grant (${stageLabel(g.stage, g.preset)})`,
          url: null,
          notes: null,
        });
      }
    }
    for (const [field, label] of [
      ["decision_date", "decision expected"],
      ["award_end_date", "award period ends"],
    ] as const) {
      const value = g[field];
      if (value && value >= fromDate && value <= toDate) {
        items.push({
          key: `grant_${field}:${g.id}`,
          title: `${g.title}: ${label}`,
          at: new Date(`${value}T00:00:00Z`),
          allDay: true,
          timeZone: null,
          kind: "grant",
          grantId: g.id,
          grantTitle: g.title,
          source: "Grant",
          url: null,
          notes: null,
        });
      }
    }
  }

  return items.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export const DEADLINE_KIND_LABELS: Record<Database["public"]["Enums"]["deadline_kind"], string> = {
  loi: "Letter of intent",
  application: "Application",
  report: "Report",
  internal: "Internal",
  other: "Other",
};

/** The calendar day an item belongs to: its stated zone when it has one, otherwise UTC. */
export function itemDay(item: CalendarItem): string {
  if (item.allDay || !item.timeZone) return item.at.toISOString().slice(0, 10);
  return dateInZone(item.at, item.timeZone);
}
