-- =====================================================================
-- ISOMO / IJWI — Superadmin layer. Run AFTER 09_control_features.sql.
-- Tables, columns, and helpers used by /superadmin/* only.
-- =====================================================================

-- ---- Cost guardrails (single-row config) -----------------------------
create table if not exists cost_caps (
  id                    bigint primary key default 1 check (id = 1),
  monthly_ceiling_usd   numeric,                        -- null = no cap
  per_student_cap_usd   numeric,                        -- null = no cap
  drain_mode            boolean not null default false, -- no new calls
  kill_all              boolean not null default false, -- emergency stop
  updated_at            timestamptz not null default now(),
  updated_by            text references students(student_id) on delete set null
);
insert into cost_caps (id) values (1) on conflict (id) do nothing;
alter table cost_caps enable row level security;
drop policy if exists "staff read cost_caps" on cost_caps;
create policy "staff read cost_caps" on cost_caps
  for select using (is_facilitator());
-- Writes go through service-role API routes.

-- ---- Voice library (which EL voices the org approves) ----------------
create table if not exists approved_voices (
  voice_id    text primary key,
  voice_name  text,
  notes       text,
  approved_at timestamptz not null default now(),
  approved_by text references students(student_id) on delete set null
);
alter table approved_voices enable row level security;
drop policy if exists "staff read voices" on approved_voices;
create policy "staff read voices" on approved_voices
  for select using (is_facilitator());

-- ---- Banned words / safety rules -------------------------------------
create table if not exists safety_rules (
  id          bigint generated always as identity primary key,
  word_or_re  text not null,
  is_regex    boolean not null default false,
  severity    text not null default 'warn' check (severity in ('warn','flag','block')),
  notes       text,
  added_at    timestamptz not null default now(),
  added_by    text references students(student_id) on delete set null
);
alter table safety_rules enable row level security;
drop policy if exists "staff read safety" on safety_rules;
create policy "staff read safety" on safety_rules
  for select using (is_facilitator());

-- ---- Consent text versioning -----------------------------------------
create table if not exists consent_versions (
  id          bigint generated always as identity primary key,
  body        text not null,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  text references students(student_id) on delete set null
);
alter table consent_versions enable row level security;
drop policy if exists "all read consent versions" on consent_versions;
create policy "all read consent versions" on consent_versions
  for select using (true);

-- Add consent_version_id to students so we know which version each
-- student agreed to.
alter table students
  add column if not exists consent_version_id bigint references consent_versions(id);

-- Seed the first consent version from the existing copy if empty.
do $$
begin
  if not exists (select 1 from consent_versions) then
    insert into consent_versions (body, is_active) values (
      'I''m happy to practice English with the AI tutor. I understand my sessions are recorded to help me improve and to help Ijwi build and improve its educational tools.',
      true
    );
  end if;
end $$;

-- ---- Promote give_consent to attach the active consent version --------
create or replace function public.give_consent()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  select id into v_id from consent_versions where is_active = true order by id desc limit 1;
  update public.students
  set consent_given = true,
      consented_at = now(),
      consent_version_id = v_id
  where student_id = auth.uid()::text;
end;
$$;

-- ---- Master prompt push helper RPC -----------------------------------
-- Records an event each time a master prompt is pushed (the actual EL
-- API calls happen from the API route since they need network access).
create table if not exists master_prompt_events (
  id         bigint generated always as identity primary key,
  session_no int,
  agents_count int,
  succeeded  int,
  failed     int,
  by_user    text references students(student_id) on delete set null,
  at         timestamptz not null default now()
);
alter table master_prompt_events enable row level security;
drop policy if exists "staff read master prompt" on master_prompt_events;
create policy "staff read master prompt" on master_prompt_events
  for select using (is_facilitator());
