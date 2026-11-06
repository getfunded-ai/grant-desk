/**
 * A small reader for RSS 2.0 and Atom feeds. Pure: regular expressions over the text, enough for
 * the news feeds of funders and agencies. It never runs scripts or follows links.
 */

export type ParsedItem = {
  uid: string;
  title: string;
  link: string | null;
  summary: string | null;
  /** Null when the feed stated no date; it reads "Not stated", never now(). */
  publishedAt: Date | null;
};

export type ParsedFeed = { title: string | null; items: ParsedItem[] };

const MAX_ITEMS = 50;

export function parseFeed(xml: string): ParsedFeed {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const title = firstTag(isAtom ? headOf(xml, "entry") : headOf(xml, "item"), "title");
  const blocks = [
    ...xml.matchAll(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi),
  ]
    .slice(0, MAX_ITEMS)
    .map((m) => m[0]);
  const items: ParsedItem[] = [];
  for (const block of blocks) {
    const item = isAtom ? atomItem(block) : rssItem(block);
    if (item) items.push(item);
  }
  return { title: title ? cleanText(title).slice(0, 300) || null : null, items };
}

/** The part of the document before the first item, where the channel's own title lives. */
function headOf(xml: string, itemTag: string): string {
  const index = xml.search(new RegExp(`<${itemTag}[\\s>]`, "i"));
  return index === -1 ? xml : xml.slice(0, index);
}

function rssItem(block: string): ParsedItem | null {
  const title = cleanText(firstTag(block, "title") ?? "");
  const link = cleanText(firstTag(block, "link") ?? "");
  const guid = cleanText(firstTag(block, "guid") ?? "");
  const uid = guid || link || title;
  if (!uid) return null;
  const date = firstTag(block, "pubDate") ?? firstTag(block, "dc:date");
  return {
    uid: uid.slice(0, 2000),
    title: (title || "(untitled)").slice(0, 1000),
    link: isHttp(link) ? link.slice(0, 2000) : null,
    summary: summaryOf(firstTag(block, "description") ?? firstTag(block, "content:encoded")),
    publishedAt: parseDate(date),
  };
}

function atomItem(block: string): ParsedItem | null {
  const title = cleanText(firstTag(block, "title") ?? "");
  const linkMatch = /<link\b[^>]*\bhref="([^"]+)"[^>]*>/i.exec(block);
  const link = linkMatch ? decodeEntities(linkMatch[1]).trim() : "";
  const id = cleanText(firstTag(block, "id") ?? "");
  const uid = id || link || title;
  if (!uid) return null;
  const date = firstTag(block, "published") ?? firstTag(block, "updated");
  return {
    uid: uid.slice(0, 2000),
    title: (title || "(untitled)").slice(0, 1000),
    link: isHttp(link) ? link.slice(0, 2000) : null,
    summary: summaryOf(firstTag(block, "summary") ?? firstTag(block, "content")),
    publishedAt: parseDate(date),
  };
}

function firstTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}\\s*>`, "i");
  const match = re.exec(block);
  return match ? match[1] : null;
}

function summaryOf(raw: string | null): string | null {
  if (!raw) return null;
  const text = cleanText(raw).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 2000) : null;
}

function isHttp(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const date = new Date(cleanText(raw));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** CDATA out, tags out, entities decoded. */
export function cleanText(raw: string): string {
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return decodeEntities(withoutCdata.replace(/<[^>]+>/g, "")).trim();
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => safeChar(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => safeChar(parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function safeChar(code: number): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}
