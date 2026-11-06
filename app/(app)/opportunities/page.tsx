import { OpportunityFilters } from "@/components/opportunities/filters";
import { formatDateTime } from "@/components/opportunities/format";
import { OpportunityResults } from "@/components/opportunities/results";
import { requireActiveOrganization } from "@/lib/auth/session";
import {
  getLastSyncRun,
  listAgencies,
  parseFilters,
  searchOpportunities,
} from "@/lib/grants-gov/store";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Opportunities · Grant Desk" };

const EDITOR_ROLES = ["owner", "admin", "editor"];

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { active } = await requireActiveOrganization();
  const supabase = await createClient();
  const filters = parseFilters(await searchParams);

  if (!supabase) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Federal opportunities</h1>
        <p className="text-sm text-muted-foreground">
          The database is not set up on this copy of Grant Desk yet. See docs/DEPLOY.md.
        </p>
      </div>
    );
  }

  const [{ hits, total }, agencies, lastRun] = await Promise.all([
    searchOpportunities(supabase, filters),
    listAgencies(supabase),
    getLastSyncRun(supabase),
  ]);
  const loaded = lastRun?.counts?.loaded;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Federal opportunities</h1>
        <p className="text-sm text-muted-foreground">
          Every posted and forecast opportunity on Grants.gov, plus those closed within the last
          year.{" "}
          {lastRun?.status === "succeeded"
            ? `Last loaded ${formatDateTime(lastRun.finished_at ?? lastRun.started_at)}${
                typeof loaded === "number" ? ` (${loaded.toLocaleString("en-US")} notices)` : ""
              }.`
            : lastRun
              ? `The last load on ${formatDateTime(lastRun.started_at)} did not finish; the list may be out of date.`
              : "The catalog has not been loaded yet."}
        </p>
      </div>
      <OpportunityFilters filters={filters} agencies={agencies} />
      <OpportunityResults
        hits={hits}
        total={total}
        filters={filters}
        canTrack={EDITOR_ROLES.includes(active.role)}
      />
    </div>
  );
}
