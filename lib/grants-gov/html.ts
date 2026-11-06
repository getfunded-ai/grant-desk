/**
 * Grants.gov descriptions arrive as HTML fragments, sometimes encoded twice. The app shows them as
 * plain paragraphs and never renders the HTML, so a notice cannot inject markup into a page.
 */

import { decodeXmlEntities } from "./extract";

const NAMED: Record<string, string> = {
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  bull: "•",
};

function decodeHtmlEntities(text: string): string {
  return decodeXmlEntities(
    text.replace(
      /&(nbsp|ndash|mdash|rsquo|lsquo|rdquo|ldquo|hellip|bull);/g,
      (_, name: string) => NAMED[name],
    ),
  );
}

function stripTags(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");
}

/** Plain text, with paragraph breaks kept as blank lines. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  let text = html;
  // Twice: the extract often carries "&amp;lt;p&amp;gt;", which is HTML encoded inside XML.
  for (let pass = 0; pass < 2; pass++) text = stripTags(decodeHtmlEntities(text));
  return text
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The text split into paragraphs for display. */
export function htmlToParagraphs(html: string | null | undefined): string[] {
  return htmlToText(html)
    .split(/\n{2,}|\n(?=• )/)
    .map((p) => p.trim())
    .filter(Boolean);
}
