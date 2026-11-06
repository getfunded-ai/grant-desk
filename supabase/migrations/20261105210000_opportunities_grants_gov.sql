-- Phase D, migration 1: the Grants.gov catalog.
--
-- Adds the reference tables the federal catalog needs (agencies, Assistance Listings), a table for
-- the details a detail fetch brings back (application packages, attachments), the sync-run log,
-- full-text search over opportunities, the batch upsert the nightly job calls, and the trigger that
-- writes an activity_log line for every tracked grant when its opportunity's status or close date
-- changes.
--
-- None of the new tables is a tenant table: they hold public federal data or server-side run logs,
-- carry no organization_id, and only server code (service role) writes them. Signed-in people read
-- them; anon gets nothing (AGENTS.md "Data rules"). Opportunity rows keep the CommonGrants shape
-- Phase B defined; Grants.gov-only fields live in custom_fields.grants_gov and in opportunity_details.

-- Reference tables --------------------------------------------------------------------------------

-- Grants.gov agencies, keyed by the agency code the extract and the API use (for example HHS-ACF-ORR).
create table public.grants_gov_agencies (
  code text primary key check (length(btrim(code)) between 1 and 80),
  name text not null check (length(btrim(name)) between 1 and 300),
  -- The department an agency belongs to (HHS for HHS-ACF-ORR). Equal to code for a top-level agency.
  top_agency_code text not null check (length(btrim(top_agency_code)) between 1 and 80),
  updated_at timestamptz not null default now()
);

comment on table public.grants_gov_agencies is
  'Grants.gov agency codes and names. Public reference data; written by the sync jobs only.';

create index grants_gov_agencies_top on public.grants_gov_agencies (top_agency_code, name);

-- Assistance Listings (the former CFDA numbers), for example 93.676.
create table public.assistance_listings (
  number text primary key check (number ~ '^[0-9]{2}\.[0-9A-Z]{3}$'),
  -- Not stated until a detail fetch supplies it: the nightly extract carries numbers only.
  title text check (title is null or length(btrim(title)) between 1 and 500),
  updated_at timestamptz not null default now()
);

comment on table public.assistance_listings is
  'Assistance Listing numbers and titles. Public reference data; written by the sync jobs only.';

-- What a Grants.gov detail fetch adds to a catalog opportunity. One row per opportunity.
create table public.opportunity_details (
  opportunity_id uuid primary key references public.opportunities (id) on delete cascade,
  source_system text not null,
  fetched_at timestamptz not null default now(),
  revision integer,
  -- Application packages: package id, dialect, opening and closing dates, workspace-compatible flag.
  packages jsonb not null default '[]'::jsonb check (jsonb_typeof(packages) = 'array'),
  -- Attachments: id, file name, description, size, folder; downloaded from Grants.gov, never stored here.
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  -- Assistance Listings with their program titles, as the detail fetch states them.
  assistance_listings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(assistance_listings) = 'array'),
  -- Anything else worth keeping from the fetch (cost sharing, contact, forecast dates, flags).
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

comment on table public.opportunity_details is
  'Packages, attachments and listing titles fetched for a catalog opportunity. Written by the sync jobs only.';

-- One row per sync run, so the app can say when the catalog was last loaded and what happened.
create table public.opportunity_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_system text not null check (length(btrim(source_system)) between 1 and 100),
  job text not null check (job in ('nightly', 'intraday')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source_url text,
  counts jsonb not null default '{}'::jsonb check (jsonb_typeof(counts) = 'object'),
  -- A short plain-words reason when status is failed. Never a secret, never a stack trace.
  error text check (error is null or length(error) <= 2000)
);

comment on table public.opportunity_sync_runs is
  'Log of catalog sync runs (nightly extract, intraday API). Written by the sync jobs only.';

create index opportunity_sync_runs_recent
  on public.opportunity_sync_runs (source_system, job, started_at desc);

-- Full-text search over opportunities ------------------------------------------------------------

