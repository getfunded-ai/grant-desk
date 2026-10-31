# Phase X: Webinar tier

Milestone 5: Growth engine and operations (target 2027-03-26) · Tier: **medium** · Runs with: Y · Depends on: I

## Goal

The US$1 benefit: a members area with the live link, invites and recordings.

## Owns (work only here)

- `app/(app)/webinars/**`
- `lib/webinars/**`
- `components/webinars/**`

## Build

1. Members area gated by entitlement; next webinar with calendar invite; recording library; the Zoom or Meet link from settings.

## Done when

- A paid test user sees the link; a free user sees the pitch.

## Human steps

- H-10: the recurring webinar link.

## Merge rule

This pull request merges itself once `pr-checks`, `risk-tier` and `review-gate` are green. Medium tier: run the self-review at high effort. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase X: Webinar tier.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-X.md first. Work only in the
folders the brief owns. Create the branch phase/x-webinar-tier from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: medium. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
