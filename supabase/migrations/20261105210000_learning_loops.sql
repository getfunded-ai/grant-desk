-- Phase AA: learning loops. The organization's kind, what it knows (with sources), who it talks to,
-- each touch, and the learning sessions that carry lessons from one round of work to the next.
--
-- Every table is a tenant table: organization_id, row-level security through the Phase B helpers,
-- nothing for anon. Child rows point at their parent through (organization_id, id), so a lesson or
-- a touch can never be attached to another organization's session or contact. Append-only tables
-- (facts, touches, lessons, session links) take id and created_at from the database, never from the
-- caller, and the people role gets no update or delete on them. A fact is superseded, never deleted.

-- Enums -----------------------------------------------------------------------------------------

create type public.organization_kind as enum ('seeker', 'funder', 'company');

create type public.knowledge_subject_kind as enum (
  'organization', 'funder', 'opportunity', 'contact', 'grant'
);
create type public.knowledge_source_kind as enum ('filing', 'website', 'document', 'person', 'ai');
create type public.knowledge_confidence as enum ('stated', 'likely', 'guess');
create type public.knowledge_status as enum ('proposed', 'confirmed', 'superseded');

create type public.contact_publishability as enum ('private', 'public');
create type public.touch_kind as enum ('email', 'call', 'meeting', 'letter', 'note');
create type public.touch_direction as enum ('out', 'in');

-- The six playbooks in docs/learning-session-format.md, section 3.
create type public.playbook_key as enum (
  'seeker-prospecting', 'seeker-outreach', 'application-prep', 'post-award-reporting',
  'funder-grantee-outreach', 'company-nondilutive'
);
create type public.learning_session_status as enum ('open', 'closed');
create type public.lesson_applies_to as enum (
  'prospecting', 'outreach', 'application', 'post_award', 'general'
);

-- The organization's kind ------------------------------------------------------------------------

alter table public.organizations
  add column kind public.organization_kind not null default 'seeker';

comment on column public.organizations.kind is
  'seeker (a nonprofit that seeks grants), funder (gives them) or company (seeks non-dilutive funding).';

-- Admins already update the organization; the kind joins the columns they may change.
grant update (kind) on table public.organizations to authenticated;

-- Knowledge facts (append-only; supersede, never delete) --------------------------------------------

create table public.knowledge_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subject_kind public.knowledge_subject_kind not null,
  -- The row the fact is about, in the table subject_kind names. Null when not tied to a record.
  subject_id uuid,
  fact text not null check (length(btrim(fact)) between 1 and 4000),
  source_kind public.knowledge_source_kind not null,
  source_ref text not null check (length(btrim(source_ref)) between 1 and 2000),
  confidence public.knowledge_confidence not null default 'likely',
  status public.knowledge_status not null default 'proposed',
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  superseded_by uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, superseded_by) references public.knowledge_facts (organization_id, id),
  constraint knowledge_facts_confirmed check (status = 'proposed' or confirmed_at is not null),
  constraint knowledge_facts_superseded check ((status = 'superseded') = (superseded_by is not null)),
  constraint knowledge_facts_not_self check (superseded_by is null or superseded_by <> id)
);

comment on table public.knowledge_facts is
  'What the organization knows, each fact with its source. Confirmed by a person; superseded by a newer fact, never deleted.';

create index knowledge_facts_organization_status
  on public.knowledge_facts (organization_id, status, created_at desc);
create index knowledge_facts_subject on public.knowledge_facts (subject_kind, subject_id);

-- The subject must be a record of the same organization (or, for opportunities, the shared catalog).
create function private.check_knowledge_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if new.subject_id is null then
    return new;
  end if;
  case new.subject_kind
    when 'organization' then v_ok := new.subject_id = new.organization_id;
    when 'funder' then
      v_ok := exists (select 1 from public.funders f
        where f.id = new.subject_id and f.organization_id = new.organization_id);
    when 'opportunity' then
      v_ok := exists (select 1 from public.opportunities o
        where o.id = new.subject_id
          and (o.organization_id is null or o.organization_id = new.organization_id));
    when 'contact' then
      v_ok := exists (select 1 from public.contacts c
        where c.id = new.subject_id and c.organization_id = new.organization_id);
    when 'grant' then
      v_ok := exists (select 1 from public.grants g
        where g.id = new.subject_id and g.organization_id = new.organization_id);
  end case;
  if not coalesce(v_ok, false) then
    raise exception 'the subject of a fact must belong to the same organization' using errcode = '23503';
  end if;
  return new;
