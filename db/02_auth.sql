-- =====================================================================
-- ISOMO - Auth add-on. Run AFTER Isomo_Supabase_Schema.sql.
-- Ties Supabase Auth (Google sign-in) to the students table, adds roles.
-- =====================================================================

-- 1) student_id should equal the Supabase auth UID (uuid as text).
--    (Schema already defines students.student_id text primary key - good.)

-- 2) Role flag so the app knows facilitators from students.
alter table students add column if not exists role text not null default 'student'
  check (role in ('student','facilitator'));

-- 3) Auto-create a students row the moment someone signs in with Google.
--    Only the auth UID is copied in as student_id; email/name are NOT copied
--    into the agent path - display_name is for the facilitator UI only.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.students (student_id, display_name, role)
  values (
    new.id::text,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'student'
  )
  on conflict (student_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 4) To promote someone to facilitator (run once per facilitator):
--    update students set role='facilitator' where display_name = 'Facilitator Name';

-- 5) Row-Level Security: students see only their own rows; facilitators see all.
alter table students                enable row level security;
alter table sessions                enable row level security;
alter table assessments             enable row level security;
alter table questionnaire_responses enable row level security;
alter table memory_snapshots        enable row level security;
alter table adoption_survey         enable row level security;

-- helper: is the current user a facilitator?
create or replace function is_facilitator()
returns boolean language sql stable security definer as $$
  select exists(select 1 from students
                where student_id = auth.uid()::text and role='facilitator');
$$;

-- students: read own row OR facilitator reads all
create policy "own or facilitator (students)" on students for select
  using (student_id = auth.uid()::text or is_facilitator());

-- the data tables: student reads own; facilitator reads all; webhook (service role) bypasses RLS
do $$
declare t text;
begin
  foreach t in array array['sessions','assessments','questionnaire_responses','memory_snapshots','adoption_survey']
  loop
    execute format(
      'create policy "read own or facilitator" on %I for select using (student_id = auth.uid()::text or is_facilitator());', t);
  end loop;
end $$;

-- Note: the post-call webhook writes with the SERVICE ROLE key, which bypasses
-- RLS - so it can insert sessions/snapshots for any student. Keep that key
-- server-side only (in the Edge Function secrets), never in the frontend.
