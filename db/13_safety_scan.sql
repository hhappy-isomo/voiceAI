-- =====================================================================
-- ISOMO / IJWI — PR-A: wire the safety_rules table into actual scanning.
-- Run AFTER 12_perf_and_data.sql.
--
-- The webhook now scans each transcript against active safety_rules
-- after the session row is written. This migration adds the columns +
-- table the webhook writes to, and the dashboard reads from.
-- =====================================================================

-- ---- sessions.safety_severity: roll-up for dashboard sort/filter ----
-- 'clean' means scan ran and found nothing. NULL means scan hasn't run
-- (legacy rows, or rules table was empty at scan time).
alter table public.sessions
  add column if not exists safety_severity text
    check (safety_severity in ('clean','warn','flag','block'));

create index if not exists sessions_safety_severity_idx
  on public.sessions (safety_severity)
  where safety_severity in ('flag','block');

-- ---- transcript_flags: one row per rule hit -------------------------
-- Stores the snippet of transcript that matched so a facilitator can
-- read context without pulling the whole transcript file.
create table if not exists public.transcript_flags (
  id          bigint generated always as identity primary key,
  session_id  bigint not null references public.sessions(id) on delete cascade,
  rule_id     bigint references public.safety_rules(id) on delete set null,
  severity    text   not null check (severity in ('warn','flag','block')),
  snippet     text,
  created_at  timestamptz not null default now()
);
create index if not exists transcript_flags_session_idx
  on public.transcript_flags (session_id);

alter table public.transcript_flags enable row level security;

drop policy if exists "facilitator read flags" on public.transcript_flags;
create policy "facilitator read flags" on public.transcript_flags
  for select using (is_facilitator());
-- Writes go through the service-role webhook only.
