import Link from "next/link";
import { notFound } from "next/navigation";

import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatMoney,
  formatCount,
  NOT_STATED,
} from "@/components/opportunities/format";
import { StatusBadge } from "@/components/opportunities/status-badge";
import { TrackButton } from "@/components/opportunities/track-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveOrganization } from "@/lib/auth/session";
import { fetchOpportunity } from "@/lib/grants-gov/api";
import {
  ELIGIBILITY_LABELS,
  FUNDING_CATEGORY_LABELS,
  FUNDING_INSTRUMENT_LABELS,
  OPPORTUNITY_CATEGORY_LABELS,
  grantsGovAttachmentUrl,
  labelFor,
} from "@/lib/grants-gov/codes";
import { htmlToParagraphs } from "@/lib/grants-gov/html";
import {
  type DetailAttachmentRow,
  type DetailPackageRow,
  easternIsoDate,
  mapFetchedOpportunity,
} from "@/lib/grants-gov/map";
import { findTrackedGrant, getOpportunity } from "@/lib/grants-gov/store";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Opportunity · Grant Desk" };

const EDITOR_ROLES = ["owner", "admin", "editor"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Extras = {
  packages: DetailPackageRow[];
  attachments: DetailAttachmentRow[];
  listingTitles: Record<string, string>;
  source: string;
};

/**
 * Packages and attachments: from the stored details when the intraday job fetched them, else
 * fetched from Grants.gov for this view only (nothing is written from a page).
 */
async function loadExtras(
  stored: { packages: unknown; attachments: unknown; fetched_at: string } | null,
  listingTitles: Record<string, string>,
  grantsGovId: number | null,
): Promise<Extras> {
  if (stored) {
    return {
      packages: (Array.isArray(stored.packages) ? stored.packages : []) as DetailPackageRow[],
      attachments: (Array.isArray(stored.attachments)
        ? stored.attachments
        : []) as DetailAttachmentRow[],
      listingTitles,
      source: `Details fetched from Grants.gov ${formatDateTime(stored.fetched_at)}.`,
    };
  }
  if (grantsGovId === null) return { packages: [], attachments: [], listingTitles, source: "" };
  try {
    const detail = await fetchOpportunity(grantsGovId, (url, init) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(8000) }),
    );
    const mapped = detail
      ? mapFetchedOpportunity(detail, easternIsoDate(new Date()), new Date())
      : null;
    if (!mapped) {
      return {
        packages: [],
        attachments: [],
        listingTitles,
        source: "Grants.gov has no detail record for this notice right now.",
      };
    }
    const titles = { ...listingTitles };
    for (const listing of mapped.listings)
      if (listing.title) titles[listing.number] = listing.title;
    return {
      packages: mapped.details.packages,
      attachments: mapped.details.attachments,
      listingTitles: titles,
      source: `Details fetched from Grants.gov just now (${formatDateTime(new Date().toISOString())}).`,
    };
  } catch {
    return {
      packages: [],
      attachments: [],
      listingTitles,
      source: "Grants.gov did not answer in time; packages and attachments are not shown.",
    };
  }
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { active } = await requireActiveOrganization();
  const supabase = await createClient();
  if (!supabase) notFound();

  const record = await getOpportunity(supabase, id);
  if (!record) notFound();
  const { opportunity: o, grantsGov: gg, details } = record;
  const [tracked, extras] = await Promise.all([
    findTrackedGrant(supabase, active.id, id),
    loadExtras(details, record.listingTitles, gg?.opportunity_id ?? null),
  ]);
  const canTrack = EDITOR_ROLES.includes(active.role);
  const paragraphs = htmlToParagraphs(o.description);
  const otherDates = (Array.isArray(o.other_dates) ? o.other_dates : []) as {
    name?: string;
    date?: string;
    description?: string;
  }[];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/opportunities"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← All opportunities
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{o.title}</h1>
            <p className="text-sm text-muted-foreground">
              {o.funder_name ?? "Agency not stated"}
              {gg?.agency_code ? ` (${gg.agency_code})` : ""}
              {o.opportunity_number ? ` · ${o.opportunity_number}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={o.status} customValue={o.status_custom_value} />
              {o.status_description ? (
                <span className="text-xs text-muted-foreground">{o.status_description}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {tracked ? (
              <p
                className="rounded-md border px-3 py-1.5 text-sm"
                title="The grant record page arrives with Phase E."
              >
                Tracked · in your pipeline as a prospect
              </p>
            ) : canTrack ? (
              <TrackButton opportunityId={o.id} />
            ) : (
              <p className="text-xs text-muted-foreground">Viewers cannot track opportunities.</p>
            )}
            {o.source_url ? (
              <a
                href={o.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline underline-offset-4"
              >
                Open on Grants.gov ↗
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key facts</CardTitle>
          <CardDescription>
            As stated by the agency on Grants.gov. A missing fact reads &quot;{NOT_STATED}&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[12rem_1fr] gap-y-2 text-sm">
            <Fact label="Posted">{formatDate(o.post_date)}</Fact>
            <Fact label={o.status === "forecasted" ? "Estimated close" : "Closes"}>
              {formatDate(o.close_date)}
              {gg?.close_date_explanation ? (
                <span className="block text-xs text-muted-foreground">
                  {gg.close_date_explanation}
                </span>
              ) : null}
            </Fact>
            {otherDates.map((d) =>
              d.name && d.date ? (
                <Fact key={d.name} label={d.name}>
                  {formatDate(d.date)}
                  {d.description ? (
                    <span className="text-xs text-muted-foreground"> · {d.description}</span>
                  ) : null}
                </Fact>
              ) : null,
            )}
            <Fact label="Award ceiling">{formatMoney(o.max_award_amount)}</Fact>
            <Fact label="Award floor">{formatMoney(o.min_award_amount)}</Fact>
            <Fact label="Total program funding">{formatMoney(o.total_amount_available)}</Fact>
            <Fact label="Expected awards">{formatCount(o.estimated_award_count)}</Fact>
            <Fact label="Cost sharing">
              {gg?.cost_sharing === true
                ? "Required"
                : gg?.cost_sharing === false
                  ? "Not required"
                  : NOT_STATED}
            </Fact>
            {gg ? (
              <>
                <Fact label="Opportunity category">
                  {gg.category ? labelFor(OPPORTUNITY_CATEGORY_LABELS, gg.category) : NOT_STATED}
                  {gg.category_explanation ? ` · ${gg.category_explanation}` : ""}
                </Fact>
                <Fact label="Funding instrument">
                  {gg.funding_instruments.length
                    ? gg.funding_instruments
                        .map((c) => labelFor(FUNDING_INSTRUMENT_LABELS, c))
                        .join(", ")
                    : NOT_STATED}
                </Fact>
                <Fact label="Category of funding">
                  {gg.funding_categories.length
                    ? gg.funding_categories
                        .map((c) => labelFor(FUNDING_CATEGORY_LABELS, c))
                        .join(", ")
                    : NOT_STATED}
                  {gg.funding_category_explanation ? ` · ${gg.funding_category_explanation}` : ""}
                </Fact>
                <Fact label="Assistance Listings">
                  {gg.assistance_listings.length
                    ? gg.assistance_listings
                        .map((n) =>
                          extras.listingTitles[n] ? `${n} ${extras.listingTitles[n]}` : n,
                        )
                        .join("; ")
                    : NOT_STATED}
                </Fact>
              </>
            ) : null}
            {o.funding_details ? <Fact label="Funding notes">{o.funding_details}</Fact> : null}
          </dl>
        </CardContent>
      </Card>

      {gg ? (
        <Card>
          <CardHeader>
            <CardTitle>Who may apply</CardTitle>
            <CardDescription>
              The applicant types the agency listed. Read the agency&apos;s note before deciding;
              this page does not judge eligibility.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {gg.eligible_applicants.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {gg.eligible_applicants.map((code) => (
                  <li key={code}>{labelFor(ELIGIBILITY_LABELS, code)}</li>
                ))}
              </ul>
            ) : (
              <p>{NOT_STATED}</p>
            )}
            {gg.eligibility_description ? (
              <div className="space-y-2">
                <p className="font-medium">Additional information on eligibility</p>
                {htmlToParagraphs(gg.eligibility_description).map((p, i) => (
                  <p key={i} className="whitespace-pre-line text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {paragraphs.length ? (
            paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">{NOT_STATED}</p>
          )}
          {gg?.additional_info_url ? (
            <p>
              <a
                href={gg.additional_info_url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                {gg.additional_info_text && gg.additional_info_text !== gg.additional_info_url
                  ? gg.additional_info_text
                  : "Additional information from the agency"}{" "}
                ↗
              </a>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {gg ? (
        <Card>
          <CardHeader>
            <CardTitle>Application packages and attachments</CardTitle>
            <CardDescription>
              {extras.source || "Packages and attachments are not available for this notice."}{" "}
              Applications are submitted on Grants.gov, not here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {extras.packages.length ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-4 font-medium">Package</th>
                    <th className="py-1 pr-4 font-medium">Opens</th>
                    <th className="py-1 pr-4 font-medium">Closes</th>
                    <th className="py-1 pr-4 font-medium">Workspace</th>
                    <th className="py-1 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {extras.packages.map((p, i) => (
                    <tr key={`${p.package_id ?? i}`} className="border-t align-top">
                      <td className="py-2 pr-4">
                        {p.package_id ?? NOT_STATED}
                        {p.competition_title ? (
                          <span className="block text-xs text-muted-foreground">
                            {p.competition_title}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(p.opening_date)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(p.closing_date)}</td>
                      <td className="py-2 pr-4">
                        {p.workspace_compatible === true
                          ? "Compatible"
                          : p.workspace_compatible === false
                            ? "Not compatible"
                            : NOT_STATED}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {[
                          p.closed ? "closed package" : null,
                          p.electronic_required === true ? "electronic submission required" : null,
                          p.multi_project === true ? "multi-project" : null,
                          p.dialect ? `forms: ${p.dialect}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground">No application package is listed.</p>
            )}
            {extras.attachments.length ? (
              <ul className="space-y-1">
                {extras.attachments.map((a, i) => (
                  <li key={`${a.id ?? i}`}>
                    {a.id !== null ? (
                      <a
                        href={grantsGovAttachmentUrl(a.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4"
                      >
                        {a.file_name ?? `Attachment ${a.id}`}
                      </a>
                    ) : (
                      (a.file_name ?? "Attachment")
                    )}
                    <span className="text-xs text-muted-foreground">
                      {[a.folder, formatBytes(a.size_bytes)].filter(Boolean).map((t) => ` · ${t}`)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No attachments are listed.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {gg?.contact && Object.keys(gg.contact).length ? (
        <Card>
          <CardHeader>
            <CardTitle>Agency contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[12rem_1fr] gap-y-2 text-sm">
              {gg.contact.name ? <Fact label="Name">{gg.contact.name}</Fact> : null}
              {gg.contact.email ? (
                <Fact label="Email">
                  <a href={`mailto:${gg.contact.email}`} className="underline underline-offset-4">
                    {gg.contact.email}
                  </a>
                  {gg.contact.email_description && gg.contact.email_description !== gg.contact.email
                    ? ` · ${gg.contact.email_description}`
                    : ""}
                </Fact>
              ) : null}
              {gg.contact.phone ? <Fact label="Phone">{gg.contact.phone}</Fact> : null}
              {gg.contact.text ? (
                <Fact label="Notes">{htmlToParagraphs(gg.contact.text).join(" ")}</Fact>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Source: {o.source_system === "grants_gov" ? "Grants.gov" : o.source_system}
        {gg?.last_updated_date
          ? `, last updated by the agency ${formatDate(gg.last_updated_date)}`
          : ""}
        {gg?.version ? ` (${gg.version})` : ""}. Catalog record updated{" "}
        {formatDateTime(o.updated_at)}.
      </p>
    </div>
  );
}
