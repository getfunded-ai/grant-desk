/**
 * The two sync jobs. Both write through a CatalogWriter, so the route handler gives them the
 * Supabase service-key writer and a local script can give them a plain Postgres one.
 *
 * Nightly: stream the daily extract, map every record, load the ones worth keeping (see
 * shouldLoad), and upsert agencies and Assistance Listing numbers.
 * Intraday: ask search2 for what was posted in the last few days, fetch the full record for those
 * and for every opportunity a grant tracks, and store packages, attachments and listing titles.
 *
 * Neither job touches a grant. Status and close-date changes reach tracked grants through the
 * database trigger that writes activity_log lines.
 */

import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

import { type FetchLike, fetchOpportunity, search2 } from "./api";
import { GRANTS_GOV_SOURCE } from "./codes";
import { extractDateCandidates, extractRecords, extractUrlFor, zipEntryBytes } from "./extract";
import {
  type Agency,
  type CatalogRow,
  type DetailsRow,
  type Listing,
  agenciesFromFacets,
  easternIsoDate,
  mapExtractRecord,
  mapFetchedOpportunity,
  shouldLoad,
} from "./map";

export interface UpsertCounts {
  inserted: number;
  updated: number;
  unchanged: number;
}

export type SyncJob = "nightly" | "intraday";

/** What a job needs from the database. Implemented over Supabase in writer.ts. */
export interface CatalogWriter {
  /** Grants.gov ids already in the catalog. */
  listKnownExternalIds(): Promise<Set<string>>;
  /** Grants.gov ids of catalog opportunities that at least one grant tracks. */
  listTrackedExternalIds(): Promise<string[]>;
  upsertRows(rows: CatalogRow[]): Promise<UpsertCounts>;
  upsertAgencies(agencies: Agency[]): Promise<void>;
  /** Numbers without a title never overwrite a title already stored. */
  upsertListings(listings: Listing[]): Promise<void>;
  upsertDetails(details: DetailsRow[]): Promise<number>;
  startRun(job: SyncJob, sourceUrl: string | null): Promise<string>;
  finishRun(
    runId: string,
    status: "succeeded" | "failed",
    counts: Record<string, number | string>,
    error: string | null,
  ): Promise<void>;
}

export interface NightlyCounts {
  scanned: number;
  synopses: number;
  forecasts: number;
  invalid: number;
  skipped: number;
  loaded: number;
  inserted: number;
  updated: number;
  unchanged: number;
  agencies: number;
  listings: number;
  byStatus: Record<string, number>;
  seconds: number;
}

export interface NightlyResult {
  runId: string;
  extractDate: string;
  sourceUrl: string;
  counts: NightlyCounts;
}

export interface NightlyOptions {
  writer: CatalogWriter;
  fetchFn?: FetchLike;
  now?: Date;
  /** YYYYMMDD of the extract to load; default: today's, then yesterday's. */
  date?: string;
  batchSize?: number;
  /** For a local run: read the zip from here instead of downloading it. */
  source?: AsyncIterable<Uint8Array>;
}

function sum(into: UpsertCounts, counts: UpsertCounts) {
  into.inserted += counts.inserted;
  into.updated += counts.updated;
  into.unchanged += counts.unchanged;
}

/** A plain-words reason for the run log. Never a stack trace. */
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

async function openExtract(
  options: NightlyOptions,
): Promise<{ bytes: AsyncIterable<Uint8Array>; date: string; url: string }> {
  if (options.source) {
    const date = options.date ?? "local";
    return { bytes: options.source, date, url: `file:${date}` };
  }
  const fetchFn = options.fetchFn ?? fetch;
  const candidates = options.date
    ? [options.date]
    : extractDateCandidates(options.now ?? new Date());
  const refused: string[] = [];
  for (const date of candidates) {
    const url = extractUrlFor(date);
    const response = await fetchFn(url, { method: "GET" });
    if (response.ok && response.body) {
      const bytes = Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>);
      return { bytes, date, url };
    }
    refused.push(`${date}: HTTP ${response.status}`);
    await response.body?.cancel().catch(() => undefined);
  }
  throw new Error(`no extract available (${refused.join(", ")})`);
}