end;
$$;

-- A fact's content never changes. It moves forward only: proposed -> confirmed -> superseded, and
-- the stamps (who confirmed, when, which fact replaced it) are set here, not by the caller.
create function private.guard_knowledge_fact()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'superseded' then
      raise exception 'a fact cannot start as superseded' using errcode = '23514';
    end if;
    new.superseded_by := null;
    if new.status = 'confirmed' then
      new.confirmed_by := (select auth.uid());
      new.confirmed_at := now();
    else
      new.confirmed_by := null;
      new.confirmed_at := null;
    end if;
    return new;
  end if;

  -- A foreign key clearing a deleted person's id (one trigger level deeper) is the only other change.
  if pg_trigger_depth() > 1
     and (to_jsonb(new) - '{created_by,confirmed_by}'::text[]) = (to_jsonb(old) - '{created_by,confirmed_by}'::text[])
     and (new.created_by is null or new.created_by = old.created_by)
     and (new.confirmed_by is null or new.confirmed_by = old.confirmed_by) then
    return new;
  end if;

  if (to_jsonb(new) - '{status,confirmed_by,confirmed_at,superseded_by}'::text[])
     is distinct from (to_jsonb(old) - '{status,confirmed_by,confirmed_at,superseded_by}'::text[]) then
    raise exception 'only the status of a fact can change' using errcode = '42501';
  end if;
  if old.status = 'proposed' and new.status = 'confirmed' then
    new.confirmed_by := (select auth.uid());
    new.confirmed_at := now();
    new.superseded_by := null;
    return new;
  end if;
  if old.status = 'confirmed' and new.status = 'superseded' then
    if new.superseded_by is null then
      raise exception 'a superseded fact names the fact that replaced it' using errcode = '23514';
    end if;
    new.confirmed_by := old.confirmed_by;
    new.confirmed_at := old.confirmed_at;
    return new;
  end if;
  raise exception 'a fact moves only from proposed to confirmed to superseded' using errcode = '23514';
end;
$$;

-- Contacts ----------------------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  funder_id uuid,
  name text not null check (length(btrim(name)) between 1 and 300),
  role text check (role is null or length(role) <= 300),
  -- Private details. Never exported in a packet.
  email text check (email is null or length(email) <= 320),
  phone text check (phone is null or length(phone) <= 50),
  publishability public.contact_publishability not null default 'private',
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, funder_id) references public.funders (organization_id, id) on delete set null (funder_id)
);

create index contacts_organization on public.contacts (organization_id, name);
create index contacts_funder on public.contacts (funder_id);

-- Learning sessions ---------------------------------------------------------------------------------

create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- 1, 2, 3… per organization, set by the trigger below, never by the caller.
  number integer not null check (number >= 1),
  playbook_key public.playbook_key not null,
  goal text not null check (length(btrim(goal)) between 1 and 2000),
  status public.learning_session_status not null default 'open',
  opened_by uuid default auth.uid() references auth.users (id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  -- The packet, frozen when the session opens (docs/learning-session-format.md, section 1). Its
  -- "session" block is stamped by the trigger below from this row's own id and number.
  packet jsonb not null check (jsonb_typeof(packet) = 'object'),
  lessons_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, number),
  constraint learning_sessions_closed check ((status = 'closed') = (closed_at is not null))
);

comment on table public.learning_sessions is
  'One round of work for one organization. Opens with a frozen packet; closes with at least one lesson.';

create index learning_sessions_organization on public.learning_sessions (organization_id, number desc);

