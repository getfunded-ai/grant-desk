# Phase W: Self-host kit

Milestone 5: Growth engine and operations (target 2027-03-26) · Tier: **medium** · Runs with: U, V · Depends on: C

## Goal

Anyone can run Grant Desk themselves in under an hour.

## Owns (work only here)

- `docs/self-host/**`
- `docker-compose.yml`
- `Dockerfile`
- `scripts/setup/**`
- `README (deploy section)`

## Build

1. "Deploy to Vercel" button; Supabase setup script that applies migrations and seeds; Docker Compose option; plain-words docs.
2. Clone and star tracking on the open-source page (S2).

## Done when

- A fresh machine follows the docs and reaches the sign-in page.

## Human steps

- None.

## Merge rule

This pull request merges itself once `pr-checks`, `risk-tier` and `review-gate` are green. Medium tier: run the self-review at high effort. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase W: Self-host kit.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-W.md first. Work only in the
folders the brief owns. Create the branch phase/w-self-host-kit from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: medium. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
