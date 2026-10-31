# Phase K: AI help

Milestone 3: Full single-organization version (target 2027-01-22) · Tier: **medium** · Runs with: L, M · Depends on: F

## Goal

Labelled, cited, propose-only AI help: summarize a notice, draft from boilerplate, score fit.

## Owns (work only here)

- `lib/ai/**`
- `app/api/ai/**`
- `components/ai/**`
- `app/(app)/settings/ai/**`

## Build

1. Anthropic API with claude-sonnet-5-5 default and claude-haiku-5-5 for cheap tasks; bring-your-own-key setting per organization.
2. Summarize a funding notice (PDF or page) with citations to the source text.
3. Draft a section from boilerplate; fit score against eligibility text.
4. Every output is labelled with model and date, cites its evidence, never claims interest or eligibility, and every write is a row in proposals.

## Done when

- Summarize a real notice; the summary shows its label and sources.
- A draft lands as a proposal that a person accepts.

## Human steps

- Question 9: the key.

## Merge rule

This pull request merges itself once `pr-checks`, `risk-tier` and `review-gate` are green. Medium tier: run the self-review at high effort. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase K: AI help.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-K.md first. Work only in the
folders the brief owns. Create the branch phase/k-ai-help from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: medium. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