export async function runNightlyExtract(options: NightlyOptions): Promise<NightlyResult> {
  const { writer } = options;
  const startedAt = Date.now();
  const now = options.now ?? new Date();
  const today = easternIsoDate(now);
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 500, 2000));

  const counts: NightlyCounts = {
    scanned: 0,
    synopses: 0,
    forecasts: 0,
    invalid: 0,
    skipped: 0,
    loaded: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    agencies: 0,
    listings: 0,
    byStatus: {},
    seconds: 0,
  };

  let runId: string | null = null;
  let sourceUrl = extractUrlFor(options.date ?? today);
  try {
    // Record the run before the download, so a missing or refused extract still leaves a failed
    // run on the browse page instead of "not loaded yet". The URL is the one tried first; the
    // result below carries the one that was actually used.
    runId = await writer.startRun("nightly", sourceUrl);
    const known = await writer.listKnownExternalIds();
    const extract = await openExtract(options);
    sourceUrl = extract.url;

    const agencies = new Map<string, Agency>();
    const listings = new Set<string>();
    const totals: UpsertCounts = { inserted: 0, updated: 0, unchanged: 0 };
    let batch = new Map<string, CatalogRow>();

    const flush = async () => {
      if (batch.size === 0) return;
      sum(totals, await writer.upsertRows([...batch.values()]));
      batch = new Map();
    };

    for await (const record of extractRecords(zipEntryBytes(extract.bytes))) {
      counts.scanned += 1;
      if (record.kind === "forecast") counts.forecasts += 1;
      else counts.synopses += 1;
      const row = mapExtractRecord(record, today);
      if (!row) {
        counts.invalid += 1;
        continue;
      }
      if (!shouldLoad(row, today, known)) {
        counts.skipped += 1;
        continue;
      }
      counts.loaded += 1;
      counts.byStatus[row.status] = (counts.byStatus[row.status] ?? 0) + 1;
      const gg = row.custom_fields.grants_gov;
      if (gg.agency_code && gg.agency_name) {
        agencies.set(gg.agency_code, {
          code: gg.agency_code,
          name: gg.agency_name,
          top_agency_code: gg.top_agency_code ?? gg.agency_code,
        });
      }
      for (const number of gg.assistance_listings) listings.add(number);
      batch.set(row.external_id, row);
      if (batch.size >= batchSize) await flush();
    }
    await flush();

    await writer.upsertAgencies([...agencies.values()]);
    await writer.upsertListings([...listings].map((number) => ({ number, title: null })));
    counts.agencies = agencies.size;
    counts.listings = listings.size;
    counts.inserted = totals.inserted;
    counts.updated = totals.updated;
    counts.unchanged = totals.unchanged;
    counts.seconds = Math.round((Date.now() - startedAt) / 1000);

    await writer.finishRun(runId, "succeeded", flatten(counts), null);
    return { runId, extractDate: extract.date, sourceUrl, counts };
  } catch (error) {
    counts.seconds = Math.round((Date.now() - startedAt) / 1000);
    if (runId) await writer.finishRun(runId, "failed", flatten(counts), describeError(error));
    throw error;
  }
}

function flatten(counts: NightlyCounts | IntradayCounts): Record<string, number | string> {
  const flat: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(counts)) {
    if (typeof value === "number") flat[key] = value;
    else if (value && typeof value === "object") {
      for (const [inner, n] of Object.entries(value)) flat[`${key}.${inner}`] = n as number;
    }
  }
  return flat;
}

export interface IntradayCounts {
  hits: number;
  tracked: number;
  requested: number;
  fetched: number;
  missing: number;
  failed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  details: number;
  agencies: number;
  listings: number;
  seconds: number;
}

export interface IntradayOptions {
  writer: CatalogWriter;
  fetchFn?: FetchLike;
  now?: Date;
  /** Look back this many days of postings (Grants.gov's dateRange). Default 3. */
  days?: number;
  /** At most this many detail calls per run. Default 150. */
  maxDetails?: number;
  /** Parallel detail calls. Default 4. */
  concurrency?: number;
}

