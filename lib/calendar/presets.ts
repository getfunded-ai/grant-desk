/**
 * Outside feeds worth one click. The DOE SBIR/STTR Application Hub (ConnectWerx) publishes its
 * deadlines and office hours as iCal and its news as RSS; both answered on 2026-11-05. Any other
 * iCal or RSS address can be typed in by hand.
 */
export const FEED_PRESETS = [
  {
    id: "doe-sbir-ical",
    name: "DOE SBIR/STTR Application Hub: deadlines and events",
    kind: "ical",
    url: "https://sbir-sttr.connectwerx.org/events/?ical=1",
  },
  {
    id: "doe-sbir-rss",
    name: "DOE SBIR/STTR Application Hub: news",
    kind: "rss",
    url: "https://sbir-sttr.connectwerx.org/feed/",
  },
] as const;

export type FeedPreset = (typeof FEED_PRESETS)[number];
