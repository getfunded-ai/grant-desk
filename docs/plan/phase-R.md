# Phase R: Time and billing hooks

Milestone 4: Consultant version (target 2027-02-19) · Tier: **medium** · Runs with: Q, S · Depends on: P

## Goal

Time per grant and client, retainers, and an invoice-ready export. Never a percentage of an award.

## Owns (work only here)

- `lib/time/**`
- `app/(app)/time/**`
- `components/time/**`

## Build

1. Time entries per grant and client with a timer and manual entry.
2. Retainer tracking (hours included, used, remaining).
3. Invoice-ready CSV: hourly, flat fee, retainer; no percentage field anywhere (GPA and AFP ethics).

## Done when

- Log time on two clients; export a CSV grouped by client.

## Human steps

- None.

## Merge rule

This pull request merges itself once `pr-checks`, `risk-tier` and `review-gate` are green. Medium tier: run the self-review at high effort. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase R: Time and billing hooks.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-R.md first. Work only in the
folders the brief owns. Create the branch phase/r-time-and-billing-hooks from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: medium. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
