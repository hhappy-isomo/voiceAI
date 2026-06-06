-- =====================================================================
-- ISOMO VOICE AI PILOT - Supabase / Postgres schema
-- System of record + monitoring. Joins to Mem0 and ElevenLabs by student_id.
-- Run in Supabase: SQL Editor -> paste -> Run.
-- =====================================================================

-- ---- STUDENTS ----------------------------------------------------------
-- display_name lives ONLY here (facilitator convenience); it is NEVER sent to
-- the agent, Mem0, or Exa. Everything downstream uses student_id only.
create table if not exists students (
  student_id   text primary key,                 -- e.g. 'AMANI_014' - the universal key
  display_name text,                              -- Supabase-only; for facilitators
  cohort       text not null default 'base'
               check (cohort in ('base','foundation')),
  enrolled_on  date not null default current_date,
  consent_given boolean not null default false,    -- ticked at first login
  consented_at  timestamptz                        -- when they agreed
);

-- ---- ASSESSMENTS (speaking tests + IXL) --------------------------------
-- One row per test sitting. instrument lets one table hold DET, the CEFR
-- rubric, SmallTalk2Me, and IXL smartscore.
create table if not exists assessments (
  id          bigint generated always as identity primary key,
  student_id  text not null references students(student_id) on delete cascade,
  sitting     text not null check (sitting in ('pre','post')),
  instrument  text not null check (instrument in ('det','rubric','efset','smalltalk2me','ixl')),
  score       numeric,                            -- raw score / smartscore
  cefr        text,                               -- e.g. 'A2','B1' (where applicable)
  assessed_on date not null default current_date,
  unique (student_id, sitting, instrument)
);

-- ---- QUESTIONNAIRE (confidence & anxiety, 10 items) --------------------
-- q1..q3 are anxiety items (reverse-scored in the view below).
create table if not exists questionnaire_responses (
  id           bigint generated always as identity primary key,
  student_id   text not null references students(student_id) on delete cascade,
  sitting      text not null check (sitting in ('pre','post')),
  q1 int, q2 int, q3 int, q4 int, q5 int,
  q6 int, q7 int, q8 int, q9 int, q10 int,
  submitted_on date not null default current_date,
  unique (student_id, sitting)
);

-- ---- SESSIONS (one row per voice conversation) -------------------------
-- Written automatically by the post-call webhook after every call.
create table if not exists sessions (
  id                 bigint generated always as identity primary key,
  student_id         text not null references students(student_id) on delete cascade,
  session_no         int,                         -- 1..24 (set manually / by facilitator)
  held_on            date not null default current_date,
  duration_seconds   int,                         -- total call length
  student_talk_seconds int,                       -- METRIC 1: how long the student spoke
  topic              text,
  conversation_id    text,                        -- ElevenLabs conversation id
  transcript_url     text,
  recording_url      text,                         -- banked audio (training corpus)
  flagged_low_talk   boolean generated always as
                     (student_talk_seconds is not null and student_talk_seconds < 600) stored,
                     -- auto-flag if the student spoke < 10 of 20 minutes
  unique (conversation_id)                          -- lets the webhook upsert idempotently
);

-- ---- MEMORY SNAPSHOTS (your own copy of what Mem0 knows) ---------------
create table if not exists memory_snapshots (
  id          bigint generated always as identity primary key,
  student_id  text not null references students(student_id) on delete cascade,
  summary     text,                               -- pulled from Mem0 after each call
  captured_on timestamptz not null default now()
);

-- ---- ADOPTION (Metric 6: end-of-pilot) ---------------------------------
create table if not exists adoption_survey (
  id                    bigint generated always as identity primary key,
  student_id            text not null references students(student_id) on delete cascade,
  would_continue        boolean,                  -- student wants to keep using it
  facilitator_time_freed boolean,                 -- facilitator's verdict
  submitted_on          date not null default current_date,
  unique (student_id)
);

-- =====================================================================
-- VIEWS - the monitoring layer
-- =====================================================================

-- Questionnaire scored: reverse items 1-3 (6 - score), overall + subscales.
create or replace view v_questionnaire_scored as
select
  student_id, sitting,
  ((6-q1)+(6-q2)+(6-q3)+q4+q5+q6+q7+q8+q9+q10)/10.0 as overall,
  ((6-q1)+(6-q2)+(6-q3))/3.0                          as anxiety_reduced, -- higher = less anxious
  (q4+q5+q6)/3.0                                      as confidence,
  (q7+q8)/2.0                                         as willingness,
  (q9+q10)/2.0                                        as enjoyment
from questionnaire_responses;

-- Per-student progress snapshot for the facilitator dashboard.
create or replace view v_student_progress as
select
  s.student_id, s.display_name, s.cohort,
  count(distinct se.session_no)                             as sessions_done,
  round(avg(se.student_talk_seconds)/60.0, 1)              as avg_talk_min,
  count(*) filter (where se.flagged_low_talk)               as silent_sessions,
  max(ms.summary)                                           as latest_memory
from students s
left join sessions se        on se.student_id = s.student_id
left join lateral (
  select summary from memory_snapshots m
  where m.student_id = s.student_id order by captured_on desc limit 1
) ms on true
group by s.student_id, s.display_name, s.cohort;

-- Pre->Post change per student per instrument (feeds fluency & grammar metrics).
create or replace view v_assessment_delta as
select
  a.student_id, s.cohort, a.instrument,
  max(score) filter (where sitting='pre')  as pre_score,
  max(score) filter (where sitting='post') as post_score,
  max(score) filter (where sitting='post') - max(score) filter (where sitting='pre') as delta
from assessments a join students s on s.student_id = a.student_id
group by a.student_id, s.cohort, a.instrument;

-- THE SIX METRICS, rolled up by cohort.
create or replace view v_pilot_metrics as
with conf as (
  select st.cohort, q.sitting, avg(q.overall) as conf
  from v_questionnaire_scored q join students st on st.student_id=q.student_id
  group by st.cohort, q.sitting
)
select
  st.cohort,
  -- Metric 1: dose
  round(avg(se.student_talk_seconds)/60.0,1)                     as avg_talk_min,
  count(*) filter (where se.flagged_low_talk)                    as silent_sessions,
  -- Metric 2/3: assessment gains (by instrument, pull from v_assessment_delta)
  round(avg(ad.delta) filter (where ad.instrument='det'),2)      as det_gain,
  round(avg(ad.delta) filter (where ad.instrument='ixl'),2)      as ixl_gain,
  -- Metric 4: confidence gain (post - pre)
  round((select conf from conf where conf.cohort=st.cohort and sitting='post')
      - (select conf from conf where conf.cohort=st.cohort and sitting='pre'),2) as confidence_gain,
  -- Metric 6: adoption
  round(avg(case when ap.would_continue then 1 else 0 end)*100,0) as pct_would_continue
from students st
left join sessions se          on se.student_id=st.student_id
left join v_assessment_delta ad on ad.student_id=st.student_id
left join adoption_survey ap    on ap.student_id=st.student_id
group by st.cohort;
-- Metric 5 (equity) = read v_pilot_metrics across the two cohort rows and compare gains.

-- =====================================================================
-- ROW-LEVEL SECURITY (turn on before go-live; service role = webhook)
-- =====================================================================
-- alter table students enable row level security;  -- etc. Configure policies
-- so only authenticated facilitators read, and the service role (webhook) writes.
