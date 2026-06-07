-- =====================================================================
-- ISOMO / IJWI — Single-row pilot config. Tracks which of the 24 session
-- prompts is currently live on the ElevenLabs agent. The /api/activate-
-- session route updates this AND the agent.
-- Run AFTER 04_superadmin.sql.
-- =====================================================================

create table if not exists pilot_config (
  id                bigint primary key default 1 check (id = 1),
  active_session_no int not null default 1 check (active_session_no between 1 and 24),
  activated_at      timestamptz not null default now(),
  activated_by      text references students(student_id) on delete set null
);

insert into pilot_config (id) values (1) on conflict (id) do nothing;

alter table pilot_config enable row level security;

drop policy if exists "staff read pilot config" on pilot_config;
create policy "staff read pilot config" on pilot_config
  for select using (is_facilitator());
-- Writes go through the service-role API route, so no UPDATE policy is needed.
