-- =====================================================================
-- ISOMO / IJWI — Seeding add-on. Run AFTER 01_schema + 02_auth.
-- Lets the facilitator pre-create students so the dashboard isn't empty
-- on Day 1. When the matching kid signs in with Google, the trigger
-- merges the pending row (display_name, cohort) into the real students
-- row keyed by their auth UID and deletes the pending one.
-- =====================================================================

create table if not exists pending_students (
  id           bigint generated always as identity primary key,
  email        text not null,
  display_name text,
  cohort       text not null default 'base' check (cohort in ('base','foundation')),
  added_at     timestamptz not null default now(),
  unique (lower(email))
);

-- Replace the auth trigger to look up by email first.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  p pending_students%rowtype;
begin
  select * into p
  from pending_students
  where lower(email) = lower(new.email)
  limit 1;

  insert into public.students (student_id, display_name, role, cohort)
  values (
    new.id::text,
    coalesce(p.display_name, new.raw_user_meta_data->>'full_name', new.email),
    'student',
    coalesce(p.cohort, 'base')
  )
  on conflict (student_id) do nothing;

  if p.id is not null then
    delete from pending_students where id = p.id;
  end if;

  return new;
end;
$$;

-- RLS: facilitators read/write pending; nobody else.
alter table pending_students enable row level security;

drop policy if exists "facilitator manage pending" on pending_students;
create policy "facilitator manage pending" on pending_students
  for all using (is_facilitator()) with check (is_facilitator());

-- =====================================================================
-- AUTO-RUBRIC — Claude-scored CEFR estimate per session
-- =====================================================================
create table if not exists auto_rubric_scores (
  id                bigint generated always as identity primary key,
  session_id        bigint not null references sessions(id) on delete cascade,
  student_id        text   not null references students(student_id) on delete cascade,
  cefr              text,
  overall           numeric,
  range_score       numeric,
  accuracy_score    numeric,
  fluency_score     numeric,
  interaction_score numeric,
  coherence_score   numeric,
  rationale         text,
  model             text,
  scored_at         timestamptz not null default now(),
  unique (session_id)
);

alter table auto_rubric_scores enable row level security;

drop policy if exists "read own or facilitator (auto rubric)" on auto_rubric_scores;
create policy "read own or facilitator (auto rubric)" on auto_rubric_scores
  for select using (student_id = auth.uid()::text or is_facilitator());
-- Service-role bypasses RLS, so the API route (using service key) can write.

-- Unified roster view: signed-in students + still-pending invites.
create or replace view v_roster as
select
  s.student_id                          as id,
  s.display_name,
  s.cohort,
  'signed_in'::text                     as state,
  null::text                            as email,
  null::timestamptz                     as added_at
from students s
where s.role = 'student'
union all
select
  ('pending:' || p.id::text)            as id,
  p.display_name,
  p.cohort,
  'pending'::text                       as state,
  p.email,
  p.added_at
from pending_students p;
