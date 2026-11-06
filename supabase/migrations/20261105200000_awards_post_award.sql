-- Phase G, migration 1: what happens after a grant is won. Award terms, the report schedule, budget
-- versus actual, reimbursements and the compliance checklist, with close-out.
--
-- The amount awarded and the period of performance already live on grants (amount_awarded,
-- award_start_date, award_end_date, Phase B); this migration does not duplicate them. An award row
-- adds the rest of the terms. Every table here is a tenant table: organization_id, row-level
-- security through the Phase B helpers, nothing for anon. Child rows reference their parent through
-- (organization_id, id), so a row in one organization can never hang off a parent in another.
--
-- Each report due gets one row in deadlines (Phase B) so it shows on the calendar (Phase E). The
-- link is award_reports.deadline_id, kept in step by a trigger, which is what lets the schedule be
-- regenerated without duplicate calendar entries.
--
-- Federal rules in this phase are from 2 CFR 200 (Uniform Guidance, 2024 revision) and are encoded
-- in lib/compliance with their sections. Nothing in the database assumes an award is federal.

-- Enums -----------------------------------------------------------------------------------------

create type public.award_payment_method as enum ('reimbursement', 'advance', 'lump_sum', 'other');

-- 2 CFR 200.414: a negotiated indirect cost rate agreement (NICRA), or the de minimis rate
-- (200.414(f), 15 percent of modified total direct costs), or no indirect costs charged.
create type public.indirect_cost_method as enum ('de_minimis', 'negotiated_rate', 'none', 'other');

create type public.report_frequency as enum ('quarterly', 'semiannual', 'annual', 'none');

-- financial = SF-425 Federal Financial Report (2 CFR 200.328); performance = performance report
-- (200.329). The final pair is due after the period of performance ends (200.344). Non-federal
-- awards use the same kinds with the funder's own report in place of the federal forms.
create type public.award_report_kind as enum (
  'financial', 'performance', 'final_financial', 'final_performance', 'other'
);

create type public.award_report_status as enum ('due', 'submitted', 'accepted');

-- Awards (one per grant) ------------------------------------------------------------------------

create table public.awards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  grant_id uuid not null,
  is_federal boolean not null default false,
  -- The funder's identifier for the award (for federal awards the FAIN, 2 CFR 200.1).
  award_number text check (award_number is null or length(award_number) <= 100),
  payment_method public.award_payment_method,
  indirect_method public.indirect_cost_method,
  -- Percent, for a negotiated rate. Null = not stated. The de minimis rate is a rule, not a column.
  indirect_rate numeric(6, 3) check (indirect_rate >= 0 and indirect_rate <= 100),
  report_frequency public.report_frequency not null default 'quarterly',
  -- Non-federal awards only: days after each period, and after the end date, that a report is due.
  -- Federal awards take these from 2 CFR 200 (lib/compliance/rules.ts).
  report_lag_days integer not null default 30 check (report_lag_days between 0 and 365),
  final_report_lag_days integer not null default 60
    check (final_report_lag_days between 0 and 365),
  notes text,
  -- Close-out (2 CFR 200.344). Set once by a person; records_retention_until is three years after
  -- the final financial report was submitted (200.334), or null when that date is not known.
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  records_retention_until date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (grant_id),
  foreign key (organization_id, grant_id) references public.grants (organization_id, id) on delete cascade,
  constraint awards_rate_needs_method check (
    indirect_rate is null or indirect_method in ('negotiated_rate', 'other')
  )
);

comment on table public.awards is
  'Post-award terms for one grant. Amount and period of performance stay on grants.';

create index awards_organization on public.awards (organization_id);

-- Reports due -------------------------------------------------------------------------------------

-- Phase B gave funders, grants and external_feeds a (organization_id, id) key so child rows can
-- reference them inside one organization. deadlines gets the same key here, for the same reason.
alter table public.deadlines add constraint deadlines_organization_id_id_key unique (organization_id, id);

