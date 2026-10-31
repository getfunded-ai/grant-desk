# Government grant data and integrations (research, Oct 30, 2026)

Method note: everything below was checked today against official docs by fetch, and live `curl` calls were made to Grants.gov, Simpler.Grants.gov, USAspending, SBIR.gov and data.ca.gov to confirm response shapes. Michigan, Florida and Colorado state portals and a few vendor platforms are marked unconfirmed.

### B1. Grants.gov

**B1a. Search2 and fetchOpportunity (REST)**
- Docs: https://www.grants.gov/api/common/search2.
- Auth: none. "Authentication and authorization is not required for search2". Rate limits: none documented.
- Request (confirmed live, `POST https://api.grants.gov/v1/api/search2`, JSON body): `keyword`, `oppNum`, `cfda`/`aln`, `oppStatuses` (pipe-delimited, e.g. `"forecasted|posted"`), `eligibilities` (pipe-delimited codes; `"12|13"` = 501(c)(3) and non-501(c)(3) nonprofits), `fundingCategories` (`"HL|ED"`), `fundingInstruments`, `agencies`, `dateRange` (`"7"` = posted in last 7 days), `rows`, `startRecordNum` (offset paging), `sortBy` (`"openDate|desc"`).
- Response (live): `errorcode`, `msg`, `token`, `data.hitCount`, `data.startRecord`, `data.oppHits[]` with `id` (legacy opportunity ID), `number`, `title`, `agencyCode`, `agency`, `openDate` (MM/DD/YYYY), `closeDate`, `oppStatus` (`posted|forecasted|closed|archived`), `docType` (`synopsis|forecast`), `cfdaList[]`; plus facet arrays with `label/value/count`. The doc page spells two fields `agencyName` and `alnist`, but the live API returns `agency` and `cfdaList`.
- Corpus size today: 443 posted, 418 forecasted, 3,062 closed, 25,571 archived.
- fetchOpportunity (live, `POST https://api.grants.gov/v1/api/fetchOpportunity` with `{"opportunityId": 364159}`): `id`, `revision`, `opportunityNumber`, `opportunityTitle`, `owningAgencyCode`, `opportunityCategory`, `agencyDetails`, `topAgencyDetails`, `cfdas[]{cfdaNumber, programTitle}`, `synopsis{...}` or `forecast{...}`, `synopsisAttachmentFolders[]{folderType, synopsisAttachments[]{fileName,id}}`, `opportunityPkgs[]{packageId, dialect, openingDate, closingDate, isMultiProject, workspaceCompatibleFlag, electronicRequired}`, `closedOpportunityPkgs`, `assistCompatible`, `assistURL`, `relatedOpps`, `opportunityHistoryDetails`. `synopsis` carries `applicantTypes[]`, `applicantEligibilityDesc`, `fundingActivityCategories[]`, `fundingInstruments[]`, `awardCeiling`, `awardFloor`, `estimatedFunding`, `expectedNumberOfAwards`, `costSharing`, `postingDate`, `responseDate`, `archiveDate`, agency contact fields, `synopsisDesc`, `version`.
- Attachments download without auth from `https://apply07.grants.gov/grantsws/rest/opportunity/att/download/{attachmentId}`. Public detail page: `https://www.grants.gov/search-results-detail/{id}`.
- Gotchas: US-formatted dates; `estimatedFunding` often null; the numeric `id` is also exposed by Simpler.Grants.gov at `/v1/opportunities/{legacy_opportunity_id}`, a bridge between the systems.
- Verdict: **v1** (primary live search and detail source).