-- Title first, number and funder next, then the start of the description. The description is cut
-- so one very long notice cannot push a search vector past Postgres's limits.
alter table public.opportunities
  add column search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(
      to_tsvector('english', coalesce(opportunity_number, '') || ' ' || coalesce(funder_name, '')),
      'B'
    )
    || setweight(to_tsvector('english', left(coalesce(description, ''), 20000)), 'C')
  ) stored;

create index opportunities_search on public.opportunities using gin (search);
create index opportunities_catalog_status
  on public.opportunities (source_system, status, close_date) where organization_id is null;

-- Tracked grants hear about changes ---------------------------------------------------------------

-- When a catalog opportunity's status or close date changes, every grant that tracks it gets one
-- activity_log line in its own organization. The log is append-only and nothing here touches the
-- grant itself (AGENTS.md honesty rule 3: agents never move a stage or edit a grant record).
create function private.log_opportunity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is not null then
    return new;
  end if;
  if new.status is distinct from old.status or new.close_date is distinct from old.close_date then
    insert into public.activity_log
      (organization_id, grant_id, actor_kind, actor_id, action, summary, details)
    select
      g.organization_id,
      g.id,
      'system',
      null,
      'opportunity.changed',
      concat_ws(
        '; ',
        'Opportunity updated at the source (' || new.source_system || ')',
        case when new.status is distinct from old.status
          then 'status changed from ' || old.status || ' to ' || new.status end,
        case when new.close_date is distinct from old.close_date
          then 'close date changed from ' || coalesce(old.close_date::text, 'not stated')
            || ' to ' || coalesce(new.close_date::text, 'not stated') end
      ),
      jsonb_build_object(
        'opportunity_id', new.id,
        'source_system', new.source_system,
        'from', jsonb_build_object('status', old.status, 'close_date', old.close_date),
        'to', jsonb_build_object('status', new.status, 'close_date', new.close_date)
      )
    from public.grants g
    where g.opportunity_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.log_opportunity_change() from public, anon, authenticated;

create trigger opportunities_log_change after update of status, close_date on public.opportunities
  for each row execute function private.log_opportunity_change();

-- The batch upsert the sync jobs call ---------------------------------------------------------------

