/**
 * The two Grants.gov REST calls the app uses. Neither needs a key (checked 2026-11-05). Shapes
 * follow the live responses, which differ a little from the documentation (`agency` and `cfdaList`
 * rather than `agencyName` and `alnist`).
 */

export const SEARCH2_URL = "https://api.grants.gov/v1/api/search2";
export const FETCH_OPPORTUNITY_URL = "https://api.grants.gov/v1/api/fetchOpportunity";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SearchParams {
  keyword?: string;
  /** Pipe-separated, for example "forecasted|posted". */
  oppStatuses?: string;
  /** Posted in the last N days, as a string: "3", "7", "14". */
  dateRange?: string;
  /** Pipe-separated eligibility codes, for example "12|13". */
  eligibilities?: string;
  rows?: number;
  startRecordNum?: number;
  sortBy?: string;
}

export interface SearchHit {
  id: string;
  number: string;
  title: string;
  agencyCode?: string;
  agency?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: "posted" | "forecasted" | "closed" | "archived";
  docType?: "synopsis" | "forecast";
  cfdaList?: string[];
}

export interface AgencyFacet {
  label: string;
  value: string;
  subAgencyOptions?: { label: string; value: string }[];
}

export interface SearchResponse {
  hitCount: number;
  startRecord: number;
  oppHits: SearchHit[];
  agencies?: AgencyFacet[];
}

interface Envelope<T> {
  errorcode?: number;
  msg?: string;
  data?: T;
}

async function post<T>(url: string, body: unknown, fetchFn: FetchLike): Promise<T | undefined> {
  const response = await fetchFn(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Grants.gov answered ${response.status} for ${url}`);
  const envelope = (await response.json()) as Envelope<T>;
  if (envelope.errorcode && envelope.errorcode !== 0) {
    throw new Error(`Grants.gov error ${envelope.errorcode}: ${envelope.msg ?? "no message"}`);
  }
  return envelope.data;
}

export async function search2(
  params: SearchParams,
  fetchFn: FetchLike = fetch,
): Promise<SearchResponse> {
  const data = await post<Partial<SearchResponse>>(
    SEARCH2_URL,
    { rows: 25, startRecordNum: 0, ...params },
    fetchFn,
  );
  return {
    hitCount: Number(data?.hitCount ?? 0),
    startRecord: Number(data?.startRecord ?? 0),
    oppHits: Array.isArray(data?.oppHits) ? data.oppHits : [],
    agencies: Array.isArray(data?.agencies) ? data.agencies : [],
  };
}

/** A coded value with its label, as the detail call returns applicant types and categories. */
export interface CodedValue {
  id?: string;
  description?: string;
}

/** The synopsis or forecast block of a detail record. Dates come as "YYYY-MM-DD-HH-MM-SS" strings. */
export interface DetailBlock {
  agencyCode?: string;
  agencyName?: string;
  agencyContactName?: string;
  agencyContactEmail?: string;
  agencyContactEmailDesc?: string;
  agencyContactPhone?: string;
  agencyContactDesc?: string;
  synopsisDesc?: string;
  forecastDesc?: string;
  applicantEligibilityDesc?: string;
  costSharing?: boolean;
  numberOfAwards?: number | string | null;
  estimatedFunding?: number | string | null;
  awardCeiling?: number | string | null;
  awardFloor?: number | string | null;
  fundingDescLinkUrl?: string;
  fundingDescLinkDesc?: string;
  responseDateDesc?: string;
  estApplicationResponseDateDesc?: string;
  fiscalYear?: number | string;
  version?: number | string;
  applicantTypes?: CodedValue[];
  fundingInstruments?: CodedValue[];
  fundingActivityCategories?: CodedValue[];
  postingDateStr?: string;
  responseDateStr?: string;
  archiveDateStr?: string;
  estSynopsisPostingDateStr?: string;
  estApplicationResponseDateStr?: string;
  estAwardDateStr?: string;
  estProjectStartDateStr?: string;
  lastUpdatedDate?: string;
}

export interface DetailPackage {
  id?: number;
  packageId?: string;
  dialect?: string;
  openingDate?: string;
  closingDate?: string;
  workspaceCompatibleFlag?: "Y" | "N" | string;
  electronicRequired?: "Y" | "N" | string;
  isMultiProject?: "Y" | "N" | string;
  competitionId?: string;
  competitionTitle?: string;
  programTitle?: string;
  cfdaNumber?: string;
  gracePeriod?: number;
}

export interface DetailAttachment {
  id?: number;
  fileName?: string;
  fileDescription?: string;
  mimeType?: string;
  fileLobSize?: number;
  createdDate?: string;
}

export interface FetchedOpportunity {
  id: number;
  revision?: number;
  opportunityNumber?: string;
  opportunityTitle?: string;
  owningAgencyCode?: string;
  opportunityCategory?: { category?: string; description?: string };
  docType?: "synopsis" | "forecast";
  /** POSTED, FORECASTED, CLOSED or ARCHIVED. */
  ost?: string;
  synopsis?: DetailBlock;
  forecast?: DetailBlock;
  agencyDetails?: { agencyCode?: string; agencyName?: string; topAgencyCode?: string };
  topAgencyDetails?: { agencyCode?: string; agencyName?: string };
  cfdas?: { cfdaNumber?: string; programTitle?: string }[];
  synopsisAttachmentFolders?: {
    folderType?: string;
    synopsisAttachments?: DetailAttachment[];
  }[];
  opportunityPkgs?: DetailPackage[];
  closedOpportunityPkgs?: DetailPackage[];
  assistCompatible?: boolean;
  assistURL?: string;
  relatedOpps?: unknown[];
}

/** One opportunity's full record, or null when Grants.gov has no record for the id. */
export async function fetchOpportunity(
  opportunityId: number,
  fetchFn: FetchLike = fetch,
): Promise<FetchedOpportunity | null> {
  const data = await post<FetchedOpportunity>(FETCH_OPPORTUNITY_URL, { opportunityId }, fetchFn);
  if (!data || typeof data !== "object" || typeof data.id !== "number") return null;
  return data;
}