create table public.award_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  award_id uuid not null,
  -- The calendar entry for this report. Written by the trigger below, never by the caller.
  deadline_id uuid,
  kind public.award_report_kind not null default 'other',
  title text not null check (length(btrim(title)) between 1 and 500),
  period_start date,
  period_end date,
  due_date date not null,
  -- True when the schedule generator wrote the row. Regeneration replaces generated rows that are
  -- still due and leaves everything a person typed or submitted alone.
  generated boolean not null default false,
  status public.award_report_status not null default 'due',
  submitted_on date,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, award_id) references public.awards (organization_id, id) on delete cascade,
  foreign key (organization_id, deadline_id) references public.deadlines (organization_id, id)
    on delete set null (deadline_id),
  constraint award_reports_period check (
    period_start is null or period_end is null or period_start <= period_end
  ),
  -- A report counts as submitted only with the date it was sent (honesty: no date, no claim).
  constraint award_reports_submitted_needs_date check (status = 'due' or submitted_on is not null)
);

comment on table public.award_reports is
  'One row per report due on an award. deadline_id links the calendar entry; the sync trigger keeps it.';

create index award_reports_award_due on public.award_reports (award_id, due_date);
create index award_reports_organization on public.award_reports (organization_id);
create index award_reports_deadline on public.award_reports (deadline_id);
-- The generator never writes the same report twice.
create unique index award_reports_generated_key
  on public.award_reports (award_id, kind, due_date) where generated;

-- Keep one deadlines row per report, so the calendar shows it and regeneration never duplicates it.
-- Runs as the function owner so the deadline is written even though the caller only has rights on
-- award_reports; row-level security on award_reports has already decided whether the caller may
-- write this report for this organization.
create function private.sync_report_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant uuid;
  -- Noon UTC with all_day set: the calendar day is the same in every time zone from UTC-12 to UTC+11.
  v_due timestamptz := (new.due_date::text || 'T12:00:00Z')::timestamptz;
begin
  if tg_op = 'DELETE' then
    if old.deadline_id is not null then
      delete from public.deadlines d
      where d.id = old.deadline_id and d.organization_id = old.organization_id;
    end if;
    return old;
  end if;

  if new.deadline_id is not null then
    update public.deadlines d
    set title = new.title, due_at = v_due, all_day = true, kind = 'report'
    where d.id = new.deadline_id and d.organization_id = new.organization_id;
    if found then
      return new;
    end if;
  end if;

  select a.grant_id into v_grant
  from public.awards a
  where a.id = new.award_id and a.organization_id = new.organization_id;

  insert into public.deadlines (organization_id, grant_id, title, kind, due_at, all_day, notes, created_by)
  values (
    new.organization_id, v_grant, new.title, 'report', v_due, true,
    'From the award report schedule. Edit the report on the award page.', new.created_by
  )
  returning id into new.deadline_id;
  return new;
end;
$$;

-- A delete happens after the row is gone, in the same transaction; an insert or a change of title
-- or due date runs before the row is written so deadline_id can be filled in.
create trigger award_reports_sync_deadline_insert before insert on public.award_reports
  for each row execute function private.sync_report_deadline();
create trigger award_reports_sync_deadline_update before update of title, due_date on public.award_reports
  for each row execute function private.sync_report_deadline();
create trigger award_reports_sync_deadline_delete after delete on public.award_reports
  for each row execute function private.sync_report_deadline();

-- Budget lines and actuals ------------------------------------------------------------------------

-- A budget line is one category of the approved budget. budgeted null = the amount is not known
-- ("Not available"), never 0.
create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  award_id uuid not null,
  category text not null check (length(btrim(category)) between 1 and 200),
  budgeted numeric(16, 2) check (budgeted >= 0),
  sort_order integer not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, award_id, id),
  foreign key (organization_id, award_id) references public.awards (organization_id, id) on delete cascade
);

create index budget_lines_organization on public.budget_lines (organization_id);
-- One line per category per award, however it is capitalised, so a CSV import maps to it.
create unique index budget_lines_award_category
  on public.budget_lines (award_id, lower(btrim(category)));

