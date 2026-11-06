import Link from "next/link";
import {
  CalendarAddressForm,
  FeedButtons,
  FeedForm,
  RefreshFeedsButton,
  ReminderForm,
  RevokeButton,
} from "@/components/calendar/calendar-forms";
import { MonthGrid } from "@/components/calendar/month-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveOrganization } from "@/lib/auth/session";
import { listCalendarItems } from "@/lib/calendar/events";
import {
  getReminderMode,
  listFeedItems,
  listFeeds,
  listRecentReminders,
} from "@/lib/calendar/store";
import { listTokens } from "@/lib/calendar/tokens";
import { userDb } from "@/lib/pipeline/client";
import { daysFromNow, describeDueIn, formatDateTime } from "@/lib/pipeline/format";
import { canEdit } from "@/lib/pipeline/permissions";

export const metadata = { title: "Calendar · Grant Desk" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { user, active } = await requireActiveOrganization();
  const { month: wanted } = await searchParams;
  const now = new Date();
  const match = wanted ? /^(\d{4})-(\d{2})$/.exec(wanted) : null;
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month =
    match && Number(match[2]) >= 1 && Number(match[2]) <= 12
      ? Number(match[2])
      : now.getUTCMonth() + 1;
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  const editor = canEdit(active.role);

  const db = await userDb();
  const [items, upcoming, feeds, news, tokens, mode, sent] = db
    ? await Promise.all([
        listCalendarItems(db, active.id, { from: monthStart, to: monthEnd }),
        listCalendarItems(db, active.id, {
          from: now,
          to: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        }),
        listFeeds(db, active.id),
        listFeedItems(db, active.id, 15),
        listTokens(db, active.id),
        getReminderMode(db, active.id, user.id),
        listRecentReminders(db, active.id, user.id),
      ])
    : [[], [], [], [], [], null, []];

  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthName = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthStart);
  const activeTokens = tokens.filter((t) => !t.revoked_at);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <nav aria-label="Month" className="ml-auto flex items-center gap-2 text-sm">
          <Link
            href={`/calendar?month=${prev}`}
            className="rounded-md border px-2 py-1 hover:bg-accent"
          >
            ← Previous
          </Link>
          <span className="min-w-36 text-center font-medium">{monthName}</span>
          <Link
            href={`/calendar?month=${next}`}
            className="rounded-md border px-2 py-1 hover:bg-accent"
          >
            Next →
          </Link>
          <Link href="/calendar" className="text-muted-foreground hover:text-foreground">
            Today
          </Link>
        </nav>
      </div>

      <MonthGrid year={year} month={month} items={items} today={now.toISOString().slice(0, 10)} />
      <p className="text-xs text-muted-foreground">
        Grant dates, key dates, open tasks and outside feeds. Times are shown in the zone they were
        stated in; a date without a zone is read as UTC.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Next 60 days</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due in the next 60 days.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {upcoming.slice(0, 30).map((item) => (
                  <li key={item.key} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {item.grantId ? (
                        <Link
                          href={`/grants/${item.grantId}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                      <span className="block text-xs text-muted-foreground">{item.source}</span>
                    </span>
                    <span className="text-right text-muted-foreground">
                      {formatDateTime(item.at, item.timeZone, item.allDay)}
                      <span className="block text-xs">
                        {describeDueIn(daysFromNow(item.at, now))}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your calendar app</CardTitle>
            <CardDescription>
              Subscribe once and every date here shows up in Google Calendar, Apple Calendar or
              Outlook. Anyone with the address can read the dates, so treat it like a password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeTokens.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {activeTokens.map((token) => (
                  <li key={token.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {token.label ?? "Calendar address"}
                      <span className="block text-xs text-muted-foreground">
                        Created {formatDateTime(token.created_at)}. The address was shown once, when
                        it was made.
                      </span>
                    </span>
                    {editor ? <RevokeButton tokenId={token.id} /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No calendar address yet.</p>
            )}
            {editor ? <CalendarAddressForm /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outside feeds</CardTitle>
            <CardDescription>
              Dates and news from funders and agencies. Start with the DOE SBIR/STTR Application
              Hub, or paste any iCal or RSS address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {feeds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outside feeds yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {feeds.map((feed) => (
                  <li key={feed.id} className="flex flex-wrap items-start justify-between gap-2">
                    <span>
                      {feed.name}
                      <span className="text-muted-foreground">
                        {" "}
                        · {feed.kind === "ical" ? "iCal" : "RSS"}
                      </span>
                      <span className="block text-xs text-muted-foreground break-all">
                        {feed.url}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {feed.last_fetched_at
                          ? `Last read ${formatDateTime(feed.last_fetched_at)}: ${feed.last_status ?? "unknown"}${feed.last_error ? ` (${feed.last_error})` : ""}`
                          : "Not read yet"}
                      </span>
                    </span>
                    {editor ? <FeedButtons feedId={feed.id} /> : null}
                  </li>
                ))}
              </ul>
            )}
            {editor && feeds.length > 0 ? <RefreshFeedsButton /> : null}
            {editor ? <FeedForm /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feed news</CardTitle>
            <CardDescription>The latest items from the RSS feeds you follow.</CardDescription>
          </CardHeader>
          <CardContent>
            {news.length === 0 ? (
              <p className="text-sm text-muted-foreground">No news items yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {news.map((item) => (
                  <li key={item.id}>
                    {item.link ? (
                      <a href={item.link} rel="noreferrer" className="underline underline-offset-4">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {item.published_at ? formatDateTime(item.published_at) : "Date not stated"}
                    </span>
                    {item.summary ? (
                      <span className="block text-xs text-muted-foreground line-clamp-2">
                        {item.summary}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reminder emails</CardTitle>
            <CardDescription>
              Sent to {user.email ?? "your account"} at 30, 14, 7 and 1 days before each date on
              this calendar. Your choice, for this organization only.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <ReminderForm mode={mode ?? "digest"} />
            <div className="text-sm">
              <p className="font-medium">Sent to you lately</p>
              {sent.length === 0 ? (
                <p className="text-muted-foreground">
                  Nothing yet. Reminders go out once the maintainer turns email on (human step H-4).
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  {sent.map((row) => (
                    <li key={row.id}>
                      {formatDateTime(row.sent_at)}: {row.item_key} ({row.days_before} days before)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
