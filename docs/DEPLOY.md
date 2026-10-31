# Deploy and sign-in setup

How Grant Desk runs on Vercel and Supabase, which settings it needs, and who sets each one.
Phase C wrote this file. Later phases add their own rows to the tables below.

## Where things run

| Piece           | Where                                                                          | Notes                                              |
| --------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| Web app         | Vercel, project `grant-desk`, functions in `iad1`                              | One preview per pull request; `main` is production |
| Database, login | Supabase project `grant-desk`, region us-east-1                                | Never the funder database                          |
| Sign-in email   | Supabase's built-in mailer until H-4; then Resend through Supabase custom SMTP | Built-in mailer: team addresses only, few per hour |

## Environment variables

Set in Vercel → Project `grant-desk` → Settings → Environment Variables, for Preview and Production.
Locally they go in `.env.local` (never committed). Names are also in `.env.example`.

| Name                                   | Secret? | Who sets it | What it does                                                         |
| -------------------------------------- | ------- | ----------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | no      | agent (set) | Supabase address, used by the browser and the server                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no      | agent (set) | Supabase publishable key; row-level security limits what it can read |
| `SUPABASE_SECRET_KEY`                  | **yes** | **Zach**    | Server only. Creates organizations and sends teammate invites        |
| `ERROR_TRACKING`                       | no      | agent (set) | `vercel` writes each server error as one JSON line to Vercel's logs  |

Without the two `NEXT_PUBLIC_` values the app still builds and the public pages work; the sign-in page
says sign-in is not set up. Without `SUPABASE_SECRET_KEY`, people can sign in but cannot create an
organization or invite anyone.

To find the secret key: Supabase → project `grant-desk` → Project Settings → API Keys → Secret keys →
copy the `sb_secret_…` key. Paste it straight into Vercel. Do not send it in chat or email.

## Human steps

### H-2: connect the GitHub repo to Vercel (about 3 minutes)

The Vercel project exists, but Vercel's GitHub app cannot see the `getfunded-ai` organization yet, so
pull requests do not get previews.

1. Open https://github.com/organizations/getfunded-ai/settings/installations.
2. Find **Vercel** → **Configure**. If Vercel is not listed, open
   https://github.com/apps/vercel/installations/new and pick **getfunded-ai**.
3. Under **Repository access**, add `grant-desk` (or choose **All repositories**). Click **Save**.
4. Open Vercel → project `grant-desk` → Settings → Git → **Connect Git Repository** → GitHub →
   `getfunded-ai/grant-desk` → **Connect**.

After this, every pull request gets a preview link from Vercel in a comment.

### Supabase sign-in addresses (about 2 minutes)

Supabase only sends people back to addresses on its list. Without this, sign-in links from a preview
go to the wrong place.

Supabase → project `grant-desk` → Authentication → URL Configuration:

- **Site URL**: `https://grant-desk-iota.vercel.app` (change it when the real domain arrives).
- **Redirect URLs** → Add URL, one at a time:
  - `https://grant-desk-*.vercel.app/**` (every preview)
  - `https://grant-desk-iota.vercel.app/**` (production)
  - `http://localhost:3000/**` (local work)

### H-4: sign-in email through Resend (about 20 minutes)

Supabase's built-in mailer only sends to members of the Supabase team and only a few emails an hour.
Real users need Resend.

1. Create a Resend account and verify the sending domain (the agent can add the DNS records if the
   domain is on Vercel).
2. Resend → API Keys → create a key with "Sending access".
3. Supabase → Authentication → Emails → SMTP Settings → turn on custom SMTP:
   host `smtp.resend.com`, port `465`, user `resend`, password = the Resend key, sender address on the
   verified domain, sender name `Grant Desk`.
4. Supabase → Authentication → Rate Limits: raise "emails per hour" to at least 30.

### Optional: sign-in links that work in any browser

Supabase's default magic-link email only works in the browser that asked for it. To make links work
anywhere (for example, asked for on a laptop, opened on a phone), change two templates in Supabase →
Authentication → Emails → Templates. Keep the wording; replace only the link.

- **Magic Link**: `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink">Sign in</a>`
- **Invite user**: `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite">Accept the invitation</a>`

The app handles both the default links and these. `{{ .RedirectTo }}` already ends in `?next=…`, which
is why the link adds `&`. The unit tests in `tests/auth/` cover this path; it has not been clicked
through on the hosted project yet.

## How sign-in works

- `/sign-in` asks for an email and sends a one-time link (`requestMagicLink` in `lib/auth/actions.ts`).
- The link lands on `/auth/callback`, which turns it into a session cookie and sends the person on
  (`lib/auth/callback.ts`). Invite links carry the session after `#`, which servers cannot read, so the
  callback forwards them to `/auth/finish`, which stores it in the browser.
- `proxy.ts` refreshes the session on every request and sends signed-out people to `/sign-in`. Every
  page and server action checks the user again on the server (`lib/auth/session.ts`).
- Pages are protected by default. Public pages are listed in `lib/auth/routes.ts`; a phase that adds a
  public page adds it there. `/api/` routes are let through and must check their own caller.
- The organization being worked in is a cookie, checked against the person's memberships on every read.
- Database calls for organizations, memberships and profiles are in `lib/auth/org-store.ts` only.

## Local development

1. `pnpm install`
2. Start Supabase locally with the repo's `supabase/` folder (Phase B): `supabase start`. Copy the
   printed API URL, publishable key and secret key into `.env.local`.
3. In the local Supabase config, `auth.site_url` and `auth.additional_redirect_urls` must include
   `http://localhost:3000`.
4. `pnpm dev`, open http://localhost:3000/sign-in, and read the sign-in email in the local mailbox
   (Mailpit, the "Mailpit URL" that `supabase start` prints).

Note: `next dev` adds a block to `AGENTS.md`. Do not commit that change unless Zach asks for it;
`git checkout -- AGENTS.md` removes it.

## Error tracking

`instrumentation.ts` reports server errors when `ERROR_TRACKING=vercel`: one JSON line per error in
Vercel → Project → Logs, with the route, the error name and digest, and no request body. To send them
to Sentry or another tool later, add a Vercel log drain; no code change is needed.