-- The next number for the organization, taken under a lock on the organization row so two people
-- who start a session at the same moment get consecutive numbers. The packet's "session" block is
-- written here too, so the frozen packet names the session it belongs to.
create function private.number_learning_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.organizations o where o.id = new.organization_id for no key update;
  select coalesce(max(s.number), 0) + 1 into new.number
  from public.learning_sessions s
  where s.organization_id = new.organization_id;
  new.status := 'open';
  new.closed_at := null;
  new.packet := new.packet || jsonb_build_object(
    'session', jsonb_build_object(
      'id', new.id,
      'number', new.number,
      'playbook', new.playbook_key,
      'goal', new.goal,
      'opened_at', to_char(new.opened_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );
  return new;
end;
$$;

-- A session closes once, with at least one lesson, and its packet, goal and number never change.
create function private.guard_learning_session()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1
     and (to_jsonb(new) - 'opened_by') = (to_jsonb(old) - 'opened_by')
     and (new.opened_by is null or new.opened_by = old.opened_by) then
    return new;
  end if;
  if (to_jsonb(new) - '{status,closed_at,lessons_summary,updated_at}'::text[])
     is distinct from (to_jsonb(old) - '{status,closed_at,lessons_summary,updated_at}'::text[]) then
    raise exception 'only the status and the lessons summary of a session can change' using errcode = '42501';
  end if;
  if old.status = 'closed' then
    if new.status <> 'closed' or new.lessons_summary is distinct from old.lessons_summary then
      raise exception 'this session is closed' using errcode = '23514';
    end if;
    new.closed_at := old.closed_at;
    return new;
  end if;
  if new.status = 'closed' then
    if not exists (select 1 from public.session_lessons l where l.session_id = new.id) then
      raise exception 'a session closes with at least one lesson' using errcode = '23514';
    end if;
    new.closed_at := now();
  else
    new.closed_at := null;
  end if;
  return new;
end;
$$;

-- Touches (append-only log of contact with people) ---------------------------------------------------

create table public.touches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid not null,
  grant_id uuid,
  session_id uuid,
  kind public.touch_kind not null,
  direction public.touch_direction not null,
  happened_at timestamptz not null default now(),
  summary text not null check (length(btrim(summary)) between 1 and 4000),
  logged_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- A touch is the record of who was spoken to; removing a contact does not erase it. (No action:
  -- deleting the whole organization still cascades here through organization_id.)
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete no action,
  foreign key (organization_id, grant_id) references public.grants (organization_id, id) on delete cascade,
  foreign key (organization_id, session_id) references public.learning_sessions (organization_id, id)
    on delete set null (session_id)
);

comment on table public.touches is
  'A person logs each email, call, meeting, letter or note by hand. The app never sends anything.';

create index touches_organization_happened on public.touches (organization_id, happened_at desc);
create index touches_contact on public.touches (contact_id, happened_at desc);
create index touches_grant on public.touches (grant_id);

-- Session lessons (append-only) ------------------------------------------------------------------------

create table public.session_lessons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  session_id uuid not null,
  applies_to public.lesson_applies_to not null default 'general',
  lesson text not null check (length(btrim(lesson)) between 1 and 4000),
  evidence text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, session_id) references public.learning_sessions (organization_id, id) on delete cascade
);

create index session_lessons_session on public.session_lessons (session_id, created_at);
create index session_lessons_organization on public.session_lessons (organization_id, created_at desc);

-- Session to proposal links (append-only) ----------------------------------------------------------------

-- So a link can point at a proposal through (organization_id, id), like every other child row.
alter table public.proposals add constraint proposals_organization_id_id_key unique (organization_id, id);

create table public.session_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  session_id uuid not null,
  proposal_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, session_id) references public.learning_sessions (organization_id, id) on delete cascade,
  foreign key (organization_id, proposal_id) references public.proposals (organization_id, id) on delete cascade,
  unique (proposal_id)
);

create index session_proposals_session on public.session_proposals (session_id, created_at);

-- Lessons and proposals are added only while the session is open.
create function private.check_session_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.learning_sessions s
    where s.id = new.session_id and s.organization_id = new.organization_id and s.status = 'open'
  ) then
    raise exception 'this session is closed' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Accepting a proposal from a learning session ------------------------------------------------------------
--
-- One transaction: the record is written and the proposal is marked accepted, or neither happens.
-- It runs as the caller (security invoker), so row-level security and the proposals guard apply to
-- every write. The caller resolves names to ids first and passes the record to write; the function
-- only checks that the record matches the proposal's kind. A stage move is never accepted here: that
-- happens on the grant record page (Phase E), where the person sees the grant.

