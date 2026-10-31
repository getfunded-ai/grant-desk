# Phase T: Consultant onboarding

Milestone 4: Consultant version (target 2027-02-19) · Tier: **high** · Runs with: — · Depends on: Q, R, S

## Goal

A consultant finds the consultant path, signs up, and brings clients over.

## Owns (work only here)

- `app/(marketing)/consultants/**`
- `content/guides/**`
- `app/(app)/onboarding/consultant/**`

## Build

1. Consultant sign-up path and pricing copy.
2. Migration guides from Instrumentl's consultant plan, GrantHub Pro and Grantable.
3. Design-partner feedback form that lands in the command center as a dispatch.

## Done when

- A working grant consultant follows the guide and has two clients in the app (gate M4).

## Human steps

- H-13: invite a design-partner consultant.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase T: Consultant onboarding.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-T.md first. Work only in the
folders the brief owns. Create the branch phase/t-consultant-onboarding from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
