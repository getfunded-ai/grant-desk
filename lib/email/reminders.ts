/**
 * Pure reminder arithmetic. Reminders go out 30, 14, 7 and 1 days before a date. A run that was
 * missed (the cron did not fire) is caught up: an item 20 days out whose 30-day reminder never went
 * gets it now, worded with the real number of days.
 */

export const REMINDER_STEPS = [30, 14, 7, 1] as const;
export type ReminderStep = (typeof REMINDER_STEPS)[number];

export type ReminderItem = {
  key: string;
  title: string;
  at: Date;
  allDay: boolean;
  timeZone: string | null;
  grantTitle: string | null;
  source: string;
};

export type DueReminder = { item: ReminderItem; step: ReminderStep; daysLeft: number };

/** Whole calendar days (UTC) from now to the item. */
export function daysLeft(at: Date, now: Date): number {
  const day = 24 * 60 * 60 * 1000;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const then = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return Math.round((then - today) / day);
}

/** The step an item is in today: the smallest step that is at least daysLeft; none past 30 or overdue. */
export function stepFor(days: number): ReminderStep | null {
  if (days < 0 || days > 30) return null;
  let chosen: ReminderStep | null = null;
  for (const step of REMINDER_STEPS) {
    if (step >= days) chosen = step;
  }
  return chosen;
}

/** Which reminders a person should get now, given the (item key, step) pairs already sent to them. */
export function pickReminders(
  items: ReminderItem[],
  alreadySent: ReadonlySet<string>,
  now: Date,
): DueReminder[] {
  const due: DueReminder[] = [];
  for (const item of items) {
    const days = daysLeft(item.at, now);
    const step = stepFor(days);
    if (step === null) continue;
    if (alreadySent.has(sentKey(item.key, step))) continue;
    due.push({ item, step, daysLeft: days });
  }
  return due.sort((a, b) => a.item.at.getTime() - b.item.at.getTime());
}

export function sentKey(itemKey: string, step: number): string {
  return `${itemKey}#${step}`;
}

export function describeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** The plain-text body of one reminder or of a digest. No HTML, nothing to track. */
export function reminderText(
  organizationName: string,
  reminders: DueReminder[],
  calendarUrl: string,
): { subject: string; text: string } {
  const lines = reminders.map((r) => {
    const when = formatWhen(r.item.at, r.item.timeZone, r.item.allDay);
    const grant = r.item.grantTitle ? ` (${r.item.grantTitle})` : "";
    return `- ${r.item.title}${grant}: ${when}, ${describeDays(r.daysLeft)}. Source: ${r.item.source}.`;
  });
  const first = reminders[0];
  const subject =
    reminders.length === 1
      ? `Reminder: ${first.item.title} is due ${describeDays(first.daysLeft)}`
      : `${reminders.length} grant dates coming up for ${organizationName}`;
  const text = [
    `Grant Desk reminder for ${organizationName}.`,
    "",
    ...lines,
    "",
    `Calendar: ${calendarUrl}`,
    "",
    "You get this because of your reminder setting on the calendar page, where you can change it.",
  ].join("\n");
  return { subject, text };
}

export function formatWhen(at: Date, timeZone: string | null, allDay: boolean): string {
  const zone = timeZone ?? "UTC";
  try {
    if (allDay) {
      return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: zone }).format(at);
    }
    // dateStyle cannot be mixed with timeZoneName, so the parts are listed one by one.
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: zone,
      timeZoneName: "short",
    }).format(at);
  } catch {
    return at.toISOString();
  }
}
