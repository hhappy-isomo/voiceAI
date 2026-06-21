-- =====================================================================
-- ISOMO / IJWI — Postgres-based rate limit (B7). Run AFTER 13_safety_scan.sql.
--
-- Fixed-window counter, one row per (key, window_start). The app helper
-- in lib/rate-limit.ts hits rate_limit_check() which upserts atomically
-- and returns whether the request is allowed.
-- =====================================================================

create table if not exists public.rate_limit_buckets (
  key          text        not null,
  window_start timestamptz not null,
  count        int         not null default 0,
  primary key (key, window_start)
);

-- Cheap cleanup target: drop old windows. Run by hand or from a Supabase
-- scheduled function once a day:
--   delete from rate_limit_buckets where window_start < now() - interval '1 day';
create index if not exists rate_limit_buckets_window_idx
  on public.rate_limit_buckets (window_start);

alter table public.rate_limit_buckets enable row level security;
-- No policies: only service_role (which bypasses RLS) ever touches it.

-- Atomic: increment the counter for this (key, window) and report
-- whether we're now over the cap. Returns retry_after_secs so the API
-- can set Retry-After header.
create or replace function public.rate_limit_check(
  p_key         text,
  p_max         int,
  p_window_secs int
)
returns table (allowed boolean, hit_count int, retry_after_secs int)
language plpgsql security definer set search_path = public as $$
declare
  win_start timestamptz;
  new_count int;
begin
  if p_max <= 0 or p_window_secs <= 0 then
    raise exception 'rate_limit_check: p_max and p_window_secs must be > 0';
  end if;

  -- Bucket boundary: floor(epoch / window) * window
  win_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_secs) * p_window_secs
  );

  insert into public.rate_limit_buckets (key, window_start, count)
  values (p_key, win_start, 1)
  on conflict (key, window_start) do update
    set count = public.rate_limit_buckets.count + 1
  returning public.rate_limit_buckets.count into new_count;

  return query select
    (new_count <= p_max),
    new_count,
    case when new_count > p_max then
      greatest(
        1,
        ceil(extract(epoch from (win_start + (p_window_secs || ' seconds')::interval) - now()))::int
      )
    else 0 end;
end;
$$;
grant execute on function public.rate_limit_check(text, int, int) to service_role;
