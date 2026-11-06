/**
 * Grants.gov records to the CommonGrants shape of public.opportunities. Pure functions: the extract
 * and the detail call both pass through here, and a local script can run them against a file.
 *
 * Honesty rules applied (AGENTS.md): a missing amount or date stays null and reads "Not stated"
 * on the page; a value Grants.gov states as 0 is kept as 0, because the agency stated it. Nothing
 * here says a funder is interested or an organization is eligible.
 */

import type { AgencyFacet, FetchedOpportunity, DetailBlock, CodedValue } from "./api";
import { GRANTS_GOV_SOURCE, grantsGovDetailUrl } from "./codes";
import { type ExtractRecord, all, first } from "./extract";

export type OpportunityStatus = "forecasted" | "open" | "closed" | "custom";

/** CommonGrants "other date" event. */
export interface OtherDate {
  name: string;
  eventType: "singleDate";
  date: string;
  description?: string;
}

/** Grants.gov fields with no CommonGrants home. Kept under custom_fields.grants_gov. */
export interface GrantsGovFields {
  opportunity_id: number;
  doc_type: "synopsis" | "forecast";
  agency_code?: string;
  agency_name?: string;
  top_agency_code?: string;
  category?: string;
  category_explanation?: string;
  funding_instruments: string[];
  funding_categories: string[];
  funding_category_explanation?: string;
  eligible_applicants: string[];
  eligibility_description?: string;
  assistance_listings: string[];
  cost_sharing?: boolean;
  archive_date?: string;
  archived?: boolean;
  last_updated_date?: string;
  version?: string;
  close_date_explanation?: string;
  additional_info_url?: string;
  additional_info_text?: string;
  contact?: {
    name?: string;
    email?: string;
    email_description?: string;
    phone?: string;
    text?: string;
  };
  forecast?: {
    fiscal_year?: string;
    estimated_post_date?: string;
    estimated_close_date?: string;
    estimated_close_date_explanation?: string;
    estimated_award_date?: string;
    estimated_project_start_date?: string;
  };
}

/** One row for upsert_catalog_opportunities: the CommonGrants columns of public.opportunities. */
export interface CatalogRow {
  title: string;
  description: string | null;
  status: OpportunityStatus;
  status_custom_value: string | null;
  status_description: string | null;
  funder_name: string | null;
  funding_details: string | null;
  currency: "USD";
  total_amount_available: number | null;
  min_award_amount: number | null;
  max_award_amount: number | null;
  min_award_count: number | null;
  max_award_count: number | null;
  estimated_award_count: number | null;
  post_date: string | null;
  close_date: string | null;
  close_time: string | null;
  close_time_zone: string | null;
  other_dates: OtherDate[];
  source_url: string;
  external_id: string;
  opportunity_number: string | null;
  external_ids: { grants_gov_opportunity_id: number; grants_gov_opportunity_number?: string };
  custom_fields: { grants_gov: GrantsGovFields };
}

export interface Agency {
  code: string;
  name: string;
  top_agency_code: string;
}

export interface Listing {
  number: string;
  title: string | null;
}

export interface DetailPackageRow {
  package_id: string | null;
  dialect: string | null;
  opening_date: string | null;
  closing_date: string | null;
  workspace_compatible: boolean | null;
  electronic_required: boolean | null;
  multi_project: boolean | null;
  competition_id: string | null;
  competition_title: string | null;
  program_title: string | null;
  assistance_listing: string | null;
  closed: boolean;
}

export interface DetailAttachmentRow {
  id: number | null;
  file_name: string | null;
  description: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  folder: string | null;
  created: string | null;
}

/** One row for public.opportunity_details, keyed by the Grants.gov id until the uuid is known. */
export interface DetailsRow {
  external_id: string;
  source_system: typeof GRANTS_GOV_SOURCE;
  fetched_at: string;
  revision: number | null;
  packages: DetailPackageRow[];
  attachments: DetailAttachmentRow[];
  assistance_listings: Listing[];
  details: {
    status_at_source: string | null;
    assist_compatible: boolean | null;
    assist_url: string | null;
    related_opportunity_count: number;
    funding_description_url: string | null;
    close_date_explanation: string | null;
  };
}

