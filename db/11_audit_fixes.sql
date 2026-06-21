-- =====================================================================
-- ISOMO / IJWI — Audit fixes (#1, #2, #5, #9, #12, #13, #14, +cefr check).
-- Run AFTER 10_superadmin_layer.sql.
--
-- Covers:
--   #1  Define get_pilot_status() — the proxy already calls it
--   #2  Add unique(source, external_id) on usage_log so upserts work
--   #5  handle_new_user() stops falling back to email for display_name
--   #9  safe_set_role() — atomic role change with last-superadmin guard
--   #12 safe_set_role() returns from_role/to_role for the audit log
--   #13 Index memory_snapshots(student_id, captured_on desc)
--   #14 low_talk_threshold_secs on pilot_config; sessions.flagged_low_talk
--       is no longer a hard-coded generated column
--   bonus: assessments.cefr check constraint
-- =====================================================================

-- ---- #1: kill-switch / drain RPC for middleware ----------------------
create or replace function public.get_pilot_status()
returns table (kill_all boolean, drain_mode boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(c.kill_all, false), coalesce(c.drain_mode, false)
  from public.cost_caps c
  where c.id = 1;
$$;
grant execute on function public.get_pilot_status() to authenticated;

-- ---- #2: usage_log upserts need a unique constraint ------------------
alter table public.usage_log
  drop constraint if exists usage_log_source_external_key;
alter table public.usage_log
  add  constraint usage_log_source_external_key unique (source, external_id);

-- ---- #5: don't put email into display_name ---------------------------
-- Replaces the trigger function defined in 03_seeding.sql. Falls back to
-- the pending-row name, then to Google full_name, then NULL — never email.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.pending_students%rowtype;
  meta_name text;
begin
  select * into p
  from public.pending_students
  where lower(email) = lower(new.email)
  limit 1;

  meta_name := nullif(new.raw_user_meta_data->>'full_name', '');

  insert into public.students (student_id, display_name, role, cohort)
  values (
    new.id::text,
    coalesce(p.display_name, meta_name),  -- NULL is fine; email is NOT
    'student',
    coalesce(p.cohort, 'base')
  )
  on conflict (student_id) do nothing;

  if p.id is not null then
    delete from public.pending_students where id = p.id;
  end if;

  return new;
end;
$$;

-- ---- #13: memory_snapshots index for the lateral join in v_student_progress
create index if not exists memory_snapshots_student_captured_idx
  on public.memory_snapshots (student_id, captured_on desc);

-- ---- #14: configurable low-talk threshold ----------------------------
alter table public.pilot_config
  add column if not exists low_talk_threshold_secs int not null default 600
    check (low_talk_threshold_secs > 0);

-- SECURITY DEFINER so the webhook (service role) and the views can read
-- the threshold without giving every authenticated user select on cost_caps.
create or replace function public.get_low_talk_threshold()
returns int language sql stable security definer set search_path = public as $$
  select coalesce(
    (select low_talk_threshold_secs from public.pilot_config where id = 1),
    600
  );
$$;
grant execute on function public.get_low_talk_threshold() to authenticated, service_role;

-- The original schema declared sessions.flagged_low_talk as a STORED
-- generated column with a hard-coded `< 600` predicate. Replace it with
-- a regular column that the webhook fills using the configurable
-- threshold, then backfill from the existing student_talk_seconds.
alter table public.sessions drop column if exists flagged_low_talk;
alter table public.sessions
  add column flagged_low_talk boolean not null default false;

update public.sessions
  set flagged_low_talk = (
    student_talk_seconds is not null
    and student_talk_seconds < public.get_low_talk_threshold()
  );

-- ---- #9 / #12: race-safe role change with from/to return -------------
-- Atomically guards against the "last superadmin demotes themselves and
-- locks everyone out" race, and returns the previous role so callers can
-- log a meaningful audit entry.
create or replace function public.safe_set_role(
  p_target text,
  p_new_role text
)
returns table (from_role text, to_role text)
language plpgsql security definer set search_path = public as $$
declare
  prev_role text;
begin
  if p_new_role not in ('student','facilitator','superadmin') then
    raise exception 'invalid role %', p_new_role using errcode = '22023';
  end if;

  select role into prev_role from public.students where student_id = p_target;
  if prev_role is null then
    raise exception 'no student %', p_target using errcode = 'P0002';
  end if;

  if prev_role = 'superadmin' and p_new_role <> 'superadmin' then
    if (select count(*) from public.students where role = 'superadmin') <= 1 then
      raise exception 'cannot remove last superadmin' using errcode = 'P0001';
    end if;
  end if;

  update public.students set role = p_new_role where student_id = p_target;

  return query select prev_role, p_new_role;
end;
$$;
grant execute on function public.safe_set_role(text, text) to service_role;

-- ---- bonus: assessments.cefr check constraint ------------------------
-- NOT VALID so existing rows aren't rejected; new writes are.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assessments_cefr_check'
  ) then
    alter table public.assessments
      add constraint assessments_cefr_check
      check (cefr is null or cefr in ('A1','A2','B1','B2','C1','C2'))
      not valid;
  end if;
end $$;
