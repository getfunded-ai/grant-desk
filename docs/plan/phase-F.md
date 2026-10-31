# Phase F: Documents and boilerplate

Milestone 2: Light version, public (target 2026-12-11) · Tier: **medium** · Runs with: G, H · Depends on: E

## Goal

Files per grant with versions, and a reusable answer library.

## Owns (work only here)

- `app/(app)/documents/**`
- `app/(app)/boilerplate/**`
- `lib/storage/**`
- `lib/boilerplate/**`
- `components/documents/**`

## Build

1. Upload to Supabase Storage in a per-organization bucket path; versions; attach to grants; size and type limits.
2. Boilerplate library: title, body, tags, last used; copy button; search.
3. Honesty: boilerplate is the organization's text, never AI text unless labelled.

## Done when

- Upload a file, replace it, see both versions.
- Copy a boilerplate answer into a grant note.

## Human steps

- None.

## Merge rule

This pull request merges itself once `pr-checks`, `risk-tier` and `review-gate` are green. Medium tier: run the self-review at high effort. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase F: Documents and boilerplate.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-F.md first. Work only in the
folders the brief owns. Create the branch phase/f-documents-and-boilerplate from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: medium. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
