# Phase C: Login, shell, deploy

Milestone 1: Foundation (target 2026-11-13) · Tier: **high** · Runs with: B · Depends on: A

## Goal

A person can sign in, create an organization, invite a teammate, and switch organizations, on a live Vercel URL.

## Owns (work only here)

- `app/(auth)/**`
- `app/(app)/layout.tsx and app/(app)/onboarding/**, app/(app)/settings/**`
- `components/shell/**`
- `lib/auth/**`
- `lib/supabase/** (browser and server clients)`
- `proxy.ts (route protection)`
- `vercel.json`
- `docs/DEPLOY.md`

## Build

1. Supabase Auth with email magic link; Google later.
2. Onboarding: create organization; invite one teammate by email.
3. Organization switcher in the shell; navigation; settings; profile.
4. Vercel project linked to the repo; preview deploy per PR; env var names documented in .env.example and docs/DEPLOY.md.
5. Error tracking hook (Sentry or Vercel's) behind an env flag.

## Done when

- Sign in by magic link on the Vercel preview works once (say what you saw).
- A second organization appears in the switcher.
- Build passes with no env vars set (public pages) and with them set (app).

## Human steps

- H-2: import the repo in Vercel.
- H-4: Resend account and Supabase custom SMTP.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase C: Login, shell, deploy.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-C.md first. Work only in the
folders the brief owns. Create the branch phase/c-login-shell-deploy from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
