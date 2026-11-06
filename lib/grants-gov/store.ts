import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Tables } from "@/lib/db/types";

import { GRANTS_GOV_SOURCE, NONPROFIT_ELIGIBILITIES } from "./codes";
import {
  type Agency,
  type GrantsGovFields,
  type OpportunityStatus,
  addDays,
  easternIsoDate,
} from "./map";

/**
 * Reads for the opportunity pages. Every function takes the signed-in person's client, so
 * row-level security decides what comes back: the public catalog plus their own organizations'
 * rows. Nothing here uses the service key.
 */

export const PAGE_SIZE = 25;

export type EligibilityChoice = "nonprofit" | "12" | "13" | "any";
export type CloseWindow = "any" | "30" | "60" | "90" | "180";

export interface OpportunityFilters {
  keyword: string;
  statuses: OpportunityStatus[];
  eligibility: EligibilityChoice;
  agency: string;
  categories: string[];
  closeWindow: CloseWindow;
  minCeiling: number | null;
  page: number;
}

export const DEFAULT_FILTERS: OpportunityFilters = {
  keyword: "",
  statuses: ["open", "forecasted"],
  eligibility: "nonprofit",
  agency: "",
  categories: [],
  closeWindow: "any",
  minCeiling: null,
  page: 1,
};

type Params = Record<string, string | string[] | undefined>;

function list(params: Params, name: string): string[] {
  const value = params[name];
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value])
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

function one(params: Params, name: string): string {
  const value = params[name];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const STATUSES: OpportunityStatus[] = ["forecasted", "open", "closed"];
const ELIGIBILITY_CHOICES: EligibilityChoice[] = ["nonprofit", "12", "13", "any"];
const CLOSE_WINDOWS: CloseWindow[] = ["any", "30", "60", "90", "180"];

/** The filters from the page's query string. Anything unknown falls back to the default. */
export function parseFilters(params: Params): OpportunityFilters {
  const statuses = list(params, "status").filter((s): s is OpportunityStatus =>
    (STATUSES as string[]).includes(s),
  );
  const eligibility = one(params, "elig");
  const closeWindow = one(params, "close");
  const ceiling = Number(one(params, "ceiling").replace(/[,$\s]/g, ""));
  const page = Number(one(params, "page"));
  const agency = one(params, "agency").trim();
  return {
    keyword: one(params, "q").trim().slice(0, 200),
    statuses: statuses.length ? statuses : DEFAULT_FILTERS.statuses,
    eligibility: (ELIGIBILITY_CHOICES as string[]).includes(eligibility)
      ? (eligibility as EligibilityChoice)
      : "nonprofit",
    agency: /^[A-Za-z0-9 -]{1,80}$/.test(agency) ? agency.toUpperCase() : "",
    categories: list(params, "category").filter((c) => /^[A-Z]{1,5}$/.test(c)),
    closeWindow: (CLOSE_WINDOWS as string[]).includes(closeWindow)
      ? (closeWindow as CloseWindow)
      : "any",
    minCeiling: Number.isFinite(ceiling) && ceiling > 0 ? Math.floor(ceiling) : null,
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 400) : 1,
  };
}

/** The query string for a set of filters, with defaults left out so links stay short. */
export function filtersToQuery(
  filters: OpportunityFilters,
  overrides: Partial<OpportunityFilters> = {},
): string {
  const f = { ...filters, ...overrides };
  const query = new URLSearchParams();
  if (f.keyword) query.set("q", f.keyword);
  if (f.statuses.join(",") !== DEFAULT_FILTERS.statuses.join(",")) {
    for (const status of f.statuses) query.append("status", status);
  }
  if (f.eligibility !== "nonprofit") query.set("elig", f.eligibility);
  if (f.agency) query.set("agency", f.agency);
  for (const category of f.categories) query.append("category", category);
  if (f.closeWindow !== "any") query.set("close", f.closeWindow);
  if (f.minCeiling) query.set("ceiling", String(f.minCeiling));
  if (f.page > 1) query.set("page", String(f.page));
  const text = query.toString();
  return text ? `?${text}` : "";
}

export interface OpportunityHit {
  id: string;
  title: string;
  status: OpportunityStatus;
  status_description: string | null;
  funder_name: string | null;
  opportunity_number: string | null;
  external_id: string | null;
  source_system: string;
  source_url: string | null;
  post_date: string | null;
  close_date: string | null;
  min_award_amount: number | null;
  max_award_amount: number | null;
  total_amount_available: number | null;
  agency_code: string | null;
  eligible_applicants: string[];
  funding_categories: string[];
  total_count: number;
}

