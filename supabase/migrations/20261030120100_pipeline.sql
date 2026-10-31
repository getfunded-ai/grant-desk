-- Phase B, migration 2: funders, opportunities, grants (the pipeline), stage history, the proposals
-- ledger and the activity log.
--
-- This migration adds the ten pipeline stages and the propose-only ledger. AI and agents never move
-- a stage; they insert a row in proposals and a person accepts or rejects it (AGENTS.md honesty rule 3).
-- Child rows point at their parent through (organization_id, id) so a record in one organization can
-- never be attached to a parent in another.

-- Enums -----------------------------------------------------------------------------------------

create type public.grant_stage as enum (
  'prospect', 'qualifying', 'loi', 'application', 'submitted',
  'awarded', 'declined', 'active', 'reporting', 'closed'
);

-- Stage labels only; the stored stage is always one of grant_stage.
create type public.pipeline_preset as enum ('standard', 'sbir');

create type public.funder_kind as enum (
  'foundation', 'corporate', 'federal', 'state', 'county', 'city', 'other'
);

-- CommonGrants OppStatusOptions.
create type public.opportunity_status as enum ('forecasted', 'open', 'closed', 'custom');

create type public.proposal_status as enum ('proposed', 'accepted', 'rejected');

create type public.actor_kind as enum ('person', 'agent', 'system');

-- Funders ----------------------------------------------------------------------------------------

create table public.funders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 300),
  kind public.funder_kind not null default 'other',
  ein text check (ein ~ '^[0-9]{2}-?[0-9]{7}$'),
  website text,
  -- Identifier of the funder in the commons connector (mcp.getfunded.ai), when known.
  commons_funder_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index funders_organization_id on public.funders (organization_id, name);

-- Opportunities (CommonGrants shape) ------------------------------------------------------------

-- A row with organization_id null is the shared public catalog (for example the nightly Grants.gov
-- load), written only by server code with the service role. A row with organization_id set is an
-- opportunity one organization added by hand and only its members see.
-- Money and counts have no defaults: unknown stays null and reads "Not stated", never 0.
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 1000),
  description text,
  status public.opportunity_status not null,
  status_custom_value text,
  status_description text,
  funder_name text,
  -- funding
  funding_details text,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  total_amount_available numeric(16, 2) check (total_amount_available >= 0),
  min_award_amount numeric(16, 2) check (min_award_amount >= 0),
  max_award_amount numeric(16, 2) check (max_award_amount >= 0),
  min_award_count integer check (min_award_count >= 0),
  max_award_count integer check (max_award_count >= 0),
  estimated_award_count integer check (estimated_award_count >= 0),
  -- key dates
  post_date date,
  close_date date,
  close_time time,
  close_time_zone text,
  other_dates jsonb not null default '[]'::jsonb check (jsonb_typeof(other_dates) = 'array'),
  -- source
  source_system text not null default 'manual',
  source_url text,
  external_id text,
  opportunity_number text,
  external_ids jsonb not null default '{}'::jsonb check (jsonb_typeof(external_ids) = 'object'),
  custom_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_fields) = 'object'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_custom_status check (status <> 'custom' or status_custom_value is not null),
  constraint opportunities_award_range check (
    min_award_amount is null or max_award_amount is null or min_award_amount <= max_award_amount
  ),
  constraint opportunities_catalog_key check (organization_id is not null or external_id is not null)
);

comment on table public.opportunities is
  'CommonGrants-shaped opportunity. organization_id null = public catalog (service role writes only).';

create unique index opportunities_catalog_external_key
  on public.opportunities (source_system, external_id) where organization_id is null;
create index opportunities_organization_id on public.opportunities (organization_id)
  where organization_id is not null;
create index opportunities_close_date on public.opportunities (close_date);

-- Grants (the pipeline item) -----------------------------------------------------------------------

create table public.grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  funder_id uuid,
  opportunity_id uuid references public.opportunities (id),
  title text not null check (length(btrim(title)) between 1 and 500),
  stage public.grant_stage not null default 'prospect',
  preset public.pipeline_preset not null default 'standard',
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  amount_requested numeric(16, 2) check (amount_requested >= 0),
  amount_awarded numeric(16, 2) check (amount_awarded >= 0),
  submission_due_at timestamptz,
  submitted_at timestamptz,
  decision_date date,
  award_start_date date,
  award_end_date date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, funder_id) references public.funders (organization_id, id),
  constraint grants_target check (funder_id is not null or opportunity_id is not null),
  constraint grants_award_period check (
    award_start_date is null or award_end_date is null or award_start_date <= award_end_date
  )
);

create index grants_organization_stage on public.grants (organization_id, stage);
create index grants_funder_id on public.grants (funder_id);
create index grants_opportunity_id on public.grants (opportunity_id);

