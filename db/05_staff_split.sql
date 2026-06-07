-- =====================================================================
-- ISOMO / IJWI — Split the roster: students vs. staff.
-- Run AFTER 04_superadmin.sql.
-- =====================================================================

-- The student roster should only show actual students (role='student'),
-- not facilitators / superadmins who happen to live in the same table.
create or replace view v_student_progress as
select
  s.student_id, s.display_name, s.cohort,
  count(distinct se.session_no)               as sessions_done,
  round(avg(se.student_talk_seconds)/60.0, 1) as avg_talk_min,
  count(*) filter (where se.flagged_low_talk) as silent_sessions,
  max(ms.summary)                             as latest_memory
from students s
left join sessions se on se.student_id = s.student_id
left join lateral (
  select summary from memory_snapshots m
  where m.student_id = s.student_id order by captured_on desc limit 1
) ms on true
where s.role = 'student'
group by s.student_id, s.display_name, s.cohort;

-- Companion view: staff (facilitators + superadmins) for the new /dashboard/staff page.
create or replace view v_staff as
select student_id, display_name, role, enrolled_on
from students
where role in ('facilitator','superadmin')
order by role desc, display_name nulls last;
