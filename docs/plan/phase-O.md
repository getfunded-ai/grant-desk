# Phase O: State and local sources

Milestone 3: Full single-organization version (target 2027-01-22) · Tier: **medium** · Runs with: N · Depends on: D

## Goal

State, county and city grants without a scraper: one real feed, a URL helper, and email parsing.

## Owns (work only here)

- `lib/sources/**`
- `app/api/cron/sources/**`
- `app/(app)/sources/**`
- `app/api/inbound-email/**`

## Build

1. California Grants Portal CKAN feed, daily, into opportunities with source and custom fields.
2. "Import from URL" helper: paste a page link; extract title, deadline, funder; confirm; save.
3. Inbound email address per organization to turn a Grants.gov daily email or a state digest into opportunities (parse, never auto-track).
4. Links to Submittable Discover and state portals.

## Done when

- California opportunities appear after a run.
- Paste a URL; an opportunity is created after confirmation.

## Human steps

- None.

## Merge rule

This pull request merges itself once `pr-checks`, `risk-tier` and `review-gate` are green. Medium tier: run the self-review at high effort. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase O: State and local sources.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-O.md first. Work only in the
folders the brief owns. Create the branch phase/o-state-and-local-sources from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: medium. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