-- An actual is money spent against a line: typed in, or imported from a CSV export of the books.
-- A negative amount is a credit or refund.
create table public.budget_actuals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  award_id uuid not null,
  budget_line_id uuid not null,
  spent_on date not null,
  amount numeric(16, 2) not null,
  description text check (description is null or length(description) <= 1000),
  source text not null default 'manual' check (source in ('manual', 'csv')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, award_id) references public.awards (organization_id, id) on delete cascade,
  -- The line must belong to the same award, not just the same organization.
  foreign key (organization_id, award_id, budget_line_id)
    references public.budget_lines (organization_id, award_id, id) on delete cascade
);

create index budget_actuals_line on public.budget_actuals (budget_line_id, spent_on);
create index budget_actuals_award_spent on public.budget_actuals (award_id, spent_on);
create index budget_actuals_organization on public.budget_actuals (organization_id);

-- Reimbursements ------------------------------------------------------------------------------------

-- An invoice or drawdown request sent to the funder. Days outstanding are computed in the app
-- only from sent_on and paid_on, which a person typed.
create table public.reimbursements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  award_id uuid not null,
  invoice_number text check (invoice_number is null or length(invoice_number) <= 100),
  amount numeric(16, 2) check (amount >= 0),
  sent_on date,
  paid_on date,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, award_id) references public.awards (organization_id, id) on delete cascade,
  constraint reimbursements_paid_after_sent check (
    sent_on is null or paid_on is null or sent_on <= paid_on
  )
);

create index reimbursements_award on public.reimbursements (award_id, sent_on);
create index reimbursements_organization on public.reimbursements (organization_id);

-- Compliance checklist --------------------------------------------------------------------------------

-- The checklist for one award, copied from a template (lib/compliance/checklist.ts) when the award
-- is entered, plus any items a person adds. template_key is null for added items.
create table public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  award_id uuid not null,
  template_key text check (template_key is null or template_key ~ '^[a-z0-9_]{1,60}$'),
  title text not null check (length(btrim(title)) between 1 and 500),
  detail text,
  sort_order integer not null default 0,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (award_id, template_key),
  foreign key (organization_id, award_id) references public.awards (organization_id, id) on delete cascade
);

create index compliance_items_award on public.compliance_items (award_id, sort_order);
create index compliance_items_organization on public.compliance_items (organization_id);

-- Triggers -------------------------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['awards', 'award_reports', 'budget_lines', 'reimbursements', 'compliance_items']
  loop
    execute format(
      'create trigger %1$I before update on public.%2$I for each row execute function private.set_updated_at()',
      t || '_updated_at', t);
  end loop;
  foreach t in array array['awards', 'award_reports', 'budget_lines', 'budget_actuals', 'reimbursements',
    'compliance_items']
  loop
    execute format(
      'create trigger %1$I before update on public.%2$I for each row execute function private.keep_owner_columns()',
      t || '_keep_owner_columns', t);
  end loop;
end;
$$;

revoke all on function private.sync_report_deadline() from public, anon, authenticated;

-- Row-level security: members read; editors write; awards are deleted by admins (like grants) ------

alter table public.awards enable row level security;
alter table public.award_reports enable row level security;
alter table public.budget_lines enable row level security;
alter table public.budget_actuals enable row level security;
alter table public.reimbursements enable row level security;
alter table public.compliance_items enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['awards', 'award_reports', 'budget_lines', 'budget_actuals', 'reimbursements',
    'compliance_items']
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
         using (%3$s(organization_id))',
      t || '_delete', t, case when t = 'awards' then 'private.is_admin' else 'private.can_edit' end);
  end loop;
end;
$$;

-- Table privileges -----------------------------------------------------------------------------------

revoke all on table public.awards, public.award_reports, public.budget_lines, public.budget_actuals,
  public.reimbursements, public.compliance_items
from anon, authenticated;

grant select, insert, update, delete on table public.awards, public.award_reports,
  public.budget_lines, public.budget_actuals, public.reimbursements, public.compliance_items
to authenticated;

grant all on table public.awards, public.award_reports, public.budget_lines, public.budget_actuals,
  public.reimbursements, public.compliance_items
to service_role;