export interface IntradayResult {
  runId: string;
  counts: IntradayCounts;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runIntradayUpdate(options: IntradayOptions): Promise<IntradayResult> {
  const { writer } = options;
  const fetchFn = options.fetchFn ?? fetch;
  const startedAt = Date.now();
  const now = options.now ?? new Date();
  const today = easternIsoDate(now);
  const days = Math.max(1, Math.min(options.days ?? 3, 56));
  const maxDetails = Math.max(1, Math.min(options.maxDetails ?? 150, 1000));
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 8));

  const counts: IntradayCounts = {
    hits: 0,
    tracked: 0,
    requested: 0,
    fetched: 0,
    missing: 0,
    failed: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    details: 0,
    agencies: 0,
    listings: 0,
    seconds: 0,
  };

  const runId = await writer.startRun("intraday", `${"search2"}?dateRange=${days}`);
  try {
    // Recent postings, newest first, at most ten pages of 100.
    const recent: string[] = [];
    const agencies = new Map<string, Agency>();
    for (let start = 0; start < 1000; start += 100) {
      const page = await search2(
        {
          oppStatuses: "forecasted|posted",
          dateRange: String(days),
          rows: 100,
          startRecordNum: start,
          sortBy: "openDate|desc",
        },
        fetchFn,
      );
      if (start === 0) {
        for (const agency of agenciesFromFacets(page.agencies)) agencies.set(agency.code, agency);
      }
      for (const hit of page.oppHits) if (/^\d+$/.test(hit.id)) recent.push(hit.id);
      if (page.oppHits.length === 0 || start + 100 >= page.hitCount) break;
    }
    counts.hits = recent.length;

    const tracked = await writer.listTrackedExternalIds();
    counts.tracked = tracked.length;

    // Tracked opportunities first: a changed close date matters most to a grant in progress.
    const ids = [...new Set([...tracked, ...recent])].slice(0, maxDetails);
    counts.requested = ids.length;

    const fetchedAt = new Date();
    const mapped = await mapLimit(ids, concurrency, async (id) => {
      try {
        const detail = await fetchOpportunity(Number(id), fetchFn);
        if (!detail) {
          counts.missing += 1;
          return null;
        }
        const result = mapFetchedOpportunity(detail, today, fetchedAt);
        if (!result) {
          counts.missing += 1;
          return null;
        }
        counts.fetched += 1;
        return result;
      } catch (error) {
        counts.failed += 1;
        console.error("fetchOpportunity failed", { id, error: describeError(error) });
        return null;
      }
    });

    const rows = new Map<string, CatalogRow>();
    const details: DetailsRow[] = [];
    const listings = new Map<string, Listing>();
    for (const result of mapped) {
      if (!result) continue;
      rows.set(result.row.external_id, result.row);
      details.push(result.details);
      for (const agency of result.agencies) agencies.set(agency.code, agency);
      for (const listing of result.listings) {
        const existing = listings.get(listing.number);
        if (!existing || (!existing.title && listing.title)) listings.set(listing.number, listing);
      }
    }

    const totals: UpsertCounts = { inserted: 0, updated: 0, unchanged: 0 };
    const all = [...rows.values()];
    for (let i = 0; i < all.length; i += 100) {
      sum(totals, await writer.upsertRows(all.slice(i, i + 100)));
    }
    counts.details = await writer.upsertDetails(details);
    await writer.upsertAgencies([...agencies.values()]);
    await writer.upsertListings([...listings.values()]);
    counts.agencies = agencies.size;
    counts.listings = listings.size;
    counts.inserted = totals.inserted;
    counts.updated = totals.updated;
    counts.unchanged = totals.unchanged;
    counts.seconds = Math.round((Date.now() - startedAt) / 1000);

    await writer.finishRun(runId, "succeeded", flatten(counts), null);
    return { runId, counts };
  } catch (error) {
    counts.seconds = Math.round((Date.now() - startedAt) / 1000);
    await writer.finishRun(runId, "failed", flatten(counts), describeError(error));
    throw error;
  }
}

export { GRANTS_GOV_SOURCE };
