-- Phase B, migration 3: the work around a grant. External feeds, deadlines, tasks, documents, notes
-- and the boilerplate answer library. Every table is a tenant table: organization_id, row-level
-- security by membership, nothing for anon.

create type public.feed_kind as enum ('ical', 'rss');

create type public.deadline_kind as enum ('loi', 'application', 'report', 'internal', 'other');

create type public.task_status as enum ('open', 'done');

-- External feeds (outside iCal and RSS the app subscribes to) ----------------------------------

create table public.external_feeds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  kind public.feed_kind not null,
  url text not null check (url ~* '^https?://'),
  enabled boolean not null default true,
  last_fetched_at timestamptz,
  last_status text,
  last_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, url)
);

-- Deadlines ------------------------------------------------------------------------------------

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  grant_id uuid,
  external_feed_id uuid,
  -- The event's UID in its feed, so a refresh updates instead of duplicating.
  external_uid text,
  title text not null check (length(btrim(title)) between 1 and 500),
  kind public.deadline_kind not null default 'other',
  due_at timestamptz not null,
  all_day boolean not null default false,
  -- IANA zone the deadline was stated in, for example America/New_York. Null = not stated.
  time_zone text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, grant_id) references public.grants (organization_id, id) on delete cascade,
  foreign key (organization_id, external_feed_id)
    references public.external_feeds (organization_id, id) on delete cascade,
  unique (external_feed_id, external_uid),
  constraint deadlines_feed_uid check (external_uid is null or external_feed_id is not null)
);

create index deadlines_organization_due on public.deadlines (organization_id, due_at);
create index deadlines_grant on public.deadlines (grant_id);

-- Tasks ------------------------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  grant_id uuid,
  title text not null check (length(btrim(title)) between 1 and 500),
  description text,
  status public.task_status not null default 'open',
  due_date date,
  -- Only a member of the same organization can be assigned.
  assignee_id uuid,
  completed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, grant_id) references public.grants (organization_id, id) on delete cascade,
  foreign key (organization_id, assignee_id) references public.memberships (organization_id, user_id)
    on delete set null (assignee_id)
);

create index tasks_organization_status on public.tasks (organization_id, status, due_date);
create index tasks_grant on public.tasks (grant_id);
create index tasks_assignee on public.tasks (assignee_id);

-- Documents (metadata; the files live in Supabase Storage, Phase F) -----------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  grant_id uuid,
  name text not null check (length(btrim(name)) between 1 and 500),
  -- Object path inside the storage bucket; always starts with the organization id, so one
  -- organization can neither claim nor probe another's paths.
  storage_path text not null check (storage_path like organization_id::text || '/_%'),
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  version integer not null default 1 check (version >= 1),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, grant_id) references public.grants (organization_id, id) on delete cascade,
  unique (organization_id, storage_path)
);
create index documents_grant on public.documents (grant_id);

-- Notes ------------------------------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  grant_id uuid,
  funder_id uuid,
  body text not null check (length(btrim(body)) >= 1),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, grant_id) references public.grants (organization_id, id) on delete cascade,
  foreign key (organization_id, funder_id) references public.funders (organization_id, id) on delete cascade
);

create index notes_organization on public.notes (organization_id, created_at desc);
create index notes_grant on public.notes (grant_id);
create index notes_funder on public.notes (funder_id);

-- Boilerplate (the reusable answer library) -----------------------------------------------------

create table public.boilerplate (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  body text not null,
  category text,
  tags text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index boilerplate_organization on public.boilerplate (organization_id, title);

-- Triggers ----------------------------------------------------------------------------------------

create trigger external_feeds_updated_at before update on public.external_feeds
  for each row execute function private.set_updated_at();
create trigger external_feeds_keep_owner_columns before update on public.external_feeds
  for each row execute function private.keep_owner_columns();
create trigger deadlines_updated_at before update on public.deadlines
  for each row execute function private.set_updated_at();
create trigger deadlines_keep_owner_columns before update on public.deadlines
  for each row execute function private.keep_owner_columns();
create trigger tasks_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();
create trigger tasks_keep_owner_columns before update on public.tasks
  for each row execute function private.keep_owner_columns();
create trigger documents_updated_at before update on public.documents
  for each row execute function private.set_updated_at();
create trigger documents_keep_owner_columns before update on public.documents
  for each row execute function private.keep_owner_columns();
create trigger notes_updated_at before update on public.notes
  for each row execute function private.set_updated_at();
create trigger notes_keep_owner_columns before update on public.notes
  for each row execute function private.keep_owner_columns();
create trigger boilerplate_updated_at before update on public.boilerplate
  for each row execute function private.set_updated_at();
create trigger boilerplate_keep_owner_columns before update on public.boilerplate
  for each row execute function private.keep_owner_columns();

-- Row-level security: members read; editors create, update and delete ---------------------------

alter table public.external_feeds enable row level security;
alter table public.deadlines enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;
alter table public.notes enable row level security;
alter table public.boilerplate enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['external_feeds', 'deadlines', 'tasks', 'documents', 'notes', 'boilerplate']
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

-- Table privileges ----------------------------------------------------------------------------------

revoke all on table public.external_feeds, public.deadlines, public.tasks, public.documents,
  public.notes, public.boilerplate
from anon, authenticated;

grant select, insert, update, delete on table public.external_feeds, public.deadlines, public.tasks,
  public.documents, public.notes, public.boilerplate
to authenticated;

grant all on table public.external_feeds, public.deadlines, public.tasks, public.documents,
  public.notes, public.boilerplate
to service_role;
