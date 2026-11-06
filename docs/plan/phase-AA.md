# Phase AA: Learning loops

Milestone 2 (added 2026-11-05; target with Milestone 2, 2026-12-11) · Tier: **high** · Runs with: D, E, G · Depends on: B, C

## Goal

One organization gets smarter each time it works on funding. A learning session collects what the
organization knows (with sources), what it tried, what happened, and what it learned. The next session
starts from the last one's lessons. It works for three kinds of organization: a nonprofit that seeks
grants, a funder that gives them, and a company that seeks non-dilutive funding. The app never sends a
message. People send; the app drafts, tracks and learns.

The contract with the AI side is `docs/learning-session-format.md`: the app exports a packet, an
assistant writes a results file, the app turns every item into a proposal a person accepts or rejects.

## Owns (work only here)

- `app/(app)/learning/**`
- `app/(app)/knowledge/**`
- `app/(app)/contacts/**`
- `lib/learning/**`
- `components/learning/**`
- `content/playbooks/**`
- `docs/learning-session-format.md`
- `supabase/migrations/*_learning_*.sql` (new files only)
- `tests/db/learning*.test.ts` and `tests/rls/learning*.test.ts` (allowed by the testing policy: migrations and row-level security)

## Build

1. One migration. `organizations.kind` (`seeker`, `funder`, `company`; default `seeker`). New tables, each
   with `organization_id` and row-level security through the Phase B helpers (`private.is_member`,
   `private.can_edit`, `private.is_admin`), and child rows referencing parents through
   `(organization_id, id)`:
   - `knowledge_facts`: subject kind and id, fact, source kind (`filing`, `website`, `document`,
     `person`, `ai`), source reference, confidence (`stated`, `likely`, `guess`), status (`proposed`,
     `confirmed`, `superseded`), confirmed by and at, superseded by. Append-only: supersede, never delete.
   - `contacts`: optional funder, name, role, email, phone, publishability (`private`, `public`), notes.
   - `touches`: contact, optional grant, optional session, kind (`email`, `call`, `meeting`, `letter`,
     `note`), direction (`out`, `in`), happened at, summary, logged by.
   - `learning_sessions`: number (unique per organization, increasing), playbook key, goal, status
     (`open`, `closed`), opened by and at, closed at, the frozen packet (jsonb), lessons summary.
   - `session_lessons`: session, lesson, evidence, applies to (`prospecting`, `outreach`, `application`,
     `post_award`, `general`).
   - `session_proposals`: session to `proposals` link.
     Column grants follow Phase B: callers never choose `id` or `created_at` on append-only tables.
2. Playbooks in `content/playbooks/<key>.md` with front matter (`key`, `title`, `for`, `steps`): the six keys
   in the format document. Each says what to read, what to produce, and what counts as a lesson. Generic
   text only. No real organization, client or customer names.
3. `/learning`: sessions per organization; "Start a session" picks a playbook and a goal, creates the
   session with the next number, and freezes the packet (section 1 of the format document) from the
   organization profile, confirmed facts, open grants, deadlines, recent contacts and all earlier lessons.
4. `/learning/[id]`: shows the packet; "Copy packet" and "Download packet"; "Import results" (paste or
   upload) validates against section 2 of the format document, rejects what the rules reject, and turns
   every item into a `proposals` row linked through `session_proposals`, labelled with model and date;
   accept and reject per item (accept writes the fact, contact, touch or task; a `stage_move` proposal
   stays pending with a note that it is accepted on the grant record page, which Phase E builds);
   "Close session" asks for at least one lesson and writes `session_lessons`.
5. `/knowledge`: confirmed facts with sources, filter by subject, supersede with a new fact. Empty views
   read "Not stated in filings" or "Not available", never "none" or "0".
6. `/contacts`: contacts and touches; log a touch by hand. No sending of any kind.
7. Outcome loop: when `grant_stage_history` shows `awarded` or `declined` for a grant that a session
   proposed something on, the session page shows the outcome; a "What worked" panel on `/learning` lists
   lessons from sessions whose grants were awarded.
8. Honesty: every imported item shows "AI, <model>, <date>" and its evidence; the app never writes
   "interested" or "eligible" about anyone.

## Done when

- Start session 1 with `seeker-prospecting`; download the packet; import a results file with three items;
  accept two and reject one; close with one lesson.
- Start session 2; its packet contains session 1's lesson.
- Row-level-security tests: a member of organization A cannot read B's sessions, facts, contacts or touches.

## Human steps

- H-AA-1 (after merge): apply the migration to the hosted project, the same step as Phase B.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase AA: Learning loops.
Read AGENTS.md, REVIEW.md, ROADMAP.md, docs/plan/phase-AA.md and docs/learning-session-format.md first.
Work only in the folders the brief owns. Create the branch phase/aa-learning-loops from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order.
Verify once with the cheapest direct check and write the "Verified by" line. Then run /code-review in a
fresh context with AGENTS.md and REVIEW.md, fix every Important finding, and write the "Independent
review evidence" block. Open a pull request whose body starts with the "CEO summary" block. Tier: high.
Report status to the maintainer after each task and ask your questions there. Update docs/PROGRESS.md
after every task. Stop and ask before anything that touches production, money, secrets, DNS, sending
messages or deleting data.
```
