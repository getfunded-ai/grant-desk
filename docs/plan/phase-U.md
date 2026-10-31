# Phase U: Programmatic SEO at scale

Milestone 5: Growth engine and operations (target 2027-03-26) · Tier: **high** · Runs with: V, W · Depends on: J

## Goal

Thousands of useful public pages built from live data, refreshed nightly, plus a weekly digest nobody has to write.

## Owns (work only here)

- `app/grants/** (extend)`
- `app/funders/** (public)`
- `lib/seo/**`
- `content/digests/**`
- `app/api/cron/digest/**`

## Build

1. State × cause "deadlines this month" pages; agency, category and funder pages; "closing this week".
2. Sitemap index; canonical tags; no tenant data on any public page.
3. Weekly digest written from live data by a cron and published to the blog and RSS.

## Done when

- Pages render for every state and category; the sitemap lists them; the digest publishes once.

## Human steps

- None.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase U: Programmatic SEO at scale.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-U.md first. Work only in the
folders the brief owns. Create the branch phase/u-programmatic-seo-at-scale from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
