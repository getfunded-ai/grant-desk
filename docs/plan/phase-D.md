# Phase D: Grants.gov sync and browse

Milestone 1: Foundation (target 2026-11-13) · Tier: **high** · Runs with: E · Depends on: B, C

## Goal

Every Grants.gov opportunity, posted and forecast, in our database every night, browsable with filters, trackable with one click.

## Owns (work only here)

- `lib/grants-gov/**`
- `app/api/cron/grants-gov/**`
- `app/(app)/opportunities/**`
- `components/opportunities/**`
- `supabase/migrations/*_opportunities_*.sql (new files only)`

## Build

1. Nightly Vercel Cron: download `GrantsDBExtractYYYYMMDDv2.zip` from the S3 URL, parse the XML, upsert into opportunities in CommonGrants shape; keep legacy numeric id and opportunity number.
2. Intraday: `search2` with `dateRange` for changes; `fetchOpportunity` for details, attachments, package ids, workspace-compatible flag; store agency and Assistance Listing tables.
3. Detect status and close-date changes; write activity_log rows for tracked grants.
4. Browse page: filters for eligibility (codes 12 and 13 for nonprofits), agency, category, status, close date, award ceiling; search by keyword.
5. Detail page: deep link to `https://www.grants.gov/search-results-detail/{id}`, package ids and dates, attachments list.
6. "Track this" creates a grant in stage prospect.
7. Honesty: null funding reads "Not stated".

## Done when

- A nightly run loads the extract into a local database and reports counts.
- The browse page shows posted and forecast opportunities with filters working once in the preview.
- Tracking an opportunity creates a grant.

## Human steps

- H-5: Simpler.Grants.gov API key (optional in this phase).

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase D: Grants.gov sync and browse.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-D.md first. Work only in the
folders the brief owns. Create the branch phase/d-grants-gov-sync-and-browse from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
