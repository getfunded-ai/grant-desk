# Phase Q: Client requests and reporting

Milestone 4: Consultant version (target 2027-02-19) · Tier: **medium** · Runs with: R, S · Depends on: P

## Goal

Ask clients for what you need with due dates, and show them where things stand.

## Owns (work only here)

- `app/(app)/requests/**`
- `app/(client)/**`
- `lib/requests/**`
- `lib/reports/**`
- `components/requests/**`

## Build

1. Input requests: ask a client for a document or an answer, with a due date and automatic nudges; the client answers from an emailed link.
2. Monthly status report per organization as a link and a PDF.
3. Read-only client login (viewer role) and an "approve before we submit" step on a grant.

## Done when

- Send a request; answer it from the link; the file lands on the grant.
- Open the status report link as the client.

## Human steps

- None.

## Merge rule

This pull request merges itself once `pr-checks`, `risk-tier` and `review-gate` are green. Medium tier: run the self-review at high effort. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase Q: Client requests and reporting.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-Q.md first. Work only in the
folders the brief owns. Create the branch phase/q-client-requests-and-reporting from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: medium. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
