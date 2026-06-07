-- =====================================================================
-- ISOMO / IJWI — Questionnaire is a STUDENT self-report.
-- The 10-item survey (anxiety/confidence/willingness/enjoyment) is
-- about how the student feels, so the student fills it out, not the
-- facilitator. RLS only grants SELECT on questionnaire_responses, so
-- the write goes through this security-definer RPC, which forces the
-- row's student_id to auth.uid() and accepts only pre or post.
-- Run AFTER 02_auth.sql.
-- =====================================================================

create or replace function public.submit_questionnaire(
  p_sitting text,
  p_q1 int, p_q2 int, p_q3 int,  p_q4 int, p_q5 int,
  p_q6 int, p_q7 int, p_q8 int,  p_q9 int, p_q10 int
)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid text := auth.uid()::text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_sitting not in ('pre','post') then raise exception 'sitting must be pre or post'; end if;

  insert into public.questionnaire_responses
    (student_id, sitting, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10)
  values
    (uid, p_sitting, p_q1, p_q2, p_q3, p_q4, p_q5, p_q6, p_q7, p_q8, p_q9, p_q10)
  on conflict (student_id, sitting) do update set
    q1=excluded.q1, q2=excluded.q2, q3=excluded.q3, q4=excluded.q4, q5=excluded.q5,
    q6=excluded.q6, q7=excluded.q7, q8=excluded.q8, q9=excluded.q9, q10=excluded.q10,
    submitted_on = current_date;
end;
$$;

grant execute on function public.submit_questionnaire(
  text, int, int, int, int, int, int, int, int, int, int
) to authenticated;
