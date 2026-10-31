# Phase J: Public site, SEO, analytics

Milestone 2: Light version, public (target 2026-12-11) · Tier: **high** · Runs with: I · Depends on: D

## Goal

A public website strangers can find, with the first programmatic pages and the events that prove the scorecard.

## Owns (work only here)

- `app/(marketing)/**`
- `content/**`
- `app/sitemap.ts`
- `app/robots.ts`
- `app/opengraph-image.tsx`
- `lib/analytics/**`
- `lib/seo/**`
- `app/grants/** (public programmatic pages)`
- `components/marketing/**`

## Build

1. Landing, pricing, docs, open-source page with clone steps, blog (MDX).
2. Sitemap, robots, Open Graph images, Search Console file.
3. Analytics events: free_link_click, repo_link_click, sign_up, payment (S1–S4), with referrer.
4. Programmatic pages from the opportunities table only (public data): /grants/agency/[code], /grants/deadlines/[year-month], /grants/category/[code], /grants/for/nonprofits.
5. A "moving from GrantHub or Instrumentl" page.

## Done when

- Lighthouse SEO score above 90 on the landing page once.
- The programmatic pages render from live data in the preview.
- Events show up in the analytics tool.

## Human steps

- H-7: domain and Search Console.
- H-8: accept ADR-0008; make the repo public.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase J: Public site, SEO, analytics.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-J.md first. Work only in the
folders the brief owns. Create the branch phase/j-public-site-seo-analytics from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
