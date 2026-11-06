-- Local development seed: one demo organization with a little made-up data, clearly labelled.
-- Runs only on the local stack (`supabase db reset`). Never run it against the hosted project:
-- AGENTS.md honesty rule 4, "No demo data in production". `supabase db push` does not run seeds.
-- To see the demo organization in the app, sign in locally once, then run
-- `node scripts/db/join-demo-org.mjs <your email>`.

do $$
begin
  -- Refuse to seed a database that already holds real organizations.
  if exists (
    select 1 from public.organizations where id <> '00000000-0000-4000-8000-00000000d001'
  ) then
    raise exception 'seed.sql is for an empty local database only';
  end if;
end;
$$;

insert into public.organizations (id, name, mission)
values (
  '00000000-0000-4000-8000-00000000d001',
  'Demo Organization (local only)',
  'Made-up organization for local development. Not a real nonprofit.'
);

insert into public.funders (id, organization_id, name, kind)
values (
  '00000000-0000-4000-8000-00000000d101',
  '00000000-0000-4000-8000-00000000d001',
  'Demo Foundation (made up)',
  'foundation'
);

-- Funding amounts are left empty on purpose: unknown reads "Not stated", never $0.
insert into public.opportunities (id, organization_id, title, status, funder_name, close_date)
values (
  '00000000-0000-4000-8000-00000000d201',
  '00000000-0000-4000-8000-00000000d001',
  'Demo opportunity (made up)',
  'open',
  'Demo Foundation (made up)',
  current_date + 45
);

insert into public.grants (id, organization_id, funder_id, opportunity_id, title, stage, amount_requested)
values (
  '00000000-0000-4000-8000-00000000d301',
  '00000000-0000-4000-8000-00000000d001',
  '00000000-0000-4000-8000-00000000d101',
  '00000000-0000-4000-8000-00000000d201',
  'Demo grant application',
  'application',
  25000
);

insert into public.deadlines (organization_id, grant_id, title, kind, due_at, time_zone)
values (
  '00000000-0000-4000-8000-00000000d001',
  '00000000-0000-4000-8000-00000000d301',
  'Demo application due',
  'application',
  ((current_date + 45) + time '14:00') at time zone 'America/New_York',
  'America/New_York'
);

insert into public.tasks (organization_id, grant_id, title, due_date)
values (
  '00000000-0000-4000-8000-00000000d001',
  '00000000-0000-4000-8000-00000000d301',
  'Draft the project narrative',
  current_date + 30
);

insert into public.boilerplate (organization_id, title, body, category)
values (
  '00000000-0000-4000-8000-00000000d001',
  'Mission statement',
  'Made-up mission statement for local development.',
  'organization'
);

insert into public.notes (organization_id, grant_id, body)
values (
  '00000000-0000-4000-8000-00000000d001',
  '00000000-0000-4000-8000-00000000d301',
  'Demo note: everything in this organization is made up.'
);
