-- =====================================================================
-- ISOMO / IJWI — Superadmin tier. Run AFTER 02_auth + 03_seeding.
-- Adds a 'superadmin' role above 'facilitator'. Superadmins inherit
-- every facilitator privilege (data access stays the same), and gain
-- the ability to promote/demote facilitators and other superadmins.
-- =====================================================================

-- 1) Widen the role check constraint to allow 'superadmin'.
alter table students drop constraint if exists students_role_check;
alter table students
  add constraint students_role_check
  check (role in ('student','facilitator','superadmin'));

-- 2) Update is_facilitator() so existing RLS policies treat superadmins
--    as facilitators-or-better. No policy rewrites needed.
create or replace function is_facilitator()
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from students
    where student_id = auth.uid()::text
      and role in ('facilitator','superadmin')
  );
$$;

-- 3) Helper for superadmin-only checks (used by app code, optional).
create or replace function is_superadmin()
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from students
    where student_id = auth.uid()::text
      and role = 'superadmin'
  );
$$;

-- To promote yourself to the first superadmin (run once):
--   update students set role='superadmin' where student_id = auth.uid()::text;
-- Or in the API console, hit /api/promote from an existing superadmin.
