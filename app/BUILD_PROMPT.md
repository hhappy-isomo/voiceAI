# Isomo Voice AI — App Build Prompt (Lovable)

Paste this into Lovable to build the app. It's **one app with two roles**: students log in and
talk to the AI tutor; facilitators monitor progress. Backed by Supabase (auth + database, schema
already created) and an embedded ElevenLabs voice agent.

---

## Stack & connections
- **Frontend:** React (Lovable default), mobile- and laptop-friendly.
- **Backend:** Supabase — **connect to the existing project** (tables already created from `db/01_schema.sql` + `db/02_auth.sql`). Do NOT recreate tables.
- **Auth:** Supabase Auth with **Google sign-in only**.
- **Voice agent:** embedded **ElevenLabs Conversational AI widget**.
- **Env vars:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ELEVENLABS_AGENT_ID`.

## Design
- Warm, encouraging, clean. Isomo green **#8CC63E** as the accent, dark text **#4A4B4C**, white space.
- Feels like a supportive coach, not an exam. Big friendly buttons. Works on lab laptops (primary) and phones.
- Copy is plain and motivating ("Ready to talk?", "You've got this").

---

## ROLES
A logged-in user is a **student** by default. If their row in `students` has `role = 'facilitator'`,
show the facilitator dashboard instead. (RLS already restricts what each role can read.)

---

## STUDENT EXPERIENCE

### 1. Login
- A clean landing screen: Isomo logo, one line ("Your English speaking partner"), and a **"Sign in with Google"** button. Nothing else.

### 2. Consent gate (first login only)
- After first sign-in, if `students.consent_given` is false, show a simple consent card:
  > "I'm happy to practice English with the AI tutor. I understand my sessions are recorded to
  > help me improve and to help Isomo build and improve its educational tools."
- One **"I agree"** button. On click: set `consent_given = true`, `consented_at = now()` on their
  `students` row, then continue. (Don't show again after.)

### 3. The portal (main student screen)
- Warm greeting using their first name (from Google profile — display only, client-side).
- A short **"Your journey"** strip: number of sessions completed (count from `sessions`), and an
  encouraging line ("Day 4 of your 6-week journey — keep going!").
- A big **"Start today's conversation"** button that opens the **embedded ElevenLabs agent**.
- That's the core — keep it simple and inviting.

### 4. The embedded agent — CRITICAL WIRING
- Embed the ElevenLabs Convai widget using `ELEVENLABS_AGENT_ID`.
- **Pass the student's Supabase auth UID into the agent as a dynamic variable named `student_id`.**
  This is what links the conversation to their memory (Mem0 uses it as `user_id`). Example with the
  web component:
  ```html
  <elevenlabs-convai
     agent-id="ELEVENLABS_AGENT_ID"
     dynamic-variables='{"student_id": "<SUPABASE_USER_UID>"}'>
  </elevenlabs-convai>
  <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async></script>
  ```
  Inject the real UID at render time. The UID — never the name/email — is what flows to the agent.

---

## FACILITATOR EXPERIENCE (role = 'facilitator')

A dashboard. Pull from the views that already exist in the database.

### Overview (top)
- The six metrics, per cohort, from **`v_pilot_metrics`**: avg talk-time, silent sessions, DET gain,
  IXL gain, confidence gain, % would-continue. Show base vs foundation side by side (this is the
  equity comparison).

### Roster (main table)
- One row per student from **`v_student_progress`**: display_name, cohort, sessions done,
  avg talk-time (min), silent-session count.
- **Highlight rows with silent sessions** (low talk-time) — these are students to check on.
- A **cohort toggle** per student (base / foundation) that updates `students.cohort`.

### Student detail (click a row)
- Their sessions list from `sessions` (session_no, date, duration, talk-time, flagged).
- Their assessment scores from `assessments` (pre vs post, by instrument).
- Their questionnaire scores from `v_questionnaire_scored` (pre vs post).
- **"What the tutor remembers"** panel — the latest `memory_snapshots.summary` for that student.
  This lets a facilitator see the student's thread (their dream, opinions) at a glance.

### Manual entry (facilitators need to log assessment scores)
- A small form to add an `assessments` row (student, sitting pre/post, instrument det/rubric/efset/ixl,
  score, cefr). This is how rubric and EF SET scores get in.

---

## OUT OF SCOPE (handled elsewhere, don't build)
- The post-call webhook that writes `sessions` rows and `memory_snapshots` (separate Supabase Edge Function).
- Mem0 and Exa wiring (configured in the ElevenLabs dashboard, not here).
- The agent's prompts (managed in ElevenLabs).

## Acceptance checklist
- [ ] Google sign-in works; new users get a `students` row (DB trigger handles this).
- [ ] Consent gate shows once, writes `consent_given`.
- [ ] Student sees the portal and can launch the agent.
- [ ] The agent receives the student's UID as the `student_id` dynamic variable.
- [ ] Facilitator role sees the dashboard; student role never does.
- [ ] Dashboard reads the metrics/roster/detail from the existing views.
- [ ] Facilitator can tag cohort and enter assessment scores.
