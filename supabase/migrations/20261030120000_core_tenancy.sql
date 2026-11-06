-- Phase B, migration 1: organizations, memberships, profiles and the row-level-security helpers.
--
-- Rules (AGENTS.md "Data rules"):
-- * Every tenant table has organization_id and row-level security scoped by membership.
-- * The anon role gets nothing. Policies are written for the authenticated role only.
-- * service_role (server code only) bypasses row-level security; it never reaches the browser.
-- Helpers that read memberships are security definer functions in the schema `private`, which the
-- Data API does not expose, so they cannot be called as RPCs and do not recurse through RLS.

-- New tables and functions in public start with no anon access; each table grants what it needs.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Enums -----------------------------------------------------------------------------------------

create type public.membership_role as enum ('owner', 'admin', 'editor', 'viewer');

-- Shared trigger functions ---------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- A row never moves to another organization, and its creator never changes. Without this a person
-- who belongs to two organizations could carry a record (and its children) across the data wall.
create function private.keep_owner_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) -> 'organization_id' is distinct from to_jsonb(old) -> 'organization_id' then
    raise exception 'organization_id cannot change' using errcode = '42501';
  end if;
  -- The one allowed change: the foreign key clearing the creator when their account is deleted,
  -- which runs one trigger level deeper.
  if to_jsonb(new) -> 'created_by' is distinct from to_jsonb(old) -> 'created_by'
     and not (pg_trigger_depth() > 1 and to_jsonb(new) -> 'created_by' = 'null'::jsonb) then
    raise exception 'created_by cannot change' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Organizations --------------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  ein text check (ein ~ '^[0-9]{2}-?[0-9]{7}$'),
  uei text check (uei ~ '^[A-Z0-9]{12}$'),
  mission text,
  website text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is
  'A tenant. Every tenant record carries organization_id. Created only through create_organization().';

create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger organizations_keep_owner_columns before update on public.organizations
  for each row execute function private.keep_owner_columns();

-- Memberships ----------------------------------------------------------------------------------

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.membership_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index memberships_user_id on public.memberships (user_id);

create trigger memberships_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();
create trigger memberships_keep_owner_columns before update on public.memberships
  for each row execute function private.keep_owner_columns();

-- Profiles (one per person, not per organization) ---------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text check (display_name is null or length(display_name) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per person. Not a tenant table: readable by the person and by people who share an organization.';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Row-level-security helpers -------------------------------------------------------------------

create function private.has_role(p_organization_id uuid, p_roles public.membership_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create function private.is_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(p_organization_id, '{owner,admin,editor,viewer}');
$$;

create function private.can_edit(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(p_organization_id, '{owner,admin,editor}');
$$;

create function private.is_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(p_organization_id, '{owner,admin}');
$$;

create function private.is_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(p_organization_id, '{owner}');
$$;

create function private.shares_organization(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function
  private.has_role(uuid, public.membership_role[]),
  private.is_member(uuid),
  private.can_edit(uuid),
  private.is_admin(uuid),
  private.is_owner(uuid),
  private.shares_organization(uuid)
to authenticated, service_role;

-- An organization always keeps at least one owner. Cascaded deletes (the organization or the
-- person's account being deleted) run one trigger level deeper and are allowed through; repairing an
-- organization whose last owner deleted their account is a service-role step (Phase Y).
-- Locking the organization row first makes two owners who demote each other at the same moment
-- take turns, so the second one sees the first change and is refused.
create function private.keep_one_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    perform 1 from public.organizations o where o.id = old.organization_id for no key update;
  end if;
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1 from public.memberships m
       where m.organization_id = old.organization_id
         and m.role = 'owner'
         and m.id <> old.id
     ) then
    raise exception 'an organization must keep at least one owner' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_keep_one_owner before update or delete on public.memberships
  for each row execute function private.keep_one_owner();

-- A profile for every new person, copied from auth.users.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, left(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 200))
  on conflict (id) do nothing;
  return new;
end;
$$;

create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

revoke all on function private.keep_one_owner(), private.handle_new_user(),
  private.handle_user_email_change(), private.set_updated_at(), private.keep_owner_columns()
from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Creating an organization -----------------------------------------------------------------------

-- The only way a person creates an organization: it is created and the caller becomes its owner
-- in one step. A person cannot insert into organizations or memberships directly.
create function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
begin
  if v_user is null then
    raise exception 'sign in to create an organization' using errcode = '42501';
  end if;
  insert into public.organizations (name, created_by) values (p_name, v_user) returning id into v_org;
  insert into public.memberships (organization_id, user_id, role) values (v_org, v_user, 'owner');
  return v_org;
end;
$$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- Row-level security ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.profiles enable row level security;

create policy organizations_select on public.organizations
  for select to authenticated using (private.is_member(id));
create policy organizations_update on public.organizations
  for update to authenticated
  using (private.is_admin(id))
  with check (private.is_admin(id));

create policy memberships_select on public.memberships
  for select to authenticated using (private.is_member(organization_id));
-- Nobody adds another person with a signed-in session: that would let anyone pull a stranger into
-- an organization (and read their profile). A person joins by creating an organization, or through
-- server code that has checked the invitee accepted (Phase C invite, Phase L team).
-- Admins change roles; only owners change owner rows.
create policy memberships_update on public.memberships
  for update to authenticated
  using (
    private.is_admin(organization_id)
    and (role <> 'owner' or private.is_owner(organization_id))
  )
  with check (
    private.is_admin(organization_id)
    and (role <> 'owner' or private.is_owner(organization_id))
  );
-- Admins remove members (owners only by owners); anyone may leave.
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (
      private.is_admin(organization_id)
      and (role <> 'owner' or private.is_owner(organization_id))
    )
  );

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_organization(id));
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Table privileges: nothing for anon; only the verbs a policy allows for authenticated; column
-- lists keep identifying columns out of reach of UPDATE.
revoke all on table public.organizations, public.memberships, public.profiles from anon, authenticated;
grant select on table public.organizations to authenticated;
grant update (name, ein, uei, mission, website) on table public.organizations to authenticated;
grant select, delete on table public.memberships to authenticated;
grant update (role) on table public.memberships to authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant all on table public.organizations, public.memberships, public.profiles to service_role;
