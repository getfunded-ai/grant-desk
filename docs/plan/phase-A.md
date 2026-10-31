# Phase A: Repo and guardrails

Milestone 1: Foundation (target 2026-11-13) · Tier: **high** · Runs with: — · Depends on: none

## Goal

Give every later phase a repo with rules, briefs, checks and a merge gate, so agents can work in parallel without Zach watching.

## Owns (work only here)

- everything (bootstrap phase; later phases own their own folders)

## Build

1. Next.js 16 App Router, TypeScript strict, Tailwind 4, shadcn/ui base, ESLint, Prettier.
2. AGENTS.md, CLAUDE.md, REVIEW.md, README.md, LICENSE (MIT).
3. ROADMAP.md with Phases A–Z; docs/plan/phase-*.md briefs; docs/PROGRESS.md; docs/research/.
4. .github/risk-tiers.yml; workflows pr-checks, risk-tier, review-gate, weekly-tests; tools/risk_tier.py and tools/review_gate.py.
5. CODEOWNERS; pull request template with the CEO summary and evidence blocks; issue template for a phase.
6. ADR-0001.

## Done when

- `pnpm typecheck`, `pnpm lint` and `pnpm build` pass.
- Every file above exists and reads plainly.
- The repo exists on GitHub under the owner Zach chose (H-1), rulesets require pr-checks, risk-tier and review-gate, auto-merge is on.
- One GitHub issue per phase B–Z, each linking its brief.

## Human steps

- H-1: approve the repo owner; turn on auto-merge; approve the ruleset; set up status reporting.
- H-2: import the repo in Vercel.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase A: Repo and guardrails.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-A.md first. Work only in the
folders the brief owns. Create the branch phase/a-repo-and-guardrails from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
