/**
 * Grants.gov code tables, as the search API's facets state them (checked 2026-11-05). Pure data:
 * pages, the mapper and tests import it freely.
 */

/** Eligible applicant codes. 12 and 13 are the two nonprofit categories. */
export const ELIGIBILITY_LABELS: Record<string, string> = {
  "00": "State governments",
  "01": "County governments",
  "02": "City or township governments",
  "04": "Special district governments",
  "05": "Independent school districts",
  "06": "Public and State controlled institutions of higher education",
  "07": "Native American tribal governments (Federally recognized)",
  "08": "Public housing authorities/Indian housing authorities",
  "11": "Native American tribal organizations (other than Federally recognized tribal governments)",
  "12": "Nonprofits having a 501(c)(3) status with the IRS, other than institutions of higher education",
  "13": "Nonprofits that do not have a 501(c)(3) status with the IRS, other than institutions of higher education",
  "20": "Private institutions of higher education",
  "21": "Individuals",
  "22": "For profit organizations other than small businesses",
  "23": "Small businesses",
  "25": "Others (see the additional information on eligibility)",
  "99": "Unrestricted (open to any type of entity, subject to the additional information on eligibility)",
};

/** The two eligibility codes that mean "nonprofit". The browse page starts with these selected. */
export const NONPROFIT_ELIGIBILITIES = ["12", "13"] as const;

/** Category of funding activity. */
export const FUNDING_CATEGORY_LABELS: Record<string, string> = {
  ACA: "Affordable Care Act",
  AG: "Agriculture",
  AR: "Arts",
  BC: "Business and Commerce",
  CD: "Community Development",
  CP: "Consumer Protection",
  DPR: "Disaster Prevention and Relief",
  ED: "Education",
  ELT: "Employment, Labor and Training",
  EN: "Energy",
  EIC: "Energy Infrastructure and Critical Mineral and Materials",
  ENV: "Environment",
  FN: "Food and Nutrition",
  HL: "Health",
  HO: "Housing",
  HU: "Humanities",
  ISS: "Income Security and Social Services",
  IS: "Information and Statistics",
  IIJ: "Infrastructure Investment and Jobs Act",
  LJL: "Law, Justice and Legal Services",
  NR: "Natural Resources",
  OZ: "Opportunity Zone Benefits",
  O: "Other (see the explanation of other category)",
  RA: "Recovery Act",
  RT: "Recreation and Tourism",
  RD: "Regional Development",
  ST: "Science and Technology and other Research and Development",
  T: "Transportation",
};

export const FUNDING_INSTRUMENT_LABELS: Record<string, string> = {
  CA: "Cooperative Agreement",
  G: "Grant",
  O: "Other",
  PC: "Procurement Contract",
};

export const OPPORTUNITY_CATEGORY_LABELS: Record<string, string> = {
  D: "Discretionary",
  M: "Mandatory",
  C: "Continuation",
  E: "Earmark",
  O: "Other",
};

/** A code's label, or the code itself when Grants.gov adds one we do not know yet. */
export function labelFor(table: Record<string, string>, code: string): string {
  return table[code] ?? code;
}

/** The public page for an opportunity, by its numeric Grants.gov id. */
export function grantsGovDetailUrl(opportunityId: number | string): string {
  return `https://www.grants.gov/search-results-detail/${opportunityId}`;
}

/** Where an attachment downloads from (no sign-in needed). */
export function grantsGovAttachmentUrl(attachmentId: number | string): string {
  return `https://apply07.grants.gov/grantsws/rest/opportunity/att/download/${attachmentId}`;
}

export const GRANTS_GOV_SOURCE = "grants_gov";
