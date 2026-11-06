/**
 * Compliance checklist templates. One is copied onto an award when it is entered; a person then
 * ticks items off and adds their own. The federal list follows 2 CFR 200 and names the section for
 * each item. The non-federal list is the plain good practice a foundation or corporate grant asks
 * for. Neither list is legal advice and the page says so.
 *
 * Pure module.
 */

export interface ChecklistTemplateItem {
  /** Stable key, unique within a template; stored on compliance_items.template_key. */
  key: string;
  title: string;
  detail: string;
}

export const FEDERAL_CHECKLIST: readonly ChecklistTemplateItem[] = [
  {
    key: "sam_registration",
    title: "SAM.gov registration and UEI stay active for the whole award",
    detail: "2 CFR 25.200 and 200.206. Renew the SAM.gov registration every year.",
  },
  {
    key: "award_terms_read",
    title: "Read the notice of award and file it",
    detail:
      "2 CFR 200.211. The notice lists the federal award identification number, the period of performance, the budget and any special conditions.",
  },
  {
    key: "financial_system",
    title: "Books track this award separately: budget, obligations, spending and income",
    detail: "2 CFR 200.302. Every charge to the award needs the source document behind it.",
  },
  {
    key: "written_procedures",
    title: "Written procedures for payments and for deciding which costs are allowable",
    detail: "2 CFR 200.302(b)(6) and (7), 200.305.",
  },
  {
    key: "internal_controls",
    title: "Internal controls in place and protected information kept safe",
    detail: "2 CFR 200.303.",
  },
  {
    key: "conflict_of_interest",
    title: "Conflict of interest policy written and disclosures made to the agency",
    detail: "2 CFR 200.112 and 200.318(c).",
  },
  {
    key: "procurement_policy",
    title: "Written procurement policy that follows the federal standards",
    detail: "2 CFR 200.317 to 200.327. Keep records of how each purchase was awarded.",
  },
  {
    key: "indirect_rate",
    title: "Indirect cost method chosen: negotiated rate or the 15 percent de minimis rate",
    detail:
      "2 CFR 200.414. The de minimis rate needs no agreement, but the choice must be used consistently.",
  },
  {
    key: "time_and_effort",
    title: "Staff time charged to the award is supported by records",
    detail: "2 CFR 200.430(g).",
  },
  {
    key: "equipment_records",
    title: "Equipment bought with award money is listed and inventoried every two years",
    detail: "2 CFR 200.313(d).",
  },
  {
    key: "subrecipient_monitoring",
    title: "Subrecipients, if any, are assessed and monitored",
    detail: "2 CFR 200.331 and 200.332. Skip if there are no subawards.",
  },
  {
    key: "reports_on_time",
    title: "Financial (SF-425) and performance reports sent on the schedule below",
    detail: "2 CFR 200.328 and 200.329.",
  },
  {
    key: "prior_approval",
    title: "Prior approval requested before changes in scope, key people or budget",
    detail: "2 CFR 200.308.",
  },
  {
    key: "single_audit",
    title: "Single audit arranged if federal spending reaches US$1,000,000 in a fiscal year",
    detail: "2 CFR 200.501. The flag on this page shows where the organization stands.",
  },
  {
    key: "closeout",
    title: "Final reports sent and all bills paid within 120 days of the end date",
    detail: "2 CFR 200.344.",
  },
  {
    key: "records_retention",
    title: "Records kept three years after the final financial report",
    detail: "2 CFR 200.334. The retention end date is set at close-out.",
  },
];

export const NON_FEDERAL_CHECKLIST: readonly ChecklistTemplateItem[] = [
  {
    key: "agreement_signed",
    title: "Signed grant agreement filed",
    detail: "Keep the agreement and any letters that change it with the award.",
  },
  {
    key: "acknowledgement_sent",
    title: "Thank-you and acknowledgement sent to the funder",
    detail: "Within a week of the award if you can.",
  },
  {
    key: "restrictions_recorded",
    title: "Restrictions and allowed uses recorded in the books",
    detail: "Code the award so spending can be reported by the funder's categories.",
  },
  {
    key: "reporting_schedule_confirmed",
    title: "Reporting schedule confirmed with the funder",
    detail: "Check the dates below against the agreement.",
  },
  {
    key: "recognition",
    title: "Funder recognition done the way the agreement asks",
    detail: "Logos, mentions, site visits, press.",
  },
  {
    key: "changes_approved",
    title: "Changes to the plan or budget approved in writing",
    detail: "Ask before moving money between categories if the agreement requires it.",
  },
  {
    key: "final_report",
    title: "Final report and financial statement sent",
    detail: "Mark the final report submitted below when it goes out.",
  },
  {
    key: "closeout_letter",
    title: "Close-out confirmed with the funder",
    detail: "A short letter or email that the grant is complete.",
  },
];

export function checklistTemplate(isFederal: boolean): readonly ChecklistTemplateItem[] {
  return isFederal ? FEDERAL_CHECKLIST : NON_FEDERAL_CHECKLIST;
}
