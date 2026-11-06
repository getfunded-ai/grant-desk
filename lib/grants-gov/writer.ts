import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import type { Json } from "@/types/supabase";

import { GRANTS_GOV_SOURCE } from "./codes";
import type { Agency, CatalogRow, DetailsRow, Listing } from "./map";
import type { CatalogWriter, SyncJob, UpsertCounts } from "./sync";

type Admin = SupabaseClient<Database>;

const PAGE = 1000;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? "unknown error"}`);
}

/**
 * The catalog writer over Supabase with the service-key client. Only the cron route handlers
 * construct it, after checking the cron secret. Every write is to catalog tables or to catalog
 * rows of opportunities (organization_id null); nothing here reads or writes a tenant row.
 */
export function createSupabaseWriter(admin: Admin): CatalogWriter {
  return {
    async listKnownExternalIds() {
      const known = new Set<string>();
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin
          .from("opportunities")
          .select("external_id")
          .eq("source_system", GRANTS_GOV_SOURCE)
          .is("organization_id", null)
          .order("external_id")
          .range(from, from + PAGE - 1);
        if (error) fail("could not list the catalog", error);
        for (const row of data ?? []) if (row.external_id) known.add(row.external_id);
        if (!data || data.length < PAGE) break;
      }
      return known;
    },

    async listTrackedExternalIds() {
      const { data, error } = await admin
        .from("opportunities")
        .select("external_id, grants!inner(id)")
        .eq("source_system", GRANTS_GOV_SOURCE)
        .is("organization_id", null)
        .limit(PAGE);
      if (error) fail("could not list tracked opportunities", error);
      return (data ?? []).map((row) => row.external_id).filter((id): id is string => Boolean(id));
    },

    async upsertRows(rows: CatalogRow[]) {
      if (rows.length === 0) return { inserted: 0, updated: 0, unchanged: 0 };
      const { data, error } = await admin.rpc("upsert_catalog_opportunities", {
        p_source_system: GRANTS_GOV_SOURCE,
        p_rows: rows as unknown as NonNullable<Json>,
      });
      if (error) fail("could not upsert opportunities", error);
      const counts: UpsertCounts = { inserted: 0, updated: 0, unchanged: 0 };
      for (const row of data ?? []) {
        counts.inserted += row.inserted ?? 0;
        counts.updated += row.updated ?? 0;
        counts.unchanged += row.unchanged ?? 0;
      }
      return counts;
    },

    async upsertAgencies(agencies: Agency[]) {
      const now = new Date().toISOString();
      for (const chunk of chunks(agencies, 500)) {
        const { error } = await admin.from("grants_gov_agencies").upsert(
          chunk.map((a) => ({ ...a, updated_at: now })),
          { onConflict: "code" },
        );
        if (error) fail("could not upsert agencies", error);
      }
    },

    async upsertListings(listings: Listing[]) {
      const now = new Date().toISOString();
      const titled = listings.filter((l) => l.title);
      const bare = listings.filter((l) => !l.title);
      for (const chunk of chunks(titled, 500)) {
        const { error } = await admin.from("assistance_listings").upsert(
          chunk.map((l) => ({ number: l.number, title: l.title, updated_at: now })),
          { onConflict: "number" },
        );
        if (error) fail("could not upsert assistance listings", error);
      }
      for (const chunk of chunks(bare, 500)) {
        const { error } = await admin.from("assistance_listings").upsert(
          chunk.map((l) => ({ number: l.number })),
          { onConflict: "number", ignoreDuplicates: true },
        );
        if (error) fail("could not add assistance listing numbers", error);
      }
    },

    async upsertDetails(details: DetailsRow[]) {
      if (details.length === 0) return 0;
      const ids = new Map<string, string>();
      for (const chunk of chunks(
        details.map((d) => d.external_id),
        200,
      )) {
        const { data, error } = await admin
          .from("opportunities")
          .select("id, external_id")
          .eq("source_system", GRANTS_GOV_SOURCE)
          .is("organization_id", null)
          .in("external_id", chunk);
        if (error) fail("could not look up opportunities for details", error);
        for (const row of data ?? []) if (row.external_id) ids.set(row.external_id, row.id);
      }
      const rows = details.flatMap((d) => {
        const id = ids.get(d.external_id);
        if (!id) return [];
        return [
          {
            opportunity_id: id,
            source_system: d.source_system,
            fetched_at: d.fetched_at,
            revision: d.revision,
            packages: d.packages as unknown as NonNullable<Json>,
            attachments: d.attachments as unknown as NonNullable<Json>,
            assistance_listings: d.assistance_listings as unknown as NonNullable<Json>,
            details: d.details as unknown as NonNullable<Json>,
          },
        ];
      });
      for (const chunk of chunks(rows, 200)) {
        const { error } = await admin
          .from("opportunity_details")
          .upsert(chunk, { onConflict: "opportunity_id" });
        if (error) fail("could not upsert opportunity details", error);
      }
      return rows.length;
    },

    async startRun(job: SyncJob, sourceUrl: string | null) {
      const { data, error } = await admin
        .from("opportunity_sync_runs")
        .insert({ source_system: GRANTS_GOV_SOURCE, job, source_url: sourceUrl })
        .select("id")
        .single();
      if (error || !data) fail("could not record the sync run", error);
      return data.id;
    },

    async finishRun(runId, status, counts, error) {
      const { error: updateError } = await admin
        .from("opportunity_sync_runs")
        .update({
          status,
          finished_at: new Date().toISOString(),
          counts: counts as unknown as NonNullable<Json>,
          error,
        })
        .eq("id", runId);
      if (updateError) console.error("could not finish the sync run record", updateError.message);
    },
  };
}
