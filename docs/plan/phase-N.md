# Phase N: Government registrations

Milestone 3: Full single-organization version (target 2027-01-22) · Tier: **medium** · Runs with: O · Depends on: C

## Goal

UEI lookup, SAM.gov expiry warnings, federal award history, SBIR feeds, and a per-agency submission-system field.

## Owns (work only here)

- `lib/sam-gov/**`
- `lib/usaspending/**`
- `lib/sbir/**`
- `app/(app)/settings/organization/**`
- `app/api/cron/registrations/**`

## Build

1. SAM.gov Entity API: look up by legal name or UEI; store registration status and expiry; warn 60 and 30 days before expiry; cache hard because a plain key allows 10 calls a day; let users type their UEI.
2. Assistance Listings API to enrich ALN codes on opportunities.
3. USAspending: award history by UEI or name.
4. SBIR.gov feed when its API returns (403 on 2026-10-30); until then the DOE hub RSS and iCal.
5. Submission-system field on an opportunity: Grants.gov Workspace, NIH ASSIST, NSF Research.gov, DOE AMP.

## Done when

- Enter a real organization's UEI; status and expiry appear; award history lists.

## Human steps

- H-5: SAM.gov key.

## Merge rule

This pull request merges itself once `pr-checks`, `risk-tier` and `review-gate` are green. Medium tier: run the self-review at high effort. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase N: Government registrations.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-N.md first. Work only in the
folders the brief owns. Create the branch phase/n-government-registrations from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: medium. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