**B1b. Daily XML extract**
- Docs: https://www.grants.gov/xml-extract and https://www.grants.gov/help/xml-extract/.
- URL: `https://prod-grants-gov-chatbot.s3.amazonaws.com/extracts/GrantsDBExtractYYYYMMDDv2.zip`; generated daily about 4:40 am ET; about 78 MB (HEAD today: 200, `Content-Length: 78365517`, `Last-Modified: Fri, 30 Oct 2026 08:41:59 GMT`).
- Schema: XSD inside the zip; records `OpportunitySynopsisDetail_1_0` and `OpportunityForecastDetail_1_0`; blank fields omitted. Fields include OpportunityID, OpportunityTitle, OpportunityNumber, OpportunityCategory, FundingInstrumentType, CategoryOfFundingActivity, CFDANumbers, EligibleApplicants, AdditionalInformationOnEligibility, AgencyCode, AgencyName, PostDate, CloseDate, LastUpdatedDate, AwardCeiling, AwardFloor, EstimatedTotalProgramFunding, ExpectedNumberOfAwards, Description, Version, CostSharingOrMatchingRequirement, ArchiveDate, GrantorContact fields; forecasts add EstimatedSynopsisPostDate, EstimatedAwardDate, EstimatedProjectStartDate, FiscalYear.
- Verdict: **v1** for nightly bulk load.