const MAX_MONEY = 99_999_999_999_999; // numeric(16, 2) in the table
const MAX_INT = 2_147_483_647;
const DAY = 24 * 60 * 60 * 1000;

/** Grants.gov extract dates are MMDDYYYY. Returns YYYY-MM-DD or null when not a date. */
export function parseExtractDate(value: string | undefined): string | null {
  if (!value || !/^\d{8}$/.test(value)) return null;
  const month = Number(value.slice(0, 2));
  const day = Number(value.slice(2, 4));
  const year = Number(value.slice(4));
  return validDate(year, month, day);
}

/** Detail-call dates are "YYYY-MM-DD-HH-MM-SS". Returns YYYY-MM-DD or null. */
export function parseDetailDate(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function validDate(year: number, month: number, day: number): string | null {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** A whole-dollar amount as the extract or the detail call states it, or null when absent. */
export function parseMoney(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const amount = Number(text);
  return Number.isFinite(amount) && amount <= MAX_MONEY ? amount : null;
}

export function parseCount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const count = Number(text);
  return count <= MAX_INT ? count : null;
}

export function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** YYYY-MM-DD for a moment in Grants.gov's time zone (Eastern). */
export function easternIsoDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** HHS for HHS-ACF-ORR, USAID for USAID-GS; a top-level code is its own department. */
export function topAgencyCode(code: string): string {
  return code.split("-")[0].trim() || code;
}

function trimTo(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function stripUndefined<T extends object>(object: T): T {
  return Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined)) as T;
}

/** Status in the CommonGrants vocabulary, from the dates Grants.gov gives. */
function decideStatus(input: {
  forecast: boolean;
  closeDate: string | null;
  archiveDate: string | null;
  today: string;
}): { status: OpportunityStatus; description: string | null; archived: boolean } {
  const archived = input.archiveDate !== null && input.archiveDate < input.today;
  if (input.forecast) {
    return {
      status: "forecasted",
      description: archived
        ? "Forecast archived on Grants.gov; dates were estimates"
        : "Forecast on Grants.gov; dates are the agency's estimates",
      archived,
    };
  }
  if (archived) return { status: "closed", description: "Archived on Grants.gov", archived };
  if (input.closeDate === null) {
    return { status: "open", description: "No close date stated on Grants.gov", archived };
  }
  if (input.closeDate < input.today) return { status: "closed", description: null, archived };
  return { status: "open", description: null, archived };
}

function fundingDetails(
  costSharing: boolean | undefined,
  floorAboveCeiling: boolean,
): string | null {
  const parts: string[] = [];
  if (costSharing === true) parts.push("Cost sharing or matching is required.");
  if (costSharing === false) parts.push("No cost sharing or matching requirement.");
  if (floorAboveCeiling) {
    parts.push(
      "Grants.gov lists an award floor above the award ceiling; the floor is left out here.",
    );
  }
  return parts.length ? parts.join(" ") : null;
}

function money(input: { ceiling: number | null; floor: number | null }): {
  max: number | null;
  min: number | null;
  floorAboveCeiling: boolean;
} {
  const floorAboveCeiling =
    input.floor !== null && input.ceiling !== null && input.floor > input.ceiling;
  return { max: input.ceiling, min: floorAboveCeiling ? null : input.floor, floorAboveCeiling };
}

/**
 * One extract record to one catalog row. Returns null for a record without an id or a title.
 * `today` is the Eastern date the run started, as YYYY-MM-DD.
 */
