# Phase Z: Launch review

Milestone 5: Growth engine and operations (target 2027-03-26) · Tier: **high** · Runs with: — · Depends on: all

## Goal

Measure the scorecard, write the retro, and set roadmap v3.

## Owns (work only here)

- `app/(app)/admin/scorecard/**`
- `docs/launch/REVIEW.md`
- `ROADMAP.md (v3 section)`

## Build

1. Owner-only scorecard page for S1–S6 from analytics, GitHub and billing.
2. Retro: what worked, what did not, what the users said.
3. Roadmap v3: Simpler Apply when it leaves alpha, Google Calendar two-way sync, a CommonGrants server, mobile.

## Done when

- Zach reads the scorecard and the retro and decides what is next.

## Human steps

- H-13: the scorecard gates.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase Z: Launch review.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-Z.md first. Work only in the
folders the brief owns. Create the branch phase/z-launch-review from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
