import { NextResponse } from "next/server";
import { buildICalendar } from "@/lib/calendar/ical-build";
import { listCalendarItems } from "@/lib/calendar/events";
import { isTokenShaped, resolveToken } from "@/lib/calendar/tokens";
import { createAdminClient } from "@/lib/db/admin";

/**
 * The organization's own iCal feed, for Google Calendar, Apple Calendar or Outlook. The token in
 * the address is the whole check: it is random, stored only as a hash, and revocable from the
 * calendar page. A wrong or revoked token answers 404 either way.
 */

const PAST_DAYS = 90;
const FUTURE_DAYS = 400;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  if (!isTokenShaped(token)) return notFound();

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "The database is not configured" }, { status: 503 });
  }
  const owner = await resolveToken(admin, token);
  if (!owner) return notFound();

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  let items;
  try {
    items = await listCalendarItems(admin, owner.organizationId, {
      from: new Date(now.getTime() - PAST_DAYS * day),
      to: new Date(now.getTime() + FUTURE_DAYS * day),
    });
  } catch (error) {
    console.error("ical feed failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not build the calendar" }, { status: 500 });
  }

  const body = buildICalendar(
    `${owner.organizationName} · Grant Desk`,
    items.map((item) => ({
      uid: `${item.key}@grant-desk`,
      summary: item.title,
      description: [item.source, item.grantTitle, item.notes].filter(Boolean).join("\n") || null,
      url: item.url,
      start: item.at,
      allDay: item.allDay,
    })),
    now,
  );
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="grant-desk.ics"',
      "cache-control": "private, max-age=300",
      "x-robots-tag": "noindex",
    },
  });
}

function notFound(): NextResponse {
  return new NextResponse("Not found", { status: 404, headers: { "cache-control": "no-store" } });
}