export function mapExtractRecord(record: ExtractRecord, today: string): CatalogRow | null {
  const idText = first(record, "OpportunityID");
  const title = trimTo(first(record, "OpportunityTitle"), 1000);
  if (!idText || !/^\d{1,12}$/.test(idText) || !title) return null;
  const id = Number(idText);
  const forecast = record.kind === "forecast";

  const postDate = parseExtractDate(first(record, "PostDate"));
  const archiveDate = parseExtractDate(first(record, "ArchiveDate"));
  const estimatedClose = parseExtractDate(first(record, "EstimatedSynopsisCloseDate"));
  const closeDate = forecast ? estimatedClose : parseExtractDate(first(record, "CloseDate"));
  const decided = decideStatus({ forecast, closeDate, archiveDate, today });

  const costSharingText = first(record, "CostSharingOrMatchingRequirement");
  const costSharing =
    costSharingText === "Yes" ? true : costSharingText === "No" ? false : undefined;
  const amounts = money({
    ceiling: parseMoney(first(record, "AwardCeiling")),
    floor: parseMoney(first(record, "AwardFloor")),
  });

  const agencyCode = trimTo(first(record, "AgencyCode"), 80);
  const agencyName = trimTo(first(record, "AgencyName"), 300);
  const number = trimTo(first(record, "OpportunityNumber"), 200);

  const otherDates: OtherDate[] = [];
  if (archiveDate) {
    otherDates.push({
      name: "Archive date",
      eventType: "singleDate",
      date: archiveDate,
      description: "Removed from Grants.gov search on this date",
    });
  }
  const forecastDates = forecast
    ? stripUndefined({
        fiscal_year: trimTo(first(record, "FiscalYear"), 10),
        estimated_post_date:
          parseExtractDate(first(record, "EstimatedSynopsisPostDate")) ?? undefined,
        estimated_close_date: estimatedClose ?? undefined,
        estimated_close_date_explanation: trimTo(
          first(record, "EstimatedSynopsisCloseDateExplanation"),
          2000,
        ),
        estimated_award_date: parseExtractDate(first(record, "EstimatedAwardDate")) ?? undefined,
        estimated_project_start_date:
          parseExtractDate(first(record, "EstimatedProjectStartDate")) ?? undefined,
      })
    : undefined;
  if (forecastDates) {
    const named: [string, string | undefined][] = [
      ["Estimated synopsis post date", forecastDates.estimated_post_date],
      ["Estimated award date", forecastDates.estimated_award_date],
      ["Estimated project start date", forecastDates.estimated_project_start_date],
    ];
    for (const [name, date] of named) {
      if (date)
        otherDates.push({ name, eventType: "singleDate", date, description: "Agency estimate" });
    }
  }

  const contact = stripUndefined({
    name: trimTo(first(record, "GrantorContactName"), 300),
    email: trimTo(first(record, "GrantorContactEmail"), 300),
    email_description: trimTo(first(record, "GrantorContactEmailDescription"), 500),
    phone: trimTo(first(record, "GrantorContactPhoneNumber"), 100),
    text: trimTo(first(record, "GrantorContactText"), 2000),
  });

  const fields: GrantsGovFields = stripUndefined({
    opportunity_id: id,
    doc_type: record.kind,
    agency_code: agencyCode,
    agency_name: agencyName,
    top_agency_code: agencyCode ? topAgencyCode(agencyCode) : undefined,
    category: trimTo(first(record, "OpportunityCategory"), 10),
    category_explanation: trimTo(first(record, "OpportunityCategoryExplanation"), 1000),
    funding_instruments: all(record, "FundingInstrumentType"),
    funding_categories: all(record, "CategoryOfFundingActivity"),
    funding_category_explanation: trimTo(first(record, "CategoryExplanation"), 1000),
    eligible_applicants: all(record, "EligibleApplicants"),
    eligibility_description: trimTo(first(record, "AdditionalInformationOnEligibility"), 4000),
    assistance_listings: all(record, "CFDANumbers").filter((n) => /^\d{2}\.[0-9A-Z]{3}$/.test(n)),
    cost_sharing: costSharing,
    archive_date: archiveDate ?? undefined,
    archived: decided.archived || undefined,
    last_updated_date: parseExtractDate(first(record, "LastUpdatedDate")) ?? undefined,
    version: trimTo(first(record, "Version"), 50),
    close_date_explanation: trimTo(first(record, "CloseDateExplanation"), 2000),
    additional_info_url: trimTo(first(record, "AdditionalInformationURL"), 1000),
    additional_info_text: trimTo(first(record, "AdditionalInformationText"), 2000),
    contact: Object.keys(contact).length ? contact : undefined,
    forecast: forecastDates && Object.keys(forecastDates).length ? forecastDates : undefined,
  });

  return {
    title,
    description: first(record, "Description") ?? null,
    status: decided.status,
    status_custom_value: null,
    status_description: decided.description,
    funder_name: agencyName ?? null,
    funding_details: fundingDetails(costSharing, amounts.floorAboveCeiling),
    currency: "USD",
    total_amount_available: parseMoney(first(record, "EstimatedTotalProgramFunding")),
    min_award_amount: amounts.min,
    max_award_amount: amounts.max,
    min_award_count: null,
    max_award_count: null,
    estimated_award_count: parseCount(first(record, "ExpectedNumberOfAwards")),
    post_date: postDate,
    close_date: closeDate,
    close_time: null,
    close_time_zone: null,
    other_dates: otherDates,
    source_url: grantsGovDetailUrl(id),
    external_id: String(id),
    opportunity_number: number ?? null,
    external_ids: stripUndefined({
      grants_gov_opportunity_id: id,
      grants_gov_opportunity_number: number,
    }),
    custom_fields: { grants_gov: fields },
  };
}

