-- =====================================================================
-- ISOMO / IJWI — Control features: audit log, suspend flag, pilot
-- calendar, usage log. Run AFTER 04_superadmin.sql.
-- =====================================================================

-- ---- AUDIT LOG --------------------------------------------------------
create table if not exists audit_log (
  id        bigint generated always as identity primary key,
  actor_id  text references students(student_id) on delete set null,
  action    text not null,
  target_id text,
  details   jsonb,
  at        timestamptz not null default now()
);
create index if not exists audit_log_at_idx on audit_log (at desc);

alter table audit_log enable row level security;
drop policy if exists "staff read audit" on audit_log;
create policy "staff read audit" on audit_log
  for select using (is_facilitator());

create or replace function public.log_audit(
  p_action text, p_target_id text default null, p_details jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor_id, action, target_id, details)
  values (auth.uid()::text, p_action, p_target_id, p_details);
end;
$$;
grant execute on function public.log_audit(text, text, jsonb) to authenticated;

-- ---- SUSPEND FLAG ----------------------------------------------------
alter table students
  add column if not exists suspended boolean not null default false;

-- ---- PILOT CALENDAR --------------------------------------------------
-- 24 ordered school days. Facilitator still clicks Activate each morning;
-- this just tells them which session #N is supposed to run on which date.
create table if not exists pilot_calendar (
  day_no       int primary key check (day_no between 1 and 24),
  planned_date date not null,
  session_no   int not null check (session_no between 1 and 24),
  skipped      boolean not null default false,
  notes        text
);

do $$
declare
  d date := current_date;
  i int := 1;
begin
  if not exists (select 1 from pilot_calendar) then
    while i <= 24 loop
      -- skip Sat (6) and Sun (0)
      while extract(dow from d) in (0, 6) loop
        d := d + 1;
      end loop;
      insert into pilot_calendar (day_no, planned_date, session_no)
      values (i, d, i);
      d := d + 1;
      i := i + 1;
    end loop;
  end if;
end $$;

alter table pilot_calendar enable row level security;
drop policy if exists "staff read calendar"   on pilot_calendar;
drop policy if exists "staff update calendar" on pilot_calendar;
create policy "staff read calendar" on pilot_calendar
  for select using (is_facilitator());
create policy "staff update calendar" on pilot_calendar
  for update using (is_facilitator()) with check (is_facilitator());

-- ---- USAGE LOG (cost meter) ------------------------------------------
create table if not exists usage_log (
  id       bigint generated always as identity primary key,
  source   text not null check (source in ('elevenlabs','anthropic','mem0')),
  units    numeric not null,
  cost_usd numeric,
  meta     jsonb,
  at       timestamptz not null default now()
);
create index if not exists usage_log_at_idx on usage_log (at desc);

alter table usage_log enable row level security;
drop policy if exists "staff read usage" on usage_log;
create policy "staff read usage" on usage_log
  for select using (is_facilitator());

-- ---- RESET STUDENT helper --------------------------------------------
-- Wipes data attached to a student for re-onboarding / QA cycles.
-- Triggered by /api/reset-student (which goes through service-role).
create or replace function public.reset_student(p_student_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.sessions               where student_id = p_student_id;
  delete from public.memory_snapshots       where student_id = p_student_id;
  delete from public.assessments            where student_id = p_student_id;
  delete from public.questionnaire_responses where student_id = p_student_id;
  delete from public.adoption_survey        where student_id = p_student_id;
  delete from public.auto_rubric_scores     where student_id = p_student_id;
  update public.students
    set consent_given = false, consented_at = null
    where student_id = p_student_id;
end;
$$;
-- Granted to service_role only (not public); the API route uses service-role.
revoke all on function public.reset_student(text) from public;
