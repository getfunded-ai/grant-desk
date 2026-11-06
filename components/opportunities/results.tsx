import Link from "next/link";

import { ELIGIBILITY_LABELS, NONPROFIT_ELIGIBILITIES } from "@/lib/grants-gov/codes";
import {
  type OpportunityFilters,
  type OpportunityHit,
  PAGE_SIZE,
  filtersToQuery,
} from "@/lib/grants-gov/store";

import { formatDate, formatMoney } from "./format";
import { StatusBadge } from "./status-badge";
import { TrackButton } from "./track-button";

export function OpportunityResults({
  hits,
  total,
  filters,
  canTrack,
}: {
  hits: OpportunityHit[];
  total: number;
  filters: OpportunityFilters;
  canTrack: boolean;
}) {
  if (total === 0) {
    return (
      <p className="rounded-xl border p-6 text-sm text-muted-foreground">
        No opportunities match these filters. Widen the status, eligibility or close-date filters,
        or clear the keyword.
      </p>
    );
  }
  const from = (filters.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(filters.page * PAGE_SIZE, total);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {total.toLocaleString("en-US")}
      </p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Opportunity</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Closes</th>
              <th className="px-4 py-3 font-medium">Award ceiling</th>
              <th className="px-4 py-3 font-medium">Nonprofits</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Track</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {hits.map((hit) => {
              const nonprofit = hit.eligible_applicants.filter((code) =>
                (NONPROFIT_ELIGIBILITIES as readonly string[]).includes(code),
              );
              const unrestricted = hit.eligible_applicants.includes("99");
              return (
                <tr key={hit.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/opportunities/${hit.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {hit.title}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {hit.funder_name ?? "Agency not stated"}
                      {hit.opportunity_number ? ` · ${hit.opportunity_number}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={hit.status} />
                    {hit.status === "forecasted" ? (
                      <div className="mt-1 text-xs text-muted-foreground">estimated dates</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(hit.close_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatMoney(hit.max_award_amount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {nonprofit.length
                      ? nonprofit
                          .map((code) => (code === "12" ? "501(c)(3)" : "non-501(c)(3)"))
                          .join(", ")
                      : unrestricted
                        ? ELIGIBILITY_LABELS["99"].split(" (")[0]
                        : hit.eligible_applicants.length
                          ? "Not listed"
                          : "Not stated"}
                  </td>
                  <td className="px-4 py-3">
                    {canTrack ? <TrackButton opportunityId={hit.id} size="sm" /> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <nav aria-label="Pages" className="flex items-center justify-between text-sm">
        {filters.page > 1 ? (
          <Link
            href={`/opportunities${filtersToQuery(filters, { page: filters.page - 1 })}`}
            className="underline-offset-4 hover:underline"
          >
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        <span className="text-muted-foreground">
          Page {filters.page} of {lastPage}
        </span>
        {filters.page < lastPage ? (
          <Link
            href={`/opportunities${filtersToQuery(filters, { page: filters.page + 1 })}`}
            className="underline-offset-4 hover:underline"
          >
            Next →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