/**
 * Which extract records the nightly job loads. The extract holds every record since 2004 (about
 * 84,000); the catalog keeps the ones a grant seeker can still act on or learn from: forecasts,
 * open opportunities, and ones closed within the last year. Archived records are skipped unless
 * they are already in the catalog, so a tracked grant keeps hearing about its opportunity.
 */
export function shouldLoad(row: CatalogRow, today: string, known: ReadonlySet<string>): boolean {
  if (known.has(row.external_id)) return true;
  if (row.custom_fields.grants_gov.archived) return false;
  if (row.status === "forecasted") return true;
  const cutoff = addDays(today, -365);
  if (row.close_date === null) return row.post_date !== null && row.post_date >= cutoff;
  return row.close_date >= cutoff;
}

function codes(values: CodedValue[] | undefined): string[] {
  return (values ?? []).map((v) => v.id).filter((id): id is string => Boolean(id));
}

function yesNo(value: string | undefined): boolean | null {
  return value === "Y" ? true : value === "N" ? false : null;
}

function blockFor(detail: FetchedOpportunity): { block: DetailBlock; forecast: boolean } | null {
  if (detail.docType === "forecast" && detail.forecast)
    return { block: detail.forecast, forecast: true };
  if (detail.synopsis) return { block: detail.synopsis, forecast: false };
  if (detail.forecast) return { block: detail.forecast, forecast: true };
  return null;
}

/**
 * One detail-call record to a catalog row, its details row, and the agency and Assistance
 * Listing rows it mentions. Returns null when the record has no usable block or title.
 */
