"use client";

import { useActionState, useState, useTransition } from "react";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/auth/actions";
import {
  createCalendarAddress,
  refreshAllFeeds,
  revokeCalendarAddress,
  subscribeFeed,
  unsubscribeFeed,
  updateReminderMode,
} from "@/lib/calendar/actions";
import { FEED_PRESETS } from "@/lib/calendar/presets";

export function FeedForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(subscribeFeed, {
    status: "idle",
  });
  const [preset, setPreset] = useState<string>(FEED_PRESETS[0].id);
  const custom = preset === "custom";
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="feed-preset">Feed</Label>
        <select
          id="feed-preset"
          name="preset"
          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          value={preset}
          onChange={(event) => setPreset(event.target.value)}
        >
          {FEED_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="custom">Another iCal or RSS address…</option>
        </select>
      </div>
      {custom ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <div className="space-y-1">
            <Label htmlFor="feed-url">Address</Label>
            <Input
              id="feed-url"
              name="url"
              type="url"
              required
              placeholder="https://…"
              maxLength={2000}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="feed-kind">Kind</Label>
            <select
              id="feed-kind"
              name="kind"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              defaultValue="ical"
            >
              <option value="ical">iCal</option>
              <option value="rss">RSS / Atom</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="feed-name">Name</Label>
            <Input
              id="feed-name"
              name="name"
              required
              maxLength={200}
              placeholder="Who publishes it"
            />
          </div>
        </div>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Subscribing…" : "Subscribe"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

export function FeedButtons({ feedId }: { feedId: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({ status: "idle" });
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Remove this feed and the dates it added to the calendar?")) return;
          startTransition(async () => setState(await unsubscribeFeed(feedId)));
        }}
      >
        Remove
      </Button>
      <FormMessage state={state} />
    </div>
  );
}

export function RefreshFeedsButton() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({ status: "idle" });
  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(async () => setState(await refreshAllFeeds()))}
      >
        {pending ? "Refreshing…" : "Refresh now"}
      </Button>
      <FormMessage state={state} />
    </div>
  );
}

export function CalendarAddressForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createCalendarAddress, {
    status: "idle",
  });
  if (state.status === "success") {
    return (
      <div className="space-y-2 text-sm">
        <p>Your calendar address. Copy it now: it is shown only once.</p>
        <code className="block overflow-x-auto rounded-md border bg-muted p-3 text-xs select-all">
          {state.message}
        </code>
        <p className="text-muted-foreground">
          Google Calendar: Other calendars → From URL. Apple Calendar: File → New Calendar
          Subscription. Outlook: Add calendar → Subscribe from web.
        </p>
      </div>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="token-label">Label (optional)</Label>
        <Input id="token-label" name="label" maxLength={200} placeholder="My phone" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Creating…" : "Create calendar address"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

export function RevokeButton({ tokenId }: { tokenId: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({ status: "idle" });
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(async () => setState(await revokeCalendarAddress(tokenId)))}
      >
        Revoke
      </Button>
      <FormMessage state={state} />
    </div>
  );
}

export function ReminderForm({ mode }: { mode: "each" | "digest" | "off" }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateReminderMode, {
    status: "idle",
  });
  const options: [typeof mode, string, string][] = [
    ["digest", "One email per run", "Everything due at 30, 14, 7 and 1 days out, in one message."],
    ["each", "One email per date", "A separate message for each date at each step."],
    ["off", "No reminder emails", "The calendar and the feed still work."],
  ];
  return (
    <form action={formAction} className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="sr-only">Reminder emails</legend>
        {options.map(([value, label, help]) => (
          <label key={value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              value={value}
              defaultChecked={mode === value}
              className="mt-1"
            />
            <span>
              {label}
              <span className="block text-xs text-muted-foreground">{help}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
