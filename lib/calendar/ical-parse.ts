import { isValidTimeZone, zonedToUtc } from "./tz";

/**
 * A small RFC 5545 reader for the feeds grant seekers subscribe to (agency and hub calendars).
 * Pure: no network, no database. Recurring events are read once, at their first date; the feeds
 * this is for publish deadlines and office hours, not repeating series.
 */

export type ParsedEvent = {
  uid: string;
  summary: string;
  description: string | null;
  url: string | null;
  start: Date;
  allDay: boolean;
  /** The IANA zone the feed stated, when it stated one this runtime knows. */
  timeZone: string | null;
};

export type ParsedCalendar = {
  name: string | null;
  events: ParsedEvent[];
  /** Events skipped because they had no UID or no readable start. */
  skipped: number;
};

type Property = { name: string; params: Record<string, string>; value: string };

export function parseICalendar(text: string): ParsedCalendar {
  const lines = unfold(text);
  let name: string | null = null;
  const events: ParsedEvent[] = [];
  let skipped = 0;
  let current: Property[] | null = null;

  for (const line of lines) {
    const property = parseProperty(line);
    if (!property) continue;
    if (property.name === "BEGIN" && property.value.toUpperCase() === "VEVENT") {
      current = [];
      continue;
    }
    if (property.name === "END" && property.value.toUpperCase() === "VEVENT") {
      if (current) {
        const event = toEvent(current);
        if (event) events.push(event);
        else skipped += 1;
      }
      current = null;
      continue;
    }
    if (current) current.push(property);
    else if (property.name === "X-WR-CALNAME") name = unescapeText(property.value) || null;
  }
  return { name, events, skipped };
}

/** Joins folded lines: a line starting with a space or tab continues the one before. */
export function unfold(text: string): string[] {
  const raw = text.replace(/\r\n?/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines.filter((line) => line.length > 0);
}

export function parseProperty(line: string): Property | null {
  // Name and parameters end at the first ":" outside double quotes.
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ":" && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = splitOutsideQuotes(head, ";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

function splitOutsideQuotes(text: string, separator: string): string[] {
  const parts: string[] = [];
  let inQuotes = false;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '"') inQuotes = !inQuotes;
    else if (text[i] === separator && !inQuotes) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

export function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function toEvent(properties: Property[]): ParsedEvent | null {
  const get = (name: string) => properties.find((p) => p.name === name);
  const uid = get("UID")?.value.trim();
  const start = get("DTSTART");
  if (!uid || !start) return null;
  const when = parseDateTime(start.value, start.params);
  if (!when) return null;
  const summary = unescapeText(get("SUMMARY")?.value ?? "") || "(untitled)";
  const description = unescapeText(get("DESCRIPTION")?.value ?? "") || null;
  const url = get("URL")?.value.trim() || null;
  return {
    uid: uid.slice(0, 2000),
    summary: summary.slice(0, 500),
    description: description ? description.slice(0, 5000) : null,
    url: url && /^https?:\/\//i.test(url) ? url.slice(0, 2000) : null,
    start: when.date,
    allDay: when.allDay,
    timeZone: when.timeZone,
  };
}

/**
 * DTSTART forms: 20261216 (a date), 20261216T140000Z (UTC), 20261216T140000 with TZID=zone, or a
 * floating time (read as UTC, the zone left unknown).
 */
export function parseDateTime(
  value: string,
  params: Record<string, string> = {},
): { date: Date; allDay: boolean; timeZone: string | null } | null {
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (dateOnly || params.VALUE === "DATE") {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(trimmed);
    if (!m) return null;
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return Number.isNaN(date.getTime()) ? null : { date, allDay: true, timeZone: null };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(trimmed);
  if (!m) return null;
  const parts = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: Number(m[6] ?? "0"),
  };
  if (m[7] === "Z") {
    const date = new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
    );
    return Number.isNaN(date.getTime()) ? null : { date, allDay: false, timeZone: null };
  }
  const zone = params.TZID && isValidTimeZone(params.TZID) ? params.TZID : null;
  const date = zone
    ? zonedToUtc(parts, zone)
    : new Date(
        Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
      );
  return Number.isNaN(date.getTime()) ? null : { date, allDay: false, timeZone: zone };
}