export function mapFetchedOpportunity(
  detail: FetchedOpportunity,
  today: string,
  fetchedAt: Date,
): { row: CatalogRow; details: DetailsRow; agencies: Agency[]; listings: Listing[] } | null {
  const chosen = blockFor(detail);
  const title = trimTo(detail.opportunityTitle, 1000);
  if (!chosen || !title) return null;
  const { block, forecast } = chosen;
  const id = detail.id;

  const postDate = parseDetailDate(block.postingDateStr);
  const archiveDate = parseDetailDate(block.archiveDateStr);
  const estimatedClose = parseDetailDate(block.estApplicationResponseDateStr);
  const closeDate = forecast ? estimatedClose : parseDetailDate(block.responseDateStr);
  const decided = decideStatus({ forecast, closeDate, archiveDate, today });
  if (detail.ost === "ARCHIVED") {
    decided.archived = true;
    if (!forecast) {
      decided.status = "closed";
      decided.description = "Archived on Grants.gov";
    }
  }
  const amounts = money({
    ceiling: parseMoney(block.awardCeiling),
    floor: parseMoney(block.awardFloor),
  });

  const agencyCode = trimTo(detail.agencyDetails?.agencyCode ?? block.agencyCode, 80);
  const agencyName = trimTo(detail.agencyDetails?.agencyName ?? block.agencyName, 300);
  const topCode =
    trimTo(detail.agencyDetails?.topAgencyCode, 80) ??
    (agencyCode ? topAgencyCode(agencyCode) : undefined);
  const number = trimTo(detail.opportunityNumber, 200);

  const listings: Listing[] = (detail.cfdas ?? [])
    .map((c) => ({
      number: (c.cfdaNumber ?? "").trim(),
      title: trimTo(c.programTitle, 500) ?? null,
    }))
    .filter((l) => /^\d{2}\.[0-9A-Z]{3}$/.test(l.number));

  const agencies: Agency[] = [];
  if (agencyCode && agencyName) {
    agencies.push({
      code: agencyCode,
      name: agencyName,
      top_agency_code: topCode ?? topAgencyCode(agencyCode),
    });
  }
  const top = detail.topAgencyDetails;
  if (top?.agencyCode && top.agencyName && top.agencyCode !== agencyCode) {
    agencies.push({ code: top.agencyCode, name: top.agencyName, top_agency_code: top.agencyCode });
  }

  const otherDates: OtherDate[] = [];
  if (archiveDate) {
    otherDates.push({
      name: "Archive date",
      eventType: "singleDate",
      date: archiveDate,
      description: "Removed from Grants.gov search on this date",
    });
  }
  const forecastDates = forecast
    ? stripUndefined({
        fiscal_year: block.fiscalYear === undefined ? undefined : String(block.fiscalYear),
        estimated_post_date: parseDetailDate(block.estSynopsisPostingDateStr) ?? undefined,
        estimated_close_date: estimatedClose ?? undefined,
        estimated_close_date_explanation: trimTo(block.estApplicationResponseDateDesc, 2000),
        estimated_award_date: parseDetailDate(block.estAwardDateStr) ?? undefined,
        estimated_project_start_date: parseDetailDate(block.estProjectStartDateStr) ?? undefined,
      })
    : undefined;
  if (forecastDates) {
    const named: [string, string | undefined][] = [
      ["Estimated synopsis post date", forecastDates.estimated_post_date],
      ["Estimated award date", forecastDates.estimated_award_date],
      ["Estimated project start date", forecastDates.estimated_project_start_date],
    ];
    for (const [name, date] of named) {
      if (date)
        otherDates.push({ name, eventType: "singleDate", date, description: "Agency estimate" });
    }
  }

  const contact = stripUndefined({
    name: trimTo(block.agencyContactName, 300),
    email: trimTo(block.agencyContactEmail, 300),
    email_description: trimTo(block.agencyContactEmailDesc, 500),
    phone: trimTo(block.agencyContactPhone, 100),
    text: trimTo(block.agencyContactDesc, 2000),
  });

  const fields: GrantsGovFields = stripUndefined({
    opportunity_id: id,
    doc_type: forecast ? "forecast" : "synopsis",
    agency_code: agencyCode,
    agency_name: agencyName,
    top_agency_code: topCode,
    category: trimTo(detail.opportunityCategory?.category, 10),
    category_explanation: undefined,
    funding_instruments: codes(block.fundingInstruments),
    funding_categories: codes(block.fundingActivityCategories),
    eligible_applicants: codes(block.applicantTypes),
    eligibility_description: trimTo(block.applicantEligibilityDesc, 4000),
    assistance_listings: listings.map((l) => l.number),
    cost_sharing: typeof block.costSharing === "boolean" ? block.costSharing : undefined,
    archive_date: archiveDate ?? undefined,
    archived: decided.archived || undefined,
    last_updated_date: undefined,
    version:
      block.version === undefined
        ? undefined
        : `${forecast ? "Forecast" : "Synopsis"} ${block.version}`,
    close_date_explanation: trimTo(forecast ? undefined : block.responseDateDesc, 2000),
    additional_info_url: trimTo(block.fundingDescLinkUrl, 1000),
    additional_info_text: trimTo(block.fundingDescLinkDesc, 2000),
    contact: Object.keys(contact).length ? contact : undefined,
    forecast: forecastDates && Object.keys(forecastDates).length ? forecastDates : undefined,
  });

  const row: CatalogRow = {
    title,
    description: (forecast ? block.forecastDesc : block.synopsisDesc) ?? null,
    status: decided.status,
    status_custom_value: null,
    status_description: decided.description,
    funder_name: agencyName ?? null,
    funding_details: fundingDetails(fields.cost_sharing, amounts.floorAboveCeiling),
    currency: "USD",
    total_amount_available: parseMoney(block.estimatedFunding),
    min_award_amount: amounts.min,
    max_award_amount: amounts.max,
    min_award_count: null,
    max_award_count: null,
    estimated_award_count: parseCount(block.numberOfAwards),
    post_date: postDate,
    close_date: closeDate,
    close_time: null,
    close_time_zone: null,
    other_dates: otherDates,
    source_url: grantsGovDetailUrl(id),
    external_id: String(id),
    opportunity_number: number ?? null,
    external_ids: stripUndefined({
      grants_gov_opportunity_id: id,
      grants_gov_opportunity_number: number,
    }),
    custom_fields: { grants_gov: fields },
  };

  const packageRow = (
    p: NonNullable<FetchedOpportunity["opportunityPkgs"]>[number],
    closed: boolean,
  ): DetailPackageRow => ({
    package_id: trimTo(p.packageId, 50) ?? null,
    dialect: trimTo(p.dialect, 50) ?? null,
    opening_date: parseDetailDate(p.openingDate) ?? null,
    closing_date: parseDetailDate(p.closingDate) ?? null,
    workspace_compatible: yesNo(p.workspaceCompatibleFlag),
    electronic_required: yesNo(p.electronicRequired),
    multi_project: yesNo(p.isMultiProject),
    competition_id: trimTo(p.competitionId, 200) ?? null,
    competition_title: trimTo(p.competitionTitle, 500) ?? null,
    program_title: trimTo(p.programTitle, 500) ?? null,
    assistance_listing: trimTo(p.cfdaNumber, 20) ?? null,
    closed,
  });

  const attachments: DetailAttachmentRow[] = [];
  for (const folder of detail.synopsisAttachmentFolders ?? []) {
    for (const a of folder.synopsisAttachments ?? []) {
      attachments.push({
        id: typeof a.id === "number" ? a.id : null,
        file_name: trimTo(a.fileName, 500) ?? null,
        description: trimTo(a.fileDescription, 1000) ?? null,
        mime_type: trimTo(a.mimeType, 200) ?? null,
        size_bytes: typeof a.fileLobSize === "number" ? a.fileLobSize : null,
        folder: trimTo(folder.folderType, 200) ?? null,
        created: trimTo(a.createdDate, 100) ?? null,
      });
    }
  }

  const details: DetailsRow = {
    external_id: String(id),
    source_system: GRANTS_GOV_SOURCE,
    fetched_at: fetchedAt.toISOString(),
    revision: typeof detail.revision === "number" ? detail.revision : null,
    packages: [
      ...(detail.opportunityPkgs ?? []).map((p) => packageRow(p, false)),
      ...(detail.closedOpportunityPkgs ?? []).map((p) => packageRow(p, true)),
    ],
    attachments,
    assistance_listings: listings,
    details: {
      status_at_source: trimTo(detail.ost, 20) ?? null,
      assist_compatible:
        typeof detail.assistCompatible === "boolean" ? detail.assistCompatible : null,
      assist_url: trimTo(detail.assistURL, 1000) ?? null,
      related_opportunity_count: Array.isArray(detail.relatedOpps) ? detail.relatedOpps.length : 0,
      funding_description_url: trimTo(block.fundingDescLinkUrl, 1000) ?? null,
      close_date_explanation:
        trimTo(forecast ? block.estApplicationResponseDateDesc : block.responseDateDesc, 2000) ??
        null,
    },
  };

  return { row, details, agencies, listings };
}

/** The agency list from search2's facets: departments and their sub-agencies. */
export function agenciesFromFacets(facets: AgencyFacet[] | undefined): Agency[] {
  const agencies: Agency[] = [];
  for (const top of facets ?? []) {
    const topCode = trimTo(top.value, 80);
    const topName = trimTo(top.label, 300);
    if (!topCode || !topName) continue;
    agencies.push({ code: topCode, name: topName, top_agency_code: topCode });
    for (const sub of top.subAgencyOptions ?? []) {
      const code = trimTo(sub.value, 80);
      const name = trimTo(sub.label, 300);
      if (code && name && code !== topCode) agencies.push({ code, name, top_agency_code: topCode });
    }
  }
  return agencies;
}
