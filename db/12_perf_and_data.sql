-- =====================================================================
-- ISOMO / IJWI — Phase-2 audit fixes (B1, B4). Run AFTER 11_audit_fixes.sql.
--
-- Covers:
--   B1  mtd_spend() RPC — replaces the per-request JS scan of usage_log
--       in lib/cost-guard.ts with one Postgres aggregate.
--   B4  Backfill sessions.recording_url from "full public URL" form to
--       "storage path" form, so the dashboard sign-helper sees one shape.
-- =====================================================================

-- ---- B1: month-to-date spend as a single aggregate -------------------
-- SECURITY DEFINER so the service-role client can call it without
-- broad select grants on usage_log.
create or replace function public.mtd_spend(p_student_id text default null)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost_usd), 0)::numeric
  from public.usage_log
  where at >= date_trunc('month', now())
    and (p_student_id is null or student_id = p_student_id);
$$;
grant execute on function public.mtd_spend(text) to service_role;

-- ---- B4: normalize legacy recording_url values to paths --------------
-- The webhook now stores storage paths (e.g. '<conv-id>.mp3'). Rows
-- written by the pre-fix webhook hold a full public URL like
-- 'https://<project>.supabase.co/storage/v1/object/public/recordings/<conv-id>.mp3'.
-- Strip the prefix so the sign-helper has one shape to deal with.
--
-- The `like 'http%'` filter makes this idempotent — running again is a no-op.
update public.sessions
   set recording_url = regexp_replace(recording_url, '^.*/recordings/', '')
 where recording_url like 'http%'
   and recording_url ~ '/recordings/';
