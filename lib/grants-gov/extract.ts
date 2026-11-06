/**
 * The Grants.gov daily XML extract, read as a stream.
 *
 * The file (GrantsDBExtractYYYYMMDDv2.zip, about 80 MB zipped, 320 MB unzipped, generated around
 * 4:40 am Eastern) is one XML document with one flat element per opportunity. Nothing here holds
 * the whole file: the zip entry is inflated as it downloads and records are yielded one at a time,
 * so the nightly job fits in a serverless function's memory.
 *
 * Pure Node code (streams and zlib only), so a local script can run it against a file.
 */

import { Readable, pipeline } from "node:stream";
import { createInflateRaw } from "node:zlib";

export const EXTRACT_BASE_URL = "https://prod-grants-gov-chatbot.s3.amazonaws.com/extracts/";

export type ExtractKind = "synopsis" | "forecast";

export interface ExtractRecord {
  kind: ExtractKind;
  /** Element name to its text values, in document order. Grants.gov repeats a tag per value. */
  fields: Record<string, string[]>;
}

/** The file name for one day, for example GrantsDBExtract20261105v2.zip. */
export function extractFileName(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) throw new Error(`extract date must be YYYYMMDD, got ${yyyymmdd}`);
  return `GrantsDBExtract${yyyymmdd}v2.zip`;
}

export function extractUrlFor(yyyymmdd: string): string {
  return EXTRACT_BASE_URL + extractFileName(yyyymmdd);
}

/** Today's date in Grants.gov's time zone (Eastern), as YYYYMMDD. */
export function easternDateStamp(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

/** Today's and yesterday's stamps (Eastern): the file for today may not be published yet. */
export function extractDateCandidates(now: Date): string[] {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return [easternDateStamp(now), easternDateStamp(yesterday)];
}

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const LOCAL_HEADER_LENGTH = 30;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

async function* skipLocalHeader(
  source: AsyncIterable<Uint8Array>,
): AsyncGenerator<{ method: number } | Uint8Array> {
  let head: Buffer = Buffer.alloc(0);
  let headerDone = false;
  for await (const piece of source) {
    const chunk = Buffer.isBuffer(piece) ? piece : Buffer.from(piece);
    if (headerDone) {
      yield chunk;
      continue;
    }
    head = head.length ? Buffer.concat([head, chunk]) : chunk;
    if (head.length < LOCAL_HEADER_LENGTH) continue;
    if (head.readUInt32LE(0) !== LOCAL_HEADER_SIGNATURE) {
      throw new Error("the download is not a zip file");
    }
    const method = head.readUInt16LE(8);
    const dataStart = LOCAL_HEADER_LENGTH + head.readUInt16LE(26) + head.readUInt16LE(28);
    if (head.length < dataStart) continue;
    headerDone = true;
    yield { method };
    if (head.length > dataStart) yield head.subarray(dataStart);
  }
  if (!headerDone) throw new Error("the download ended before the zip header was complete");
}

/**
 * The bytes of the first (only) entry of a zip, inflated. Sizes in the local header are zero
 * (Grants.gov writes them after the data), so the deflate stream is read until it says it is done;
 * the data descriptor and central directory that follow are ignored.
 */
export async function* zipEntryBytes(
  source: AsyncIterable<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  const parts = skipLocalHeader(source);
  const first = await parts.next();
  if (first.done || !("method" in first.value)) throw new Error("zip header missing");
  const { method } = first.value;
  const body = (async function* () {
    for await (const part of parts) if (!("method" in part)) yield part;
  })();
  if (method === METHOD_STORED) {
    yield* body;
    return;
  }
  if (method !== METHOD_DEFLATE) throw new Error(`unsupported zip compression method ${method}`);
  const inflate = createInflateRaw();
  let failure: Error | null = null;
  pipeline(Readable.from(body), inflate, (error) => {
    if (error) failure = error;
  });
  for await (const chunk of inflate) yield chunk as Uint8Array;
  if (failure) throw failure;
}

const RECORD_TAGS: Record<string, ExtractKind> = {
  OpportunitySynopsisDetail_1_0: "synopsis",
  OpportunityForecastDetail_1_0: "forecast",
};

const START_TAGS = Object.keys(RECORD_TAGS).map((name) => ({ name, open: `<${name}>` }));

const ENTITY = /&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g;

/** Decodes the five XML entities and numeric character references. */
export function decodeXmlEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text.replace(ENTITY, (whole, body: string) => {
    switch (body) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
    }
    const code = body[1] === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : whole;
  });
}

const FIELD = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;

/** The flat child elements of one record. Empty values are dropped: Grants.gov omits blank fields. */
export function parseRecordFields(body: string): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const match of body.matchAll(FIELD)) {
    const value = decodeXmlEntities(match[2]).trim();
    if (!value) continue;
    (fields[match[1]] ??= []).push(value);
  }
  return fields;
}

/**
 * Splits the extract's XML into records as the bytes arrive. Only the two record element names
 * are recognised; attributes, CDATA and nesting do not occur in this file (checked on the
 * 2026-11-05 extract) and are not handled.
 */
export async function* extractRecords(
  xml: AsyncIterable<Uint8Array>,
): AsyncGenerator<ExtractRecord> {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const drain = function* (): Generator<ExtractRecord> {
    for (;;) {
      let start = -1;
      let tag: { name: string; open: string } | null = null;
      for (const candidate of START_TAGS) {
        const at = buffer.indexOf(candidate.open);
        if (at !== -1 && (start === -1 || at < start)) {
          start = at;
          tag = candidate;
        }
      }
      if (!tag) {
        // Keep only a tail long enough to hold a start tag split across two chunks.
        if (buffer.length > 64) buffer = buffer.slice(-64);
        return;
      }
      const close = `</${tag.name}>`;
      const end = buffer.indexOf(close, start + tag.open.length);
      if (end === -1) {
        if (start > 0) buffer = buffer.slice(start);
        return;
      }
      const body = buffer.slice(start + tag.open.length, end);
      buffer = buffer.slice(end + close.length);
      yield { kind: RECORD_TAGS[tag.name], fields: parseRecordFields(body) };
    }
  };
  for await (const chunk of xml) {
    buffer += decoder.decode(chunk, { stream: true });
    yield* drain();
  }
  buffer += decoder.decode();
  yield* drain();
}

export function first(record: ExtractRecord, name: string): string | undefined {
  return record.fields[name]?.[0];
}

export function all(record: ExtractRecord, name: string): string[] {
  return record.fields[name] ?? [];
}
