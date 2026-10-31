# Phase H: Funder profiles

Milestone 2: Light version, public (target 2026-12-11) · Tier: **medium** · Runs with: F, G · Depends on: B

## Goal

Foundation facts from the open funder database, with sources, and manual funders for corporate programs.

## Owns (work only here)

- `lib/commons/**`
- `lib/propublica/**`
- `app/(app)/funders/**`
- `components/funders/**`

## Build

1. Server-side client for the commons connector at mcp.getfunded.ai (MCP over HTTP, no key); ProPublica Nonprofit Explorer as fallback.
2. Funder page: 990 and 990-PF facts, giving history, source on every fact, "Not stated in filings" when silent.
3. Saved searches; manual funder entry for corporate giving programs.

## Done when

- Search a foundation by name or EIN; open its page; every number shows its source.

## Human steps

- None.

## Merge rule

This pull request merges itself once `pr-checks`, `risk-tier` and `review-gate` are green. Medium tier: run the self-review at high effort. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase H: Funder profiles.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-H.md first. Work only in the
folders the brief owns. Create the branch phase/h-funder-profiles from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: medium. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
