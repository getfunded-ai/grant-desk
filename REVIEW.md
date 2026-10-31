# Review instructions

This repo's contract is `AGENTS.md`. A change that breaks one of its rules is a bug, not a style issue.
Review in a fresh context. Report each finding as Important, Nit or Pre-existing.

## What Important means here

Each line names the `AGENTS.md` rule it comes from.

- A new tenant table without `organization_id` or without a row-level-security policy ("Every tenant
  table has `organization_id` and a row-level-security policy").
- A service key, API key or any credential in code, config, fixtures, docs or a commit ("Never print a
  secret"; "`.env.local` is never read aloud or committed").
- The browser importing a server-only module or using a service key ("The browser never uses a service key").
- Any write to the funder database behind the commons connector, or a tenant table placed there ("It never
  writes to the hosted funder database").
- AI or agent code that updates `grants`, `grant_stage_history` or any tenant record directly instead of
  inserting into `proposals` ("AI and agents never move a pipeline stage").
- AI output shown without its label, model, date and sources, or wording that says a funder is interested
  or an organization is eligible ("AI output is labelled… and never claims").
- A missing fact rendered as `$0`, `0`, "closed" or "none" ("Unknown is not closed or zero").
- Any computation of consultant pay as a percentage of an award ("Percentages of an award are never computed").
- Candid API or FEC data in any form ("Candid data is not used. FEC data is not used").
- An opportunity table or type that drops the CommonGrants fields (status, money, key dates) in favour of
  a vendor-specific shape ("Opportunities use the CommonGrants shape").
- A new workflow, scheduled job or script that calls a paid AI service, or a review requested from a paid
  bot ("Never add a workflow that calls a paid AI").
- A change to `.github/**`, `AGENTS.md`, `REVIEW.md`, `CODEOWNERS` or `tools/**` inside a pull request whose
  phase brief does not own them ("Work only in the folders your phase brief owns").
- A migration, sign-in, billing, RLS or deletion change without the test the testing policy requires
  ("Exceptions, where tests ARE written").
- Work in folders another phase owns ("Work only in the folders your phase brief owns"). The shared files
  AGENTS.md lists are allowed, within the limits it sets.
- Demo or placeholder data wired to a production path ("No demo data in production").
- A public page (marketing, programmatic SEO) that queries a tenant table ("Every tenant table has…"; the
  public site reads only public data).

## Nit at most

Naming, style, refactors, comment wording, copy. Report at most 3 nits per review.

## Pre-existing

A bug the pull request did not introduce is Pre-existing, never Important. Say so in one line so it can
get its own issue.

## Do not report

- Anything `pnpm typecheck`, `pnpm lint` or `pnpm build` already catches.
- Generated files (`next-env.d.ts`, `pnpm-lock.yaml`, `types/supabase.ts`).
- Missing tests outside the testing policy's exceptions.