-- A grant may point at a catalog opportunity or at its own organization's opportunity, never at
-- another organization's.
create function private.check_grant_opportunity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.opportunity_id is not null and not exists (
    select 1 from public.opportunities o
    where o.id = new.opportunity_id
      and (o.organization_id is null or o.organization_id = new.organization_id)
  ) then
    raise exception 'opportunity belongs to another organization' using errcode = '23503';
  end if;
  return new;
end;
$$;

-- Grant stage history (written only by the trigger below) --------------------------------------

create table public.grant_stage_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  grant_id uuid not null,
  from_stage public.grant_stage,
  to_stage public.grant_stage not null,
  changed_by uuid references auth.users (id) on delete set null,
  -- clock_timestamp, not now(): several changes in one transaction keep their order.
  changed_at timestamptz not null default clock_timestamp(),
  foreign key (organization_id, grant_id) references public.grants (organization_id, id) on delete cascade
);

create index grant_stage_history_grant on public.grant_stage_history (grant_id, changed_at);
create index grant_stage_history_organization on public.grant_stage_history (organization_id);

create function private.record_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.grant_stage_history (organization_id, grant_id, from_stage, to_stage, changed_by)
    values (
      new.organization_id,
      new.id,
      case when tg_op = 'UPDATE' then old.stage end,
      new.stage,
      (select auth.uid())
    );
  end if;
  return new;
end;
$$;

-- Proposals (the propose-only ledger) ---------------------------------------------------------------

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  grant_id uuid,
  tool_name text not null check (length(btrim(tool_name)) between 1 and 200),
  summary text not null check (length(btrim(summary)) between 1 and 2000),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  -- AI label (honesty rule 2): the model that produced it and the evidence it cites.
  model text,
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  status public.proposal_status not null default 'proposed',
  proposed_by uuid references auth.users (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, grant_id) references public.grants (organization_id, id) on delete cascade,
  constraint proposals_decision check (
    (status = 'proposed' and decided_at is null and decided_by is null)
    or (status <> 'proposed' and decided_at is not null)
  )
);

comment on table public.proposals is
  'A tool or agent inserts status proposed. A person sets accepted or rejected, once. Tools do not move pipeline stages.';

create index proposals_organization_status on public.proposals (organization_id, status);
create index proposals_grant_id on public.proposals (grant_id);

-- A proposal is decided once, by a person, and its content never changes.
create function private.guard_proposal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'proposed' then
      raise exception 'a proposal starts as proposed' using errcode = '23514';
    end if;
    new.decided_by := null;
    new.decided_at := null;
    return new;
  end if;

  -- A foreign key clearing a deleted person's id (one trigger level deeper) is the only other change.
  if pg_trigger_depth() > 1
     and (to_jsonb(new) - '{proposed_by,decided_by}'::text[]) = (to_jsonb(old) - '{proposed_by,decided_by}'::text[])
     and (new.proposed_by is null or new.proposed_by = old.proposed_by)
     and (new.decided_by is null or new.decided_by = old.decided_by) then
    return new;
  end if;

  if old.status <> 'proposed' then
    raise exception 'this proposal was already decided' using errcode = '23514';
  end if;
  if new.status = 'proposed' then
    raise exception 'a decision must accept or reject' using errcode = '23514';
  end if;
  if (to_jsonb(new) - '{status,decided_by,decided_at}'::text[])
     is distinct from (to_jsonb(old) - '{status,decided_by,decided_at}'::text[]) then
    raise exception 'only the decision of a proposal can change' using errcode = '42501';
  end if;
  new.decided_by := (select auth.uid());
  new.decided_at := now();
  return new;
end;
$$;

-- Activity log (append-only) ------------------------------------------------------------------------

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  grant_id uuid,
  actor_kind public.actor_kind not null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (length(btrim(action)) between 1 and 100),
  summary text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  -- Keep the log line when its grant is deleted.
  foreign key (organization_id, grant_id) references public.grants (organization_id, id)
    on delete set null (grant_id)
);

create index activity_log_organization_created on public.activity_log (organization_id, created_at desc);
create index activity_log_grant on public.activity_log (grant_id, created_at desc);

-- Triggers ----------------------------------------------------------------------------------------

create trigger funders_updated_at before update on public.funders
  for each row execute function private.set_updated_at();
create trigger funders_keep_owner_columns before update on public.funders
  for each row execute function private.keep_owner_columns();

create trigger opportunities_updated_at before update on public.opportunities
  for each row execute function private.set_updated_at();
create trigger opportunities_keep_owner_columns before update on public.opportunities
  for each row execute function private.keep_owner_columns();