export async function searchOpportunities(
  client: SupabaseClient,
  filters: OpportunityFilters,
  now = new Date(),
): Promise<{ hits: OpportunityHit[]; total: number }> {
  const today = easternIsoDate(now);
  const eligibilities =
    filters.eligibility === "any"
      ? null
      : filters.eligibility === "nonprofit"
        ? [...NONPROFIT_ELIGIBILITIES]
        : [filters.eligibility];
  const { data, error } = await client.rpc("search_opportunities", {
    p_keyword: filters.keyword || null,
    p_statuses: filters.statuses,
    p_eligibilities: eligibilities,
    p_agency: filters.agency || null,
    p_categories: filters.categories.length ? filters.categories : null,
    p_close_from: filters.closeWindow === "any" ? null : today,
    p_close_to: filters.closeWindow === "any" ? null : addDays(today, Number(filters.closeWindow)),
    p_min_award_ceiling: filters.minCeiling,
    p_source_system: GRANTS_GOV_SOURCE,
    p_limit: PAGE_SIZE,
    p_offset: (filters.page - 1) * PAGE_SIZE,
  });
  if (error) throw new Error(`Could not search opportunities: ${error.message}`);
  const hits = (data ?? []) as OpportunityHit[];
  return { hits, total: hits.length ? Number(hits[0].total_count) : 0 };
}

export async function listAgencies(client: SupabaseClient): Promise<Agency[]> {
  const { data, error } = await client
    .from("grants_gov_agencies")
    .select("code, name, top_agency_code")
    .order("name")
    .limit(1000);
  if (error) throw new Error(`Could not load agencies: ${error.message}`);
  return (data ?? []) as Agency[];
}

export type OpportunityRow = Tables<"opportunities">;
export type OpportunityDetailsRow = Tables<"opportunity_details">;

export interface OpportunityRecord {
  opportunity: OpportunityRow;
  grantsGov: GrantsGovFields | null;
  details: OpportunityDetailsRow | null;
  /** Assistance Listing titles the catalog knows, by number. */
  listingTitles: Record<string, string>;
}

/** The Grants.gov block of custom_fields, when the row came from Grants.gov. */
export function grantsGovFieldsOf(row: OpportunityRow): GrantsGovFields | null {
  const custom = row.custom_fields;
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) return null;
  const block = (custom as Record<string, unknown>).grants_gov;
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  const gg = block as Partial<GrantsGovFields>;
  if (typeof gg.opportunity_id !== "number") return null;
  return {
    ...gg,
    opportunity_id: gg.opportunity_id,
    doc_type: gg.doc_type === "forecast" ? "forecast" : "synopsis",
    funding_instruments: Array.isArray(gg.funding_instruments) ? gg.funding_instruments : [],
    funding_categories: Array.isArray(gg.funding_categories) ? gg.funding_categories : [],
    eligible_applicants: Array.isArray(gg.eligible_applicants) ? gg.eligible_applicants : [],
    assistance_listings: Array.isArray(gg.assistance_listings) ? gg.assistance_listings : [],
  };
}

export async function getOpportunity(
  client: SupabaseClient,
  id: string,
): Promise<OpportunityRecord | null> {
  const { data, error } = await client.from("opportunities").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the opportunity: ${error.message}`);
  if (!data) return null;
  const opportunity = data as OpportunityRow;
  const grantsGov = grantsGovFieldsOf(opportunity);

  const [{ data: details }, listings] = await Promise.all([
    client.from("opportunity_details").select("*").eq("opportunity_id", id).maybeSingle(),
    grantsGov?.assistance_listings.length
      ? client
          .from("assistance_listings")
          .select("number, title")
          .in("number", grantsGov.assistance_listings)
      : Promise.resolve({ data: [] as { number: string; title: string | null }[] }),
  ]);
  const listingTitles: Record<string, string> = {};
  for (const listing of (listings.data ?? []) as { number: string; title: string | null }[]) {
    if (listing.title) listingTitles[listing.number] = listing.title;
  }
  return {
    opportunity,
    grantsGov,
    details: (details as OpportunityDetailsRow | null) ?? null,
    listingTitles,
  };
}

export interface TrackedGrant {
  id: string;
  stage: string;
}

/** The organization's grant for this opportunity, if one exists. */
export async function findTrackedGrant(
  client: SupabaseClient,
  organizationId: string,
  opportunityId: string,
): Promise<TrackedGrant | null> {
  const { data, error } = await client
    .from("grants")
    .select("id, stage")
    .eq("organization_id", organizationId)
    .eq("opportunity_id", opportunityId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not check tracking: ${error.message}`);
  return (data as TrackedGrant | null) ?? null;
}

export interface SyncRunSummary {
  job: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  counts: Record<string, number | string>;
}

/** The most recent nightly run, so the page can say when the catalog was last loaded. */
export async function getLastSyncRun(client: SupabaseClient): Promise<SyncRunSummary | null> {
  const { data, error } = await client
    .from("opportunity_sync_runs")
    .select("job, status, started_at, finished_at, counts")
    .eq("source_system", GRANTS_GOV_SOURCE)
    .eq("job", "nightly")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as SyncRunSummary | null) ?? null;
}
