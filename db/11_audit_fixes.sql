-- =====================================================================
-- ISOMO / IJWI — Audit fixes (patched for view-dependency).
-- Same content as db/11_audit_fixes.sql, with the view-dependency
-- handling fixed (drops + recreates v_student_progress and v_pilot_metrics
-- around the flagged_low_talk column rebuild).
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
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'usage_log_source_external_key'
  ) then
    alter table public.usage_log
      add constraint usage_log_source_external_key unique (source, external_id);
  end if;
end $$;

-- ---- #5: don't put email into display_name ---------------------------
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
    coalesce(p.display_name, meta_name),
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

-- ---- #13: memory_snapshots index ------------------------------------
create index if not exists memory_snapshots_student_captured_idx
  on public.memory_snapshots (student_id, captured_on desc);

-- ---- #14: configurable low-talk threshold ----------------------------
alter table public.pilot_config
  add column if not exists low_talk_threshold_secs int not null default 600
    check (low_talk_threshold_secs > 0);

create or replace function public.get_low_talk_threshold()
returns int language sql stable security definer set search_path = public as $$
  select coalesce(
    (select low_talk_threshold_secs from public.pilot_config where id = 1),
    600
  );
$$;
grant execute on function public.get_low_talk_threshold() to authenticated, service_role;

-- Drop dependent views BEFORE the column rebuild (CASCADE-free approach).
drop view if exists public.v_pilot_metrics;
drop view if exists public.v_student_progress;

-- Rebuild flagged_low_talk: generated column → regular column.
alter table public.sessions drop column if exists flagged_low_talk;
alter table public.sessions
  add column flagged_low_talk boolean not null default false;

update public.sessions
  set flagged_low_talk = (
    student_talk_seconds is not null
    and student_talk_seconds < public.get_low_talk_threshold()
  );

-- Recreate v_student_progress (definition from db/05_staff_split.sql).
create or replace view public.v_student_progress as
select
  s.student_id, s.display_name, s.cohort,
  count(distinct se.session_no)               as sessions_done,
  round(avg(se.student_talk_seconds)/60.0, 1) as avg_talk_min,
  count(*) filter (where se.flagged_low_talk) as silent_sessions,
  max(ms.summary)                             as latest_memory
from public.students s
left join public.sessions se on se.student_id = s.student_id
left join lateral (
  select summary from public.memory_snapshots m
  where m.student_id = s.student_id order by captured_on desc limit 1
) ms on true
where s.role = 'student'
group by s.student_id, s.display_name, s.cohort;

-- Recreate v_pilot_metrics (definition from db/01_schema.sql).
create or replace view public.v_pilot_metrics as
with conf as (
  select st.cohort, q.sitting, avg(q.overall) as conf
  from public.v_questionnaire_scored q
  join public.students st on st.student_id=q.student_id
  group by st.cohort, q.sitting
)
select
  st.cohort,
  round(avg(se.student_talk_seconds)/60.0,1)                     as avg_talk_min,
  count(*) filter (where se.flagged_low_talk)                    as silent_sessions,
  round(avg(ad.delta) filter (where ad.instrument='det'),2)      as det_gain,
  round(avg(ad.delta) filter (where ad.instrument='ixl'),2)      as ixl_gain,
  round((select conf from conf where conf.cohort=st.cohort and sitting='post')
      - (select conf from conf where conf.cohort=st.cohort and sitting='pre'),2) as confidence_gain,
  round(avg(case when ap.would_continue then 1 else 0 end)*100,0) as pct_would_continue
from public.students st
left join public.sessions se          on se.student_id=st.student_id
left join public.v_assessment_delta ad on ad.student_id=st.student_id
left join public.adoption_survey ap    on ap.student_id=st.student_id
group by st.cohort;

-- ---- #9 / #12: race-safe role change ----------------------------------
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
