# Staging environment

The pilot's production project is documented in `DEPLOYMENT.md`. This file
describes how to spin up an isolated staging copy you can break things on
without students noticing.

## What "staging" means here

- A second Supabase project, in the same region, with the same schema and
  edge functions as production but **its own data and its own URL**.
- A second ElevenLabs agent (or workspace, if you prefer) wired to the
  staging webhook URL.
- A second Vercel deployment (preview branch is fine) pointed at the
  staging Supabase URL.

You should be able to wipe staging at any time without telling anyone.

## One-time setup

1. **Create a new Supabase project** named e.g. `isomo-staging`. Free
   tier is fine for a few weeks; bump if you start seeing OOM.

2. **Apply the migrations** in `db/`, in numerical order, through the
   Supabase SQL editor. See `db/README.md` for the order. Track which
   migrations have run in `DEPLOYMENT.md` under a `## Staging` section.

3. **Enable Google auth** with the same OAuth client as production, OR a
   separate one — separate is cleaner because students can't accidentally
   sign in to staging.

4. **Create the `recordings` storage bucket** and **set it to private**.
   The webhook writes paths only; the app mints signed URLs.

5. **Deploy the Edge Function**:
   ```
   supabase functions deploy elevenlabs-postcall --project-ref <staging-ref>
   ```
   Set its secrets:
   ```
   supabase secrets set MEM0_API_KEY=... ELEVENLABS_WEBHOOK_SECRET=... \
     --project-ref <staging-ref>
   ```
   Default-closed — the webhook returns 503 if the secret is missing.

6. **Create a second ElevenLabs agent** in your workspace, wired to the
   staging Edge Function URL. Different webhook signing secret from
   production.

7. **Configure the Vercel preview env**: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`,
   `ELEVENLABS_AGENT_ID` (the staging one), `MEM0_API_KEY`.

## Workflow

- New code lands on `main` only after it's been verified on staging.
- DB migrations: apply to staging first, watch logs for a day or two,
  then apply to production. **Do this even for one-liners.**
- Use `NEXT_PUBLIC_DEV_BYPASS_AUTH=1` locally to skip Google sign-in.
  Don't ever set it on staging or prod.

## Smoke test before promoting to prod

1. Run a real ElevenLabs conversation against the staging agent.
2. Confirm a `sessions` row appears with non-null `student_talk_seconds`,
   `safety_severity`, and either a recording path or null.
3. Open the dashboard, click into the call, hit play on the recording —
   you should get a signed URL with a `?token=` query string.
4. Trigger `/api/auto-rubric` from the SessionDrawer — confirm a row in
   `auto_rubric_scores` and a usage_log row with `source='anthropic'`.
5. In `/superadmin/power`, flip the kill switch — log out as a student,
   confirm they hit `/paused`. Release the kill switch.
6. Hammer `/api/auto-rubric` 25 times — the 21st should return 429.

If all six pass, you can ship to prod with the same migration + webhook +
app diff.

## Resetting staging

```sql
-- as service_role in the staging project
truncate
  sessions, memory_snapshots, assessments, questionnaire_responses,
  adoption_survey, auto_rubric_scores, transcript_flags, usage_log,
  audit_log, rate_limit_buckets
  restart identity cascade;
delete from students where role = 'student';
delete from auth.users where email not in ('your-test-account@example.com');
```

Then re-seed via the `pending_students` table and the auth trigger.
