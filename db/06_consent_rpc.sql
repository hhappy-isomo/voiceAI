-- =====================================================================
-- ISOMO / IJWI — Consent RPC.
-- The ConsentGate needs the student to flip consent_given on their own
-- row. There's no UPDATE policy on students (deliberately — we don't
-- want students mass-assigning role/cohort), so this security definer
-- function is the only way they can change exactly the two consent fields.
-- Run AFTER 04_superadmin.sql.
-- =====================================================================

create or replace function public.give_consent()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.students
  set consent_given = true,
      consented_at = now()
  where student_id = auth.uid()::text;
end;
$$;

grant execute on function public.give_consent() to authenticated;
