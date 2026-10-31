# Phase G: Post-award and compliance

Milestone 2: Light version, public (target 2026-12-11) · Tier: **high** · Runs with: F, H · Depends on: E

## Goal

After the award: terms, reports due, budget versus actual, reimbursements, a federal compliance checklist, close-out.

## Owns (work only here)

- `app/(app)/grants/[id]/award/**`
- `lib/compliance/**`
- `lib/budget/**`
- `components/award/**`
- `supabase/migrations/*_awards_*.sql`

## Build

1. Award terms: amount, period of performance, payment method, indirect method.
2. Report schedule generator from 2 CFR 200: SF-425 and performance reports at 30 days (quarterly or semiannual), 90 days (annual), 120 days (final); record-retention end date three years after the final report; single-audit flag at US$1,000,000 federal spend; de minimis 15% calculator.
3. Budget versus actual table with CSV import of actuals.
4. Reimbursement tracker: invoices sent, paid, days outstanding.
5. Compliance checklist template per award; close-out step.

## Done when

- Enter an award; the report dates appear on the calendar.
- The single-audit flag turns on at US$1,000,000.

## Human steps

- None.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase G: Post-award and compliance.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-G.md first. Work only in the
folders the brief owns. Create the branch phase/g-post-award-and-compliance from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