create function private.resolve_funder(p_organization_id uuid, p_ref jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_ein text := nullif(regexp_replace(coalesce(p_ref ->> 'ein', ''), '[^0-9]', '', 'g'), '');
  v_name text := nullif(btrim(coalesce(p_ref ->> 'name', '')), '');
  v_id uuid;
begin
  if (p_ref ->> 'id') is not null then
    select f.id into v_id from public.funders f
    where f.id = (p_ref ->> 'id')::uuid and f.organization_id = p_organization_id;
    if v_id is not null then return v_id; end if;
  end if;
  if v_ein is not null then
    select f.id into v_id from public.funders f
    where f.organization_id = p_organization_id
      and regexp_replace(coalesce(f.ein, ''), '[^0-9]', '', 'g') = v_ein
    order by f.created_at limit 1;
    if v_id is not null then return v_id; end if;
  end if;
  if v_name is null then
    return null;
  end if;
  select f.id into v_id from public.funders f
  where f.organization_id = p_organization_id and lower(f.name) = lower(v_name)
  order by f.created_at limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.funders (organization_id, name, ein)
  values (p_organization_id, left(v_name, 300), case when v_ein ~ '^[0-9]{9}$' then v_ein end)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.accept_learning_proposal(p_proposal_id uuid, p_record jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_proposal public.proposals%rowtype;
  v_kind text;
  v_session uuid;
  v_record_id uuid;
begin
  select * into v_proposal from public.proposals p where p.id = p_proposal_id for no key update;
  if not found then
    raise exception 'proposal not found' using errcode = '42501';
  end if;
  if v_proposal.status <> 'proposed' then
    raise exception 'this proposal was already decided' using errcode = '23514';
  end if;
  select sp.session_id into v_session from public.session_proposals sp where sp.proposal_id = p_proposal_id;
  if v_session is null then
    raise exception 'this proposal did not come from a learning session' using errcode = '23514';
  end if;
  v_kind := v_proposal.payload ->> 'kind';
  if v_kind is distinct from (p_record ->> 'kind') then
    raise exception 'the record does not match the proposal' using errcode = '23514';
  end if;

  case v_kind
    when 'knowledge_fact' then
      insert into public.knowledge_facts
        (organization_id, subject_kind, subject_id, fact, source_kind, source_ref, confidence, status)
      values (
        v_proposal.organization_id,
        (p_record ->> 'subject_kind')::public.knowledge_subject_kind,
        case
          when p_record ->> 'subject_kind' = 'funder' and p_record ? 'funder_ref'
            then private.resolve_funder(v_proposal.organization_id, p_record -> 'funder_ref')
          when p_record ->> 'subject_kind' = 'organization' then v_proposal.organization_id
          else (p_record ->> 'subject_id')::uuid
        end,
        p_record ->> 'fact',
        (p_record ->> 'source_kind')::public.knowledge_source_kind,
        p_record ->> 'source_ref',
        coalesce((p_record ->> 'confidence')::public.knowledge_confidence, 'likely'),
        'confirmed'
      )
      returning id into v_record_id;
    when 'contact' then
      insert into public.contacts (organization_id, funder_id, name, role, publishability, notes)
      values (
        v_proposal.organization_id,
        case when p_record ? 'funder_ref'
          then private.resolve_funder(v_proposal.organization_id, p_record -> 'funder_ref') end,
        p_record ->> 'name',
        p_record ->> 'role',
        coalesce((p_record ->> 'publishability')::public.contact_publishability, 'private'),
        p_record ->> 'notes'
      )
      returning id into v_record_id;
    when 'task', 'outreach_draft' then
      insert into public.tasks (organization_id, grant_id, title, description, due_date)
      values (
        v_proposal.organization_id,
        v_proposal.grant_id,
        p_record ->> 'title',
        p_record ->> 'description',
        (p_record ->> 'due_date')::date
      )
      returning id into v_record_id;
    when 'lesson' then
      insert into public.session_lessons (organization_id, session_id, applies_to, lesson, evidence)
      values (
        v_proposal.organization_id,
        v_session,
        coalesce((p_record ->> 'applies_to')::public.lesson_applies_to, 'general'),
        p_record ->> 'lesson',
        p_record ->> 'evidence'
      )
      returning id into v_record_id;
    when 'stage_move' then
      raise exception 'a stage move is accepted on the grant record page' using errcode = '23514';
    else
      raise exception 'unknown proposal kind' using errcode = '23514';
  end case;

  update public.proposals set status = 'accepted' where id = p_proposal_id;
  return v_record_id;
end;
$$;

-- Replacing a fact: the new fact is written confirmed and the old one is marked superseded by it,
-- in one transaction, as the caller. The old fact stays, with its source, for the record.
create function public.supersede_knowledge_fact(
  p_old_id uuid,
  p_fact text,
  p_source_kind public.knowledge_source_kind,
  p_source_ref text,
  p_confidence public.knowledge_confidence
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_old public.knowledge_facts%rowtype;
  v_new uuid;
begin
  select * into v_old from public.knowledge_facts f where f.id = p_old_id for no key update;
  if not found then
    raise exception 'fact not found' using errcode = '42501';
  end if;
  if v_old.status <> 'confirmed' then
    raise exception 'only a confirmed fact can be superseded' using errcode = '23514';
  end if;
  insert into public.knowledge_facts
    (organization_id, subject_kind, subject_id, fact, source_kind, source_ref, confidence, status)
  values (v_old.organization_id, v_old.subject_kind, v_old.subject_id, p_fact, p_source_kind,
    p_source_ref, p_confidence, 'confirmed')
  returning id into v_new;
  update public.knowledge_facts set status = 'superseded', superseded_by = v_new where id = p_old_id;
  return v_new;
end;
$$;

-- Importing a results file: every item becomes one proposal linked to the session, all in one
-- transaction, as the caller. Each element of p_items carries tool_name, summary, payload, model,
-- sources and grant_id (null or a grant of the organization). Returns the proposal ids in order.
create function public.record_learning_proposals(p_session_id uuid, p_items jsonb)
returns setof uuid
language plpgsql
set search_path = ''
as $$
declare
  v_session public.learning_sessions%rowtype;
  v_item jsonb;
  v_id uuid;
begin
  select * into v_session from public.learning_sessions s where s.id = p_session_id;
  if not found then
    raise exception 'session not found' using errcode = '42501';
  end if;
  if v_session.status <> 'open' then
    raise exception 'this session is closed' using errcode = '23514';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be a list' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.proposals (organization_id, grant_id, tool_name, summary, payload, model, sources)
    values (
      v_session.organization_id,
      (v_item ->> 'grant_id')::uuid,
      v_item ->> 'tool_name',
      v_item ->> 'summary',
      coalesce(v_item -> 'payload', '{}'::jsonb),
      v_item ->> 'model',
      coalesce(v_item -> 'sources', '[]'::jsonb)
    )
    returning id into v_id;
    insert into public.session_proposals (organization_id, session_id, proposal_id)
    values (v_session.organization_id, p_session_id, v_id);
    return next v_id;
  end loop;
  return;
end;
$$;

revoke all on function public.accept_learning_proposal(uuid, jsonb) from public, anon;
grant execute on function public.accept_learning_proposal(uuid, jsonb) to authenticated, service_role;
revoke all on function public.record_learning_proposals(uuid, jsonb) from public, anon;
grant execute on function public.record_learning_proposals(uuid, jsonb) to authenticated, service_role;
revoke all on function public.supersede_knowledge_fact(uuid, text, public.knowledge_source_kind, text,
  public.knowledge_confidence) from public, anon;
grant execute on function public.supersede_knowledge_fact(uuid, text, public.knowledge_source_kind, text,
  public.knowledge_confidence) to authenticated, service_role;
revoke all on function private.resolve_funder(uuid, jsonb) from public, anon;
grant execute on function private.resolve_funder(uuid, jsonb) to authenticated, service_role;

-- Triggers ----------------------------------------------------------------------------------------

create trigger knowledge_facts_check_subject before insert on public.knowledge_facts
  for each row execute function private.check_knowledge_subject();
create trigger knowledge_facts_guard before insert or update on public.knowledge_facts
  for each row execute function private.guard_knowledge_fact();
create trigger knowledge_facts_keep_owner_columns before update on public.knowledge_facts
  for each row execute function private.keep_owner_columns();

create trigger contacts_updated_at before update on public.contacts
  for each row execute function private.set_updated_at();
create trigger contacts_keep_owner_columns before update on public.contacts
  for each row execute function private.keep_owner_columns();

create trigger learning_sessions_number before insert on public.learning_sessions
  for each row execute function private.number_learning_session();
create trigger learning_sessions_guard before update on public.learning_sessions
  for each row execute function private.guard_learning_session();
create trigger learning_sessions_updated_at before update on public.learning_sessions
  for each row execute function private.set_updated_at();
create trigger learning_sessions_keep_owner_columns before update on public.learning_sessions
  for each row execute function private.keep_owner_columns();

create trigger session_lessons_check_open before insert on public.session_lessons
  for each row execute function private.check_session_open();
create trigger session_proposals_check_open before insert on public.session_proposals
  for each row execute function private.check_session_open();

revoke all on function private.check_knowledge_subject(), private.guard_knowledge_fact(),
  private.number_learning_session(), private.guard_learning_session(), private.check_session_open()
from public, anon, authenticated;

-- Row-level security ------------------------------------------------------------------------------

alter table public.knowledge_facts enable row level security;
alter table public.contacts enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.touches enable row level security;
alter table public.session_lessons enable row level security;
alter table public.session_proposals enable row level security;

-- Facts: members read; editors add and move the status forward; nobody deletes.
create policy knowledge_facts_select on public.knowledge_facts
  for select to authenticated using (private.is_member(organization_id));
create policy knowledge_facts_insert on public.knowledge_facts
  for insert to authenticated
  with check (private.can_edit(organization_id) and created_by = (select auth.uid()));
create policy knowledge_facts_update on public.knowledge_facts
  for update to authenticated
  using (private.can_edit(organization_id)) with check (private.can_edit(organization_id));

-- Contacts: members read; editors write and remove.
create policy contacts_select on public.contacts
  for select to authenticated using (private.is_member(organization_id));
create policy contacts_insert on public.contacts
  for insert to authenticated
  with check (private.can_edit(organization_id) and created_by = (select auth.uid()));
create policy contacts_update on public.contacts
  for update to authenticated
  using (private.can_edit(organization_id)) with check (private.can_edit(organization_id));
create policy contacts_delete on public.contacts
  for delete to authenticated using (private.can_edit(organization_id));

-- Sessions: members read; editors open and close; nobody deletes.
create policy learning_sessions_select on public.learning_sessions
  for select to authenticated using (private.is_member(organization_id));
create policy learning_sessions_insert on public.learning_sessions
  for insert to authenticated
  with check (private.can_edit(organization_id) and opened_by = (select auth.uid()));
create policy learning_sessions_update on public.learning_sessions
  for update to authenticated
  using (private.can_edit(organization_id)) with check (private.can_edit(organization_id));

-- Touches: members read; editors log in their own name; nobody edits or deletes.
create policy touches_select on public.touches
  for select to authenticated using (private.is_member(organization_id));
create policy touches_insert on public.touches
  for insert to authenticated
  with check (private.can_edit(organization_id) and logged_by = (select auth.uid()));

-- Lessons: members read; editors add in their own name; nobody edits or deletes.
create policy session_lessons_select on public.session_lessons
  for select to authenticated using (private.is_member(organization_id));
create policy session_lessons_insert on public.session_lessons
  for insert to authenticated
  with check (private.can_edit(organization_id) and created_by = (select auth.uid()));

-- Session links: members read; editors add; nobody edits or deletes.
create policy session_proposals_select on public.session_proposals
  for select to authenticated using (private.is_member(organization_id));
create policy session_proposals_insert on public.session_proposals
  for insert to authenticated with check (private.can_edit(organization_id));

-- Table privileges ----------------------------------------------------------------------------------

revoke all on table public.knowledge_facts, public.contacts, public.learning_sessions,
  public.touches, public.session_lessons, public.session_proposals
from anon, authenticated;

grant select on table public.knowledge_facts to authenticated;
grant insert (organization_id, subject_kind, subject_id, fact, source_kind, source_ref, confidence,
  status, created_by)
  on table public.knowledge_facts to authenticated;
grant update (status, superseded_by) on table public.knowledge_facts to authenticated;

grant select, insert, update, delete on table public.contacts to authenticated;

grant select on table public.learning_sessions to authenticated;
grant insert (organization_id, playbook_key, goal, packet, opened_by)
  on table public.learning_sessions to authenticated;
grant update (status, lessons_summary) on table public.learning_sessions to authenticated;

grant select on table public.touches to authenticated;
grant insert (organization_id, contact_id, grant_id, session_id, kind, direction, happened_at,
  summary, logged_by)
  on table public.touches to authenticated;

grant select on table public.session_lessons to authenticated;
grant insert (organization_id, session_id, applies_to, lesson, evidence, created_by)
  on table public.session_lessons to authenticated;

grant select on table public.session_proposals to authenticated;
grant insert (organization_id, session_id, proposal_id) on table public.session_proposals to authenticated;

grant all on table public.knowledge_facts, public.contacts, public.learning_sessions,
  public.touches, public.session_lessons, public.session_proposals
to service_role;
