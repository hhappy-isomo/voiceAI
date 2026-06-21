# Migrations

The SQL files in this directory are the project's source of truth for the
Supabase / Postgres schema. They are numbered and **must be applied in
numerical order**, every time, on every environment.

There is no migration runner in this repo (yet). Apply migrations by hand
through the Supabase SQL editor, or via `psql -f` against a connection
string. Track which migrations have run on each environment in
[`DEPLOYMENT.md`](../DEPLOYMENT.md).

## Rules

1. **Always apply migrations before deploying code that depends on them.**
   See the "Migration order" section in `DEPLOYMENT.md` for the failure
   mode (it's not theoretical — round-1 hit it when the webhook started
   writing `sessions.flagged_low_talk` while it was still a generated
   column).

2. **Never edit a migration that's already been applied to staging or
   prod.** Write a follow-up migration that fixes the problem forward.
   The number is permanent.

3. **One concern per migration.** Cost-cap RPC and a column rename should
   be two files, not one. Easier to revert; easier to read in `git log`.

4. **File names: `NN_short_snake_name.sql`.** `NN` is a zero-padded
   two-digit number; the rest is snake_case. The drift checker in
   `scripts/check-migrations.mjs` enforces this.

5. **Idempotent or one-shot, never ambiguous.** Either the migration is
   safe to re-run (use `if not exists` / `on conflict do nothing`) or
   it's a backfill that's clearly one-shot (gate it on a `where` clause
   that's a no-op the second time, like `where col is null`).

6. **Schema-qualify everything inside `SECURITY DEFINER` functions.**
   These run with a stripped `search_path`. Use `public.foo`, not `foo`,
   or add `set search_path = public` to the function header.

7. **Service-role grants on RPCs that the API server needs to call.** RLS
   is bypassed by the service role, but `grant execute on function …`
   must still be explicit for some Supabase Postgres versions.

## Current ordering

```
01_schema.sql            tables + the 6-metric views
02_auth.sql              Google auth wiring, roles, RLS
03_seeding.sql           pre-roster + auto_rubric_scores
04_superadmin.sql        superadmin role + helpers
05_staff_split.sql       student/staff view split
06_consent_rpc.sql       give_consent() RPC
07_pilot_config.sql      pilot_config table + active session
08_questionnaire_rpc.sql questionnaire scoring helpers
09_control_features.sql  audit_log, pilot_calendar, usage_log, reset_student
10_superadmin_layer.sql  cost_caps, approved_voices, safety_rules, consent_versions
11_audit_fixes.sql       (round-1 audit) get_pilot_status, safe_set_role, etc.
12_perf_and_data.sql     (round-2 PR #6) mtd_spend RPC, recording_url backfill
13_safety_scan.sql       (round-2 PR #7) sessions.safety_severity, transcript_flags
14_rate_limits.sql       (round-2 PR #12) rate_limit_buckets + RPC
```

## Add a migration

1. Pick the next `NN_`.
2. Write the SQL.
3. Apply it on staging first. Watch the logs.
4. Update `DEPLOYMENT.md` with what changed.
5. Open a PR with the new file. The PR description states the manual
   step ("run `db/15_*.sql` before deploying").

## Validate file naming

```
node scripts/check-migrations.mjs
```

Exits non-zero if any file violates the naming rule or if there are gaps
in the numbering.
