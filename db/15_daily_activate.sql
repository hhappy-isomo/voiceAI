-- =====================================================================
-- ISOMO / IJWI — daily auto-activate of today's session prompt.
-- Run AFTER db/14_rate_limits.sql.
--
-- Every weekday at 06:00 UTC, pg_cron triggers a Postgres function that:
--   1. Looks up pilot_calendar for today's planned_date
--   2. Skips weekends + rows flagged skipped=true
--   3. Calls the app's /api/cron/activate-session endpoint via pg_net
--   4. The endpoint validates the cron secret, then PATCHes ElevenLabs
--      with the matching prompt from sessions-data.ts
--   5. Logs success/failure to master_prompt_events
--
-- The cron secret + endpoint URL live in cron_settings (one-row table)
-- so they can be rotated without touching the migration.
--
-- Idempotent: if pg_cron is already enabled and the job exists, the
-- migration is a no-op for those parts.
-- =====================================================================

-- pg_cron + pg_net live in the extensions schema on Supabase.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ---- cron_settings: one-row config ----------------------------------
create table if not exists public.cron_settings (
  id              bigint primary key default 1 check (id = 1),
  activate_url    text,           -- e.g. https://ijwi-six.vercel.app/api/cron/activate-session
  cron_secret     text,           -- shared with the Vercel route; rotate at will
  enabled         boolean not null default false,
  updated_at      timestamptz not null default now(),
  updated_by      text references public.students(student_id) on delete set null
);
insert into public.cron_settings (id) values (1) on conflict (id) do nothing;

alter table public.cron_settings enable row level security;
drop policy if exists "staff read cron_settings" on public.cron_settings;
create policy "staff read cron_settings" on public.cron_settings
  for select using (is_facilitator());
-- Writes go through a service-role API route.

-- ---- the cron trigger function --------------------------------------
-- Called by pg_cron every weekday at 06:00 UTC. Decides which session_no
-- runs today and fires the activate-session endpoint. Logs everything.
create or replace function public.trigger_daily_activate()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg          public.cron_settings%rowtype;
  today_date   date := (now() at time zone 'UTC')::date;
  today_dow    int  := extract(dow from today_date);  -- 0 Sun, 6 Sat
  today_sess   int;
  is_skipped   boolean;
  req_id       bigint;
begin
  -- Skip weekends regardless of calendar contents.
  if today_dow = 0 or today_dow = 6 then
    insert into public.master_prompt_events
      (session_no, agents_count, succeeded, failed)
      values (null, 0, 0, 0);
    return;
  end if;

  select * into cfg from public.cron_settings where id = 1;
  if not cfg.enabled or cfg.activate_url is null or cfg.cron_secret is null then
    insert into public.master_prompt_events
      (session_no, agents_count, succeeded, failed)
      values (null, 0, 0, 0);
    return;
  end if;

  -- Today's planned session in pilot_calendar.
  select session_no, skipped
    into today_sess, is_skipped
    from public.pilot_calendar
   where planned_date = today_date
   limit 1;

  if today_sess is null or is_skipped then
    insert into public.master_prompt_events
      (session_no, agents_count, succeeded, failed)
      values (today_sess, 0, 0, 0);
    return;
  end if;

  -- Fire the request to our app. The response comes back asynchronously
  -- and the app logs the real outcome to master_prompt_events; we just
  -- log the dispatch attempt here.
  select extensions.http_post(
    url     := cfg.activate_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', cfg.cron_secret
    ),
    body    := jsonb_build_object('session_no', today_sess)::text
  ) into req_id;

  insert into public.master_prompt_events
    (session_no, agents_count, succeeded, failed)
    values (today_sess, 1, 0, 0);  -- "dispatched"; the API route will overwrite with real result
end;
$$;
revoke all on function public.trigger_daily_activate() from public;
grant execute on function public.trigger_daily_activate() to service_role;

-- ---- schedule it ----------------------------------------------------
-- Mon–Fri at 06:00 UTC. Re-running the migration just unschedules the
-- old one and re-schedules — safe to apply multiple times.
do $$
begin
  perform cron.unschedule('isomo-daily-activate');
exception when others then
  -- job didn't exist, nothing to undo
  null;
end $$;

select cron.schedule(
  'isomo-daily-activate',
  '0 6 * * 1-5',   -- 06:00 UTC, Monday through Friday
  $$ select public.trigger_daily_activate() $$
);