-- Inserts or updates catalog rows (organization_id null) for one source in one statement. Rows whose
-- content did not change are left alone, so updated_at only moves when something did. Service role
-- only: the catalog is never written with a signed-in session. Each element of p_rows carries the
-- CommonGrants columns of public.opportunities; external_id and title are required.
create function public.upsert_catalog_opportunities(p_source_system text, p_rows jsonb)
returns table (inserted integer, updated integer, unchanged integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_inserted integer;
  v_updated integer;
begin
  if p_source_system is null or length(btrim(p_source_system)) = 0 then
    raise exception 'p_source_system is required' using errcode = '22023';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array' using errcode = '22023';
  end if;

  select count(*)::integer into v_total from jsonb_array_elements(p_rows);

  with incoming as (
    select *
    from jsonb_to_recordset(p_rows) as r(
      title text,
      description text,
      status public.opportunity_status,
      status_custom_value text,
      status_description text,
      funder_name text,
      funding_details text,
      currency text,
      total_amount_available numeric,
      min_award_amount numeric,
      max_award_amount numeric,
      min_award_count integer,
      max_award_count integer,
      estimated_award_count integer,
      post_date date,
      close_date date,
      close_time time,
      close_time_zone text,
      other_dates jsonb,
      source_url text,
      external_id text,
      opportunity_number text,
      external_ids jsonb,
      custom_fields jsonb
    )
  ),
  written as (
    insert into public.opportunities (
      organization_id, source_system, title, description, status, status_custom_value,
      status_description, funder_name, funding_details, currency, total_amount_available,
      min_award_amount, max_award_amount, min_award_count, max_award_count, estimated_award_count,
      post_date, close_date, close_time, close_time_zone, other_dates, source_url, external_id,
      opportunity_number, external_ids, custom_fields, created_by
    )
    select
      null, p_source_system, i.title, i.description, i.status, i.status_custom_value,
      i.status_description, i.funder_name, i.funding_details, coalesce(i.currency, 'USD'),
      i.total_amount_available, i.min_award_amount, i.max_award_amount, i.min_award_count,
      i.max_award_count, i.estimated_award_count, i.post_date, i.close_date, i.close_time,
      i.close_time_zone, coalesce(i.other_dates, '[]'::jsonb), i.source_url, i.external_id,
      i.opportunity_number, coalesce(i.external_ids, '{}'::jsonb),
      coalesce(i.custom_fields, '{}'::jsonb), null
    from incoming i
    on conflict (source_system, external_id) where organization_id is null do update set
      title = excluded.title,
      description = excluded.description,
      status = excluded.status,
      status_custom_value = excluded.status_custom_value,
      status_description = excluded.status_description,
      funder_name = excluded.funder_name,
      funding_details = excluded.funding_details,
      currency = excluded.currency,
      total_amount_available = excluded.total_amount_available,
      min_award_amount = excluded.min_award_amount,
      max_award_amount = excluded.max_award_amount,
      min_award_count = excluded.min_award_count,
      max_award_count = excluded.max_award_count,
      estimated_award_count = excluded.estimated_award_count,
      post_date = excluded.post_date,
      close_date = excluded.close_date,
      close_time = excluded.close_time,
      close_time_zone = excluded.close_time_zone,
      other_dates = excluded.other_dates,
      source_url = excluded.source_url,
      opportunity_number = excluded.opportunity_number,
      external_ids = excluded.external_ids,
      custom_fields = excluded.custom_fields
    where (
      public.opportunities.title, public.opportunities.description, public.opportunities.status,
      public.opportunities.status_custom_value, public.opportunities.status_description,
      public.opportunities.funder_name, public.opportunities.funding_details,
      public.opportunities.currency, public.opportunities.total_amount_available,
      public.opportunities.min_award_amount, public.opportunities.max_award_amount,
      public.opportunities.min_award_count, public.opportunities.max_award_count,
      public.opportunities.estimated_award_count, public.opportunities.post_date,
      public.opportunities.close_date, public.opportunities.close_time,
      public.opportunities.close_time_zone, public.opportunities.other_dates,
      public.opportunities.source_url, public.opportunities.opportunity_number,
      public.opportunities.external_ids, public.opportunities.custom_fields
    ) is distinct from (
      excluded.title, excluded.description, excluded.status, excluded.status_custom_value,
      excluded.status_description, excluded.funder_name, excluded.funding_details,
      excluded.currency, excluded.total_amount_available, excluded.min_award_amount,
      excluded.max_award_amount, excluded.min_award_count, excluded.max_award_count,
      excluded.estimated_award_count, excluded.post_date, excluded.close_date, excluded.close_time,
      excluded.close_time_zone, excluded.other_dates, excluded.source_url,
      excluded.opportunity_number, excluded.external_ids, excluded.custom_fields
    )
    returning (xmax = 0) as is_new
  )
  select
    count(*) filter (where is_new)::integer,
    count(*) filter (where not is_new)::integer
  into v_inserted, v_updated
  from written;

  return query select v_inserted, v_updated, v_total - v_inserted - v_updated;
end;
$$;

revoke all on function public.upsert_catalog_opportunities(text, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_catalog_opportunities(text, jsonb) to service_role;

-- Browse and search --------------------------------------------------------------------------------

-- The browse page's query. Runs as the caller, so row-level security decides which opportunities
-- are visible (the catalog plus the caller's own organizations' rows). Filters that read a
-- Grants.gov code (eligibility, agency, category) look inside custom_fields.grants_gov. A money
-- filter never matches a row whose amount is not stated: unknown is not zero.
create function public.search_opportunities(
  p_keyword text default null,
  p_statuses public.opportunity_status[] default null,
  p_eligibilities text[] default null,
  p_agency text default null,
  p_categories text[] default null,
  p_close_from date default null,
  p_close_to date default null,
  p_min_award_ceiling numeric default null,
  p_source_system text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  status public.opportunity_status,
  status_description text,
  funder_name text,
  opportunity_number text,
  external_id text,
  source_system text,
  source_url text,
  post_date date,
  close_date date,
  min_award_amount numeric,
  max_award_amount numeric,
  total_amount_available numeric,
  agency_code text,
  eligible_applicants text[],
  funding_categories text[],
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with q as (
    select case
      when nullif(btrim(p_keyword), '') is null then null
      else websearch_to_tsquery('english', p_keyword)
    end as query
  )
  select
    o.id,
    o.title,
    o.status,
    o.status_description,
    o.funder_name,
    o.opportunity_number,
    o.external_id,
    o.source_system,
    o.source_url,
    o.post_date,
    o.close_date,
    o.min_award_amount,
    o.max_award_amount,
    o.total_amount_available,
    o.custom_fields #>> '{grants_gov,agency_code}' as agency_code,
    (
      select coalesce(array_agg(e.value), '{}'::text[])
      from jsonb_array_elements_text(
        coalesce(o.custom_fields #> '{grants_gov,eligible_applicants}', '[]'::jsonb)
      ) as e
    ) as eligible_applicants,
    (
      select coalesce(array_agg(c.value), '{}'::text[])
      from jsonb_array_elements_text(
        coalesce(o.custom_fields #> '{grants_gov,funding_categories}', '[]'::jsonb)
      ) as c
    ) as funding_categories,
    count(*) over () as total_count
  from public.opportunities o, q
  where (p_source_system is null or o.source_system = p_source_system)
    and (
      q.query is null
      or o.search @@ q.query
      or o.opportunity_number ilike '%' || btrim(p_keyword) || '%'
    )
    and (p_statuses is null or o.status = any (p_statuses))
    and (
      p_eligibilities is null
      or coalesce(o.custom_fields #> '{grants_gov,eligible_applicants}', '[]'::jsonb) ?| p_eligibilities
    )
    and (
      p_agency is null
      or o.custom_fields #>> '{grants_gov,agency_code}' = p_agency
      or o.custom_fields #>> '{grants_gov,agency_code}' like p_agency || '-%'
    )
    and (
      p_categories is null
      or coalesce(o.custom_fields #> '{grants_gov,funding_categories}', '[]'::jsonb) ?| p_categories
    )
    and (p_close_from is null or o.close_date >= p_close_from)
    and (p_close_to is null or o.close_date <= p_close_to)
    and (p_min_award_ceiling is null or o.max_award_amount >= p_min_award_ceiling)
  order by
    case when q.query is null then 0 else ts_rank(o.search, q.query) end desc,
    o.close_date asc nulls last,
    o.post_date desc nulls last,
    o.id
  limit greatest(least(coalesce(p_limit, 25), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.search_opportunities(
  text, public.opportunity_status[], text[], text, text[], date, date, numeric, text, integer, integer
) from public, anon;
grant execute on function public.search_opportunities(
  text, public.opportunity_status[], text[], text, text[], date, date, numeric, text, integer, integer
) to authenticated, service_role;

-- Row-level security ------------------------------------------------------------------------------

alter table public.grants_gov_agencies enable row level security;
alter table public.assistance_listings enable row level security;
alter table public.opportunity_details enable row level security;
alter table public.opportunity_sync_runs enable row level security;

-- Reference data and the run log: every signed-in person reads; nobody but server code writes.
create policy grants_gov_agencies_select on public.grants_gov_agencies
  for select to authenticated using (true);
create policy assistance_listings_select on public.assistance_listings
  for select to authenticated using (true);
-- Details follow their opportunity: visible when the opportunity is.
create policy opportunity_details_select on public.opportunity_details
  for select to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id));
create policy opportunity_sync_runs_select on public.opportunity_sync_runs
  for select to authenticated using (true);

revoke all on table public.grants_gov_agencies, public.assistance_listings,
  public.opportunity_details, public.opportunity_sync_runs
from anon, authenticated;
grant select on table public.grants_gov_agencies, public.assistance_listings,
  public.opportunity_details, public.opportunity_sync_runs
to authenticated;
grant all on table public.grants_gov_agencies, public.assistance_listings,
  public.opportunity_details, public.opportunity_sync_runs
to service_role;
