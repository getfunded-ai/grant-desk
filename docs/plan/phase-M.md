# Phase M: Import and export

Milestone 3: Full single-organization version (target 2027-01-22) · Tier: **medium** · Runs with: K, L · Depends on: E

## Goal

No lock-in: import from spreadsheets and from GrantHub or Instrumentl exports; export everything.

## Owns (work only here)

- `lib/import/**`
- `lib/export/**`
- `app/(app)/import/**`
- `app/api/export/**`
- `components/import/**`

## Build

1. CSV import wizard with column mapping and a preview; presets for GrantHub, Instrumentl and a plain spreadsheet.
2. CSV and Excel export of grants, tasks, funders; full JSON export of the organization.

## Done when

- Import a 20-row CSV; the grants appear; export them back and the rows match.

## Human steps

- None.

## Merge rule

This pull request merges itself once `pr-checks`, `risk-tier` and `review-gate` are green. Medium tier: run the self-review at high effort. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase M: Import and export.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-M.md first. Work only in the
folders the brief owns. Create the branch phase/m-import-and-export from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: medium. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