create trigger grants_updated_at before update on public.grants
  for each row execute function private.set_updated_at();
create trigger grants_keep_owner_columns before update on public.grants
  for each row execute function private.keep_owner_columns();
create trigger grants_check_opportunity before insert or update of opportunity_id on public.grants
  for each row execute function private.check_grant_opportunity();
create trigger grants_record_stage after insert or update of stage on public.grants
  for each row execute function private.record_stage_change();

create trigger proposals_guard before insert or update on public.proposals
  for each row execute function private.guard_proposal();

revoke all on function private.check_grant_opportunity(), private.record_stage_change(),
  private.guard_proposal()
from public, anon, authenticated;

-- Row-level security ------------------------------------------------------------------------------

alter table public.funders enable row level security;
alter table public.opportunities enable row level security;
alter table public.grants enable row level security;
alter table public.grant_stage_history enable row level security;
alter table public.proposals enable row level security;
alter table public.activity_log enable row level security;

-- Funders: members read; editors write; admins delete.
create policy funders_select on public.funders
  for select to authenticated using (private.is_member(organization_id));
create policy funders_insert on public.funders
  for insert to authenticated
  with check (private.can_edit(organization_id) and created_by = (select auth.uid()));
create policy funders_update on public.funders
  for update to authenticated
  using (private.can_edit(organization_id)) with check (private.can_edit(organization_id));
create policy funders_delete on public.funders
  for delete to authenticated using (private.is_admin(organization_id));

-- Opportunities: everyone signed in reads the catalog; an organization's own rows follow membership.
create policy opportunities_select on public.opportunities
  for select to authenticated
  using (organization_id is null or private.is_member(organization_id));
create policy opportunities_insert on public.opportunities
  for insert to authenticated
  with check (
    organization_id is not null
    and private.can_edit(organization_id)
    and created_by = (select auth.uid())
  );
create policy opportunities_update on public.opportunities
  for update to authenticated
  using (organization_id is not null and private.can_edit(organization_id))
  with check (organization_id is not null and private.can_edit(organization_id));
create policy opportunities_delete on public.opportunities
  for delete to authenticated
  using (organization_id is not null and private.is_admin(organization_id));

-- Grants: members read; editors create and update; admins delete.
create policy grants_select on public.grants
  for select to authenticated using (private.is_member(organization_id));
create policy grants_insert on public.grants
  for insert to authenticated
  with check (private.can_edit(organization_id) and created_by = (select auth.uid()));
create policy grants_update on public.grants
  for update to authenticated
  using (private.can_edit(organization_id)) with check (private.can_edit(organization_id));
create policy grants_delete on public.grants
  for delete to authenticated using (private.is_admin(organization_id));

-- Stage history: read only.
create policy grant_stage_history_select on public.grant_stage_history
  for select to authenticated using (private.is_member(organization_id));

-- Proposals: members read; editors propose and decide; nobody deletes.
create policy proposals_select on public.proposals
  for select to authenticated using (private.is_member(organization_id));
create policy proposals_insert on public.proposals
  for insert to authenticated
  with check (
    private.can_edit(organization_id)
    and status = 'proposed'
    and proposed_by = (select auth.uid())
  );
create policy proposals_update on public.proposals
  for update to authenticated
  using (private.can_edit(organization_id)) with check (private.can_edit(organization_id));

-- Activity log: members read; editors add lines in their own name; nobody edits or deletes.
create policy activity_log_select on public.activity_log
  for select to authenticated using (private.is_member(organization_id));
create policy activity_log_insert on public.activity_log
  for insert to authenticated
  with check (
    private.can_edit(organization_id)
    and actor_kind = 'person'
    and actor_id = (select auth.uid())
  );

-- Table privileges ----------------------------------------------------------------------------------

revoke all on table public.funders, public.opportunities, public.grants, public.grant_stage_history,
  public.proposals, public.activity_log
from anon, authenticated;

grant select, insert, update, delete on table public.funders, public.opportunities, public.grants
  to authenticated;
grant select on table public.grant_stage_history to authenticated;
-- Ledger and log rows take their id and time from the database, never from the caller, so nobody can
-- back-date a line or a proposal.
grant select on table public.proposals to authenticated;
grant insert (organization_id, grant_id, tool_name, summary, payload, model, sources, proposed_by)
  on table public.proposals to authenticated;
grant update (status) on table public.proposals to authenticated;
grant select on table public.activity_log to authenticated;
grant insert (organization_id, grant_id, actor_kind, actor_id, action, summary, details)
  on table public.activity_log to authenticated;

grant all on table public.funders, public.opportunities, public.grants, public.grant_stage_history,
  public.proposals, public.activity_log
to service_role;
