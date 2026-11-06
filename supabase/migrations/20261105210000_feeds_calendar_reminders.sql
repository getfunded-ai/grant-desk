-- Phase E, migration 1: what the calendar and the reminders need on top of Phase B.
--
-- * feed_items: news items from an outside RSS feed (external_feeds). iCal events from a feed go
--   into deadlines (Phase B) with external_feed_id and external_uid; RSS has no dates to put on a
--   calendar, so its items are kept here and shown as a news list.
-- * calendar_tokens: the secret behind an organization's own iCal address. Only a hash is stored;
--   the address is shown once, when it is made, and can be revoked.
-- * reminder_preferences: one row per person per organization: one email per item, a daily
--   digest, or nothing.
-- * reminder_log: which reminder went to whom, written only by server code after a real send, so a
--   reminder is never sent twice and never claimed when it did not go out.
-- * contacts: people at a funder or on a grant.
-- Every table is a tenant table: organization_id, row-level security by membership, nothing for
-- anon (AGENTS.md "Data rules"). Child rows point at their parent through (organization_id, id).

create type public.reminder_mode as enum ('each', 'digest', 'off');

-- Feed items (RSS) -------------------------------------------------------------------------------

create table public.feed_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  external_feed_id uuid not null,
  -- The item's guid (or link) in its feed, so a refresh updates instead of duplicating.
  external_uid text not null check (length(external_uid) between 1 and 2000),
  title text not null check (length(btrim(title)) between 1 and 1000),
  link text check (link ~* '^https?://'),
  summary text,
  -- Null = the feed did not state a date; it reads "Not stated", never now().
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, external_feed_id)
    references public.external_feeds (organization_id, id) on delete cascade,
  unique (external_feed_id, external_uid)
);

create index feed_items_organization_published on public.feed_items (organization_id, published_at desc);

-- Calendar tokens (the organization's own iCal address) -----------------------------------------

create table public.calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- sha256 of the random token in the address, hex. The token itself is never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text check (label is null or length(label) <= 200),
  revoked_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index calendar_tokens_organization on public.calendar_tokens (organization_id);

-- Reminder preferences (per person, per organization) -------------------------------------------

create table public.reminder_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null,
  mode public.reminder_mode not null default 'digest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  -- Only a member of the organization has a preference in it; leaving removes it.
  foreign key (organization_id, user_id) references public.memberships (organization_id, user_id)
    on delete cascade
);

-- Reminder log (written only by server code after a real send) ----------------------------------

create table public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- What the reminder was about: "deadline:<id>", "task:<id>", "grant_due:<id>" or "digest".
  item_key text not null check (length(item_key) between 1 and 200),
  -- The reminder step (30, 14, 7 or 1 days before); 0 for a digest, which is keyed by its day.
  days_before integer not null check (days_before >= 0),
  sent_at timestamptz not null default now(),
  -- The id the mail provider returned, as evidence the message was accepted.
  provider_message_id text,
  unique (organization_id, user_id, item_key, days_before)
);

create index reminder_log_organization_sent on public.reminder_log (organization_id, sent_at desc);

comment on table public.reminder_log is
  'One row per reminder that a mail provider accepted. Server code only; a skipped or failed send writes nothing.';

-- Contacts ----------------------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  grant_id uuid,
  funder_id uuid,
  name text not null check (length(btrim(name)) between 1 and 300),
  role text check (role is null or length(role) <= 200),
  email text check (email is null or length(email) <= 254),
  phone text check (phone is null or length(phone) <= 50),
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, grant_id) references public.grants (organization_id, id) on delete cascade,
  foreign key (organization_id, funder_id) references public.funders (organization_id, id) on delete cascade,
  constraint contacts_target check (grant_id is not null or funder_id is not null)
);

create index contacts_grant on public.contacts (grant_id);
create index contacts_funder on public.contacts (funder_id);

-- Triggers ----------------------------------------------------------------------------------------

create trigger feed_items_updated_at before update on public.feed_items
  for each row execute function private.set_updated_at();
create trigger feed_items_keep_owner_columns before update on public.feed_items
  for each row execute function private.keep_owner_columns();
create trigger calendar_tokens_updated_at before update on public.calendar_tokens
  for each row execute function private.set_updated_at();
create trigger calendar_tokens_keep_owner_columns before update on public.calendar_tokens
  for each row execute function private.keep_owner_columns();
create trigger reminder_preferences_updated_at before update on public.reminder_preferences
  for each row execute function private.set_updated_at();
create trigger reminder_preferences_keep_owner_columns before update on public.reminder_preferences
  for each row execute function private.keep_owner_columns();
create trigger contacts_updated_at before update on public.contacts
  for each row execute function private.set_updated_at();
create trigger contacts_keep_owner_columns before update on public.contacts
  for each row execute function private.keep_owner_columns();

-- Row-level security ------------------------------------------------------------------------------

alter table public.feed_items enable row level security;
alter table public.calendar_tokens enable row level security;
alter table public.reminder_preferences enable row level security;
alter table public.reminder_log enable row level security;
alter table public.contacts enable row level security;

-- Feed items, calendar tokens, contacts: members read; editors create, update and delete.
do $$
declare
  t text;
begin
  foreach t in array array['feed_items', 'calendar_tokens', 'contacts']
  loop
    execute format(
      'create policy %1$I on public.%2$I for select to authenticated
         using (private.is_member(organization_id))',
      t || '_select', t);
    execute format(
      'create policy %1$I on public.%2$I for insert to authenticated
         with check (private.can_edit(organization_id) and created_by = (select auth.uid()))',
      t || '_insert', t);
    execute format(
      'create policy %1$I on public.%2$I for update to authenticated
         using (private.can_edit(organization_id)) with check (private.can_edit(organization_id))',
      t || '_update', t);
    execute format(
      'create policy %1$I on public.%2$I for delete to authenticated
         using (private.can_edit(organization_id))',
      t || '_delete', t);
  end loop;
end;
$$;

-- Reminder preferences: a person sees and sets only their own, inside an organization they belong to.
create policy reminder_preferences_select on public.reminder_preferences
  for select to authenticated
  using (private.is_member(organization_id) and user_id = (select auth.uid()));
create policy reminder_preferences_insert on public.reminder_preferences
  for insert to authenticated
  with check (private.is_member(organization_id) and user_id = (select auth.uid()));
create policy reminder_preferences_update on public.reminder_preferences
  for update to authenticated
  using (private.is_member(organization_id) and user_id = (select auth.uid()))
  with check (private.is_member(organization_id) and user_id = (select auth.uid()));
create policy reminder_preferences_delete on public.reminder_preferences
  for delete to authenticated
  using (private.is_member(organization_id) and user_id = (select auth.uid()));

-- Reminder log: a person reads what was sent to them; only server code writes.
create policy reminder_log_select on public.reminder_log
  for select to authenticated
  using (private.is_member(organization_id) and user_id = (select auth.uid()));

-- Table privileges ----------------------------------------------------------------------------------

revoke all on table public.feed_items, public.calendar_tokens, public.reminder_preferences,
  public.reminder_log, public.contacts
from anon, authenticated;

grant select, insert, update, delete on table public.feed_items, public.calendar_tokens,
  public.contacts
to authenticated;
grant select, insert, delete on table public.reminder_preferences to authenticated;
grant update (mode) on table public.reminder_preferences to authenticated;
grant select on table public.reminder_log to authenticated;

grant all on table public.feed_items, public.calendar_tokens, public.reminder_preferences,
  public.reminder_log, public.contacts
to service_role;
