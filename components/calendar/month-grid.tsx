import Link from "next/link";
import type { CalendarItem } from "@/lib/calendar/events";
import { itemDay } from "@/lib/calendar/events";
import { cn } from "@/lib/utils";

/** A month of days, server-rendered. Items land on the day they fall on in their stated zone. */
export function MonthGrid({
  year,
  month,
  items,
  today,
}: {
  year: number;
  /** 1 to 12. */
  month: number;
  items: CalendarItem[];
  today: string;
}) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = first.getUTCDay();
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const day = itemDay(item);
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }
  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[42rem] grid-cols-7 gap-px rounded-lg border bg-border text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => (
          <div key={name} className="bg-muted px-2 py-1 font-medium text-muted-foreground">
            {name}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null)
            return <div key={`empty-${index}`} className="min-h-20 bg-background/60" />;
          const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayItems = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn("min-h-20 bg-background p-1", key === today ? "bg-accent" : "")}
            >
              <div
                className={cn(
                  "mb-1 text-right",
                  key === today ? "font-semibold" : "text-muted-foreground",
                )}
              >
                {day}
              </div>
              <ul className="space-y-1">
                {dayItems.slice(0, 4).map((item) => (
                  <li key={item.key}>
                    <ItemChip item={item} />
                  </li>
                ))}
                {dayItems.length > 4 ? (
                  <li className="text-muted-foreground">+{dayItems.length - 4} more</li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const KIND_STYLES: Record<CalendarItem["kind"], string> = {
  deadline: "border-l-2 border-l-foreground",
  grant: "border-l-2 border-l-primary",
  task: "border-l-2 border-l-muted-foreground",
  feed: "border-l-2 border-l-ring",
};

function ItemChip({ item }: { item: CalendarItem }) {
  const text = (
    <span
      className={cn("block truncate rounded-sm bg-muted px-1 py-0.5", KIND_STYLES[item.kind])}
      title={`${item.title} · ${item.source}`}
    >
      {item.title}
    </span>
  );
  return item.grantId ? <Link href={`/grants/${item.grantId}`}>{text}</Link> : text;
}