**B1c. Simpler.Grants.gov and CommonGrants**
- Status: search, opportunity pages, REST API (late 2024), Login.gov (early 2025), saved searches, API keys (mid 2025), Workspace dashboard and an "Apply" workflow with two opportunities (late 2025); early 2026 made Simpler Search the default and started testing apply with partner agencies; 2027 target is replacing legacy Grants.gov (https://simpler.grants.gov/roadmap). Release notes: Feb 4, 2026 and May 18, 2026 (https://wiki.simpler.grants.gov/product/release-notes.md). Opportunity pages still say to go to www.grants.gov to apply.
- API key: sign in with Login.gov at https://simpler.grants.gov/developer, then "Manage API Keys"; default 60 requests/minute and 10,000/day per key; keys unused 30 days are disabled; read-only. Header `X-API-Key`; base `https://api.simpler.grants.gov`; `page_size` 1–100; dates `YYYY-MM-DD`.
- OpenAPI: https://api.simpler.grants.gov/openapi.json. Public-key endpoints: `POST /v1/opportunities/search` (JSON or CSV), `GET /v1/opportunities/{opportunity_id}`, `GET /v1/opportunities/{legacy_opportunity_id}`, `POST /v1/agencies/search`, `POST /v1/extracts`, and CommonGrants routes `GET /common-grants/opportunities`, `GET /common-grants/opportunities/{oppId}`, `POST /common-grants/opportunities/search`. Apply endpoints exist only under `/alpha/applications/*` with a user JWT, not an API key.
- Fields: `opportunity_id` (UUID), `legacy_opportunity_id`, `opportunity_number`, `opportunity_title`, `opportunity_status`, `agency_code`, `agency_name`, `top_level_agency_code/name`, `category`, `opportunity_assistance_listings[]`, `summary{post_date, close_date, archive_date, award_ceiling, award_floor, estimated_total_program_funding, expected_number_of_awards, is_cost_sharing, applicant_types[], funding_categories[], funding_instruments[], summary_description, applicant_eligibility_description, agency_contact_description, agency_email_address, additional_info_url, is_forecast, forecasted_* dates, fiscal_year, version_number}` plus attachments. Filters include `applicant_type` (e.g. `nonprofits_non_higher_education_with_501c3`).
- Extracts: `POST /v1/extracts` lists full-dataset files (`opportunities_json`, `opportunities_csv`) with pre-signed download URLs.
- CommonGrants: HHS SimplerGrants open standard (https://commongrants.org/; https://github.com/HHS/simpler-grants-protocol). Spec v0.5.0. `OpportunityBase`: `id`, `title`, `status{value: forecasted|open|closed|custom, customValue, description}`, `description`, `funding{totalAmountAvailable, minAwardAmount, maxAwardAmount, minAwardCount, maxAwardCount, estimatedAwardCount}`, `keyDates{postDate, closeDate, otherDates}`, `source`, `customFields`, `createdAt`, `lastModifiedAt`. `Money` is `{amount: decimal string, currency}`; `Event` is `singleDate | dateRange | other`. Packages: `@common-grants/core`, `@common-grants/cli`, `@common-grants/sdk`, Python `common-grants-sdk`. Only one production implementation (Simpler.Grants.gov itself).
- Verdict: adopt CommonGrants shapes for the internal `opportunities` table; Simpler API **v1** as a secondary source; Simpler Apply **later**.

**B1d. Applicant System-to-System (S2S)**
- Docs: https://www.grants.gov/system-to-system/applicant-system-to-system.
- Needs: a Grants.gov organization profile whose E-Biz POC has the Expanded AOR role; SOAP/XML development; a digital client certificate from an approved CA (Sectigo, DigiCert, GoDaddy, InCommon; about $30–$218/year, unconfirmed); the Certificate Request Form; sandbox at training.grants.gov; mutual TLS. Third-party submission needs a "Third Party Submitter" certificate role the Grants.gov PMO designates; the "As Third Party" operations are documented as "only used for NIH ASSIST". Vendors like Cayuse and Kuali provide a certificate per customer organization. Whether one vendor certificate can submit for many unrelated organizations without PMO approval is not stated.
- Workspace (the alternative): shared online environment; web or PDF forms; forms reused when name and version match; roles Manager, Owner, Participants, Standard AOR, Expanded AOR; created from "Apply Now" by Funding Opportunity Number or Package ID; no URL-prefill is documented.
- Verdict: **S2S not in v1.** Deep link and show `packageId`, `openingDate`, `closingDate`, `workspaceCompatibleFlag`.

**B1e. Notifications, RSS, email**
- Connect Center: Grants.gov News, All New Opportunities (one email per day), per-opportunity notifications, Saved Search notifications, four RSS feeds, System Alerts blog. **Gotcha:** all four RSS URLs returned `text/html` today, not XML. Treat RSS as unavailable.
- Verdict: build our own alerts on `search2` `dateRange` polling (**v1**); optional forward of the Grants.gov daily email into an inbound-parse address (**v2**).

### B2. SAM.gov
- Entity Management API: https://open.gsa.gov/api/entity-api/. Public data needs a personal "Public API Key" from a SAM.gov account or a System Account. Daily limits: non-federal user with no SAM role **10 requests/day**; with a role 1,000/day; system account 1,000/day; federal 10,000/day. Endpoint `https://api.sam.gov/entity-information/v4/entities?api_key=...`; params `ueiSAM`, `cageCode`, `legalBusinessName`, `registrationStatus` (`A`/`E`), `registrationExpirationDate`, `includeSections`. Response `entityRegistration` carries `ueiSAM`, `cageCode`, `legalBusinessName`, `registrationStatus`, `registrationExpirationDate`, `registrationDate`, `lastUpdateDate`, `purposeOfRegistrationDesc`; `coreData` has addresses, `businessTypes`; `assertions` has NAICS.
- Exclusions API: `https://api.sam.gov/entity-information/v4/exclusions`, same key types and limits.
- Assistance Listings API (former CFDA): `https://api.sam.gov/assistance-listings/v1/search?api_key=...`; filters `assistanceListingId`, `status`, `organizationCodes`, `applicantTypes`, `beneficiaryTypes`; response with `assistanceListingId`, `title`, `federalOrganization`, `overview.objective`, `financialInformation.obligations`, `criteriaForApplying.applicant.types`, contacts, `programWebPage`.
- Verdict: Entity API **v1** (UEI lookup, expiry warning; cache hard); Assistance Listings **v1**; Exclusions **v2**; Opportunities (contracts) **later**.

### B3. USAspending.gov
- No key, no documented rate limits (https://api.usaspending.gov/docs/endpoints). `POST /api/v2/autocomplete/recipient/` finds recipients (`recipient_name`, `uei`, `duns`). `POST /api/v2/search/spending_by_award/` with `filters.award_type_codes` (grants `02`,`03`,`04`,`05`), `filters.recipient_search_text`, `fields` such as `Award ID`, `Recipient Name`, `Recipient UEI`, `Awarding Agency`, `Award Amount`, `Total Outlays`, `Start Date`, `End Date`, `Description`, `CFDA Number`; data from 2007-10-01.
- Verdict: **v1** for award history.

### B4. SBIR/STTR
- **SBIR.gov API** (https://www.sbir.gov/api): awards and solicitations endpoints, but "currently undergoing maintenance" and returning HTTP 403 today. **Later.**
- **DOE SBIR/STTR**: moved from the Office of Science to the DOE Office of Technology Commercialization; "All Office of Science SBIR/STTR Funding Opportunities are closed" (https://science.osti.gov/sbir/Funding-Opportunities). Reauthorization (S. 3971, signed April 13, 2026) extends SBIR/STTR through FY2031. New process: a mandatory short **Pitch** in the DOE SBIR/STTR Application Hub (ConnectWerx/AMP), invitation, then a full application; fixed-price, milestone-based "Fast-Track" awards with a Go/No-Go into Phase II (https://sbir-sttr.connectwerx.org/portfolio-items/fy26-fall-opportunity/). Applications are submitted inside AMP (register at https://register.ati.org). The hub never mentions Grants.gov or PAMS; whether any Grants.gov step survives is unconfirmed.
- **FY26 Fall Opportunity** (funds in FY2027): pitch window opens **Friday Oct 30, 2026**; video topic summaries Nov 13; office hours Nov 19 and Dec 1 (3 pm ET); **pitch deadline Wednesday Dec 16, 2026, 2 pm ET**, no late submissions; about 160 awards, up to $50M total; maximum $300,000 (or $306,500 with TABA); topics in a separate Topics Document PDF; pitch = 4 narrative + 3 short-answer + 7 structured questions, optional bibliography PDF (5 MB max), up to 3 pitches per company; reviewers screen on topic alignment, technical promise, commercialization potential, team. The earlier Genesis Mission round used a 700-word pitch and required SAM.gov UEI (up to 8 weeks), SBA Company Registry, AMP account.
- Eligibility: ≤500 employees, for-profit, US place of business, ≥51% US-citizen/PR owned, DOE does not accept majority-VC-owned firms; SBIR PI primarily employed by the firm; STTR needs a US nonprofit research partner doing ≥30% with the firm ≥40% and a written IP agreement (https://sbir-sttr.connectwerx.org/eligibility-criteria/).
- Feeds: RSS `https://sbir-sttr.connectwerx.org/feed/` and iCal `https://sbir-sttr.connectwerx.org/events/?ical=1` (both live today).
- **NSF**: Project Pitch first (portal nsfgov.my.site.com/mywork; 1–2 months response); full proposals through Research.gov; solicitations NSF 26-510/26-511; deadlines July 27, 2026, Nov 4, 2026, Mar 4, 2027. **NIH**: SAM.gov, eRA Commons, Grants.gov, SBA Company Registry ("6 weeks or more"); submit via ASSIST, Grants.gov Workspace, or S2S; standard due dates Sept 5, Jan 5, Apr 5.
- Verdict: v1 as curated records plus the ConnectWerx RSS/iCal; model the pitch → invitation → full application → Go/No-Go stages; v2 per-agency submission-system field.

### B5. State, county and city grants
- **California** (the model case): CKAN dataset `california-grants-portal`, resource `111c8c88-21f6-453c-ae2c-b4785a0624f5`, updated daily (last 2026-10-30 08:01). Query `https://data.ca.gov/api/3/action/datastore_search?resource_id=111c8c88-...&limit=N`; fields `PortalID`, `GrantID`, `Status`, `LastUpdated`, `ChangeNotes`, `AgencyDept`, `Title`, `Type`, `LOI`, `Categories`, `Purpose`, `Description`. No key, free. **v1.**
- **New York**: Grants Gateway retired January 2024; grants moved to the Statewide Financial System; discovery is a PeopleSoft page; no feed. **Manual.**
- **Texas**: eGrants lists opportunities as HTML; no RSS/API. **Manual/scrape.**
- **Illinois**: GATA Catalog, HTML; weekly NOFO email by subscribing to a list. **Email-forward or scrape.**
- **Washington**: FundHubWA (climate/clean-energy); no API. **Manual.**
- **Pennsylvania**: pa.gov/grants finder, HTML with filters; Keystone Login to apply. **Manual/scrape.**
- **Massachusetts**: COMMBUYS bids. **Manual.** **Ohio**: portal behind OH|ID login (unconfirmed). **Minnesota**: bot protection blocks automated fetches. **Colorado, Florida, Michigan**: unconfirmed.
- **Municipal platforms**: Submittable Discover is a free public marketplace of grants browsable without an account; ZoomGrants programs are per-agency links; Neighborly lists are behind login; eCivis/Euna advertises an API but no public listing feed.
- Verdict: California feed + manual entry with "import from URL" + optional inbound email parsing. A general scraper is v2 at the earliest.

### B6. Foundation and corporate data
- **Candid APIs**: Essentials, Premier, Charity Check, Grants API, News, RFP, Demographics, Eligibility, Taxonomy. 30-day trial by form, then a paid Order Form; the licence requires "Powered by Candid" on every page, forbids republishing, scraping, building a competing database and any AI/ML data mining, allows audits. Third-party price estimates about $6,000/yr for the Grants API (unconfirmed). **Later / skip.**
- **ProPublica Nonprofit Explorer API v2**: `https://projects.propublica.org/nonprofits/api/v2/search.json?q=&state[id]=&ntee[id]=&c_code[id]=&page=` and `/organizations/{ein}.json`; returns `ein`, `name`, `city`, `state`, `ntee_code`, `subseccd`, `filings_with_data[]` with `tax_prd`, `totrevenue`, `totfuncexpns`, `totassetsend`, `pdf_url`; no key. **v1.**
- **IRS 990 bulk data** (the source of the GetFunded commons data): Form 990 series XML by year at https://www.irs.gov/charities-non-profits/form-990-series-downloads; TEOS bulk sets monthly (second Tuesday); AWS bucket stopped Dec 31, 2021. **Reuse.**
- **Corporate portals** (Benevity, CyberGrants, YourCause): funder-tenant portals with no public RFP listing. **Manual entry.**

### B7. Notifications and calendar
- iCal: RFC 5545 `VCALENDAR`/`VEVENT` feeds. Google Calendar API: 10,000 requests/min per project, free; public apps need OAuth verification. iCal **v1**, Google API **v2**.
- Email: Supabase's default SMTP sends 2 messages/hour to team members only; custom SMTP is required for production. Resend Free: 3,000 emails/month, 100/day, 3 domains; Pro $20/month for 50,000. Postmark Developer: 100/month; Basic $15/month for 10,000. Resend **v1**.

### B8. Recommended v1 integration set

| System | What we use | Auth needed | Human step |
|---|---|---|---|
| Grants.gov search2 + fetchOpportunity | live search, detail, attachments, package IDs, deep link | none | none |
| Grants.gov XML extract | nightly bulk load from S3 | none | none |
| Simpler.Grants.gov API | clean enums, UUIDs, extracts, legacy-ID bridge | free API key | Zach signs in with Login.gov and creates a key |
| CommonGrants | internal opportunity schema | n/a | none |
| SAM.gov Entity + Assistance Listings | UEI lookup, expiry warning, ALN enrichment | SAM.gov personal key | Zach creates a SAM.gov account; an entity role or System Account for 1,000/day |
| USAspending | award history by UEI/name | none | none |
| California Grants Portal (CKAN) | daily state feed | none | none |
| DOE SBIR hub RSS/iCal | SBIR deadlines | none | none |
| ProPublica Nonprofit Explorer | funder/EIN lookup | none | none |
| open funder database via mcp.getfunded.ai | funder table (IRS 990) | none | none |
| Manual entry + import-from-URL | all other state/county/city/corporate | n/a | users |
| iCal feed + Resend | deadline reminders | Resend API key | Zach signs up, verifies domain, sets Supabase custom SMTP |

Deferred: Grants.gov S2S, Simpler Apply (alpha), SBIR.gov API (403 today), Candid, Google Calendar API (v2), inbound email parsing (v2), state scrapers (v2).

---

