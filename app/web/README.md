# Isomo Voice AI — Web

Student portal + facilitator dashboard. Next.js 16 (App Router) · Supabase Auth (Google) · ElevenLabs Convai widget.

## Local setup

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# NEXT_PUBLIC_ELEVENLABS_AGENT_ID

npm install
npm run dev
```

Open http://localhost:3000.

## How identity flows to the agent

1. Student signs in with Google → Supabase Auth issues a UID.
2. The `handle_new_user` trigger (from `db/02_auth.sql`) creates a `students` row keyed by that UID.
3. The student portal embeds the ElevenLabs Convai widget and passes
   `dynamic-variables='{"student_id": "<SUPABASE_UID>"}'`. Email and name never leave Supabase.
4. The agent uses `student_id` as the Mem0 `user_id` — memory continuity across the 24 sessions.

## Roles

Every new user is `role = 'student'`. Promote facilitators manually in the DB:

```sql
update students set role='facilitator' where display_name = 'Their Name';
```

A facilitator visiting `/` is redirected to `/dashboard`.

## Routes

- `/login` — Google sign-in only.
- `/auth/callback` — OAuth code exchange.
- `/` — student portal: greeting, journey strip, embedded agent. Shows consent gate first time.
- `/dashboard` — facilitator dashboard: 6 metrics, cohort breakdown, roster (silent sessions highlighted).
- `/dashboard/students/[id]` — student detail: sessions, assessments, questionnaire, latest memory snapshot.
- `/dashboard/assessments` — manual entry for assessment scores (DET, rubric, EF SET, IXL).

## Deploy

Vercel is the path of least resistance:

```bash
vercel
```

Set the three `NEXT_PUBLIC_*` env vars in the Vercel project. In Supabase Auth:
- Add the deployed URL to **Site URL** and **Redirect URLs**.
- Make sure the Google OAuth provider is enabled.
