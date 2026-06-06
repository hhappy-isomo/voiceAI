# Isomo Voice AI — Setup Guide

Click-by-click to take the repo from code to a running pilot. Work top to bottom.
Secrets live in `~/.isomo/voiceai.env` (chmod 600) — paste values from there into each dashboard.

---

## 0. Accounts you'll need
- [ ] **Supabase** (database + auth + webhook host)
- [ ] **ElevenLabs** (the voice agent) — Turbo tier / Impact Program
- [ ] **Mem0** (per-student memory) — get API key + MCP URL
- [ ] **Exa** (web search) — API key
- [ ] **Lovable** (builds the app)
- [ ] **Google Cloud** (for Google sign-in OAuth credentials)

---

## 1. Supabase — database + auth
1. [ ] Create a new Supabase project. Note the **Project URL**, **anon key**, **service_role key**
   (Settings → API) → put them in `~/.isomo/voiceai.env`.
2. [ ] SQL Editor → paste & run **`db/01_schema.sql`**, then **`db/02_auth.sql`** (in that order).
3. [ ] Storage → create a **private bucket named `recordings`** (for banked audio).
4. [ ] **Google sign-in:**
   - In **Google Cloud Console** → APIs & Services → Credentials → create an **OAuth client ID**
     (type: Web). Authorized redirect URI: `https://<PROJECT-REF>.supabase.co/auth/v1/callback`.
   - Copy the Google **client ID + secret** into Supabase → Authentication → Providers → **Google** → enable.

---

## 2. ElevenLabs — the agent
1. [ ] Agents → **Create agent** (blank). Name it `Isomo Thinking Partner`.
2. [ ] **System prompt:** paste `agent/prompts/Session_01_the_story_of_you.txt`.
   (Each morning you'll swap in that day's `Session_NN` file — see §6.)
3. [ ] **Voice:** clear, warm, not too fast. **Language:** English.
4. [ ] **First message:** "Hello! I'm so glad you're here. Tell me — where did your story begin?"
5. [ ] **Max call duration:** ~22 minutes (caps cost; sessions are 20 min).
6. [ ] Note the **Agent ID** → `~/.isomo/voiceai.env` (`ELEVENLABS_AGENT_ID`).

### 2a. Add Mem0 (memory) via MCP
- [ ] ElevenLabs → MCP server integrations → **Add Custom MCP Server** → paste the **Mem0 MCP URL** + API key.
- [ ] Make sure the Mem0 tools receive **`user_id = {{student_id}}`** (the dynamic variable the app passes).
      This is what keys each student's memory. Without it, memory won't separate students.

### 2b. Add Exa (web search)
- [ ] Add Exa as a tool (MCP or custom tool) with the `EXA_API_KEY`. The prompts already tell the agent
      to use it sparingly.

### 2c. Post-call webhook
- [ ] Agent → Webhooks → add a **post-call transcription** webhook →
      `https://<PROJECT-REF>.functions.supabase.co/elevenlabs-postcall`
- [ ] (Optional) add the **post-call audio** webhook to the same URL to bank recordings.
- [ ] Copy the **signing secret** ElevenLabs shows → `ELEVENLABS_WEBHOOK_SECRET`.

---

## 3. Deploy the webhook
From the repo root, with the Supabase CLI linked to your project:
```bash
supabase functions deploy elevenlabs-postcall --no-verify-jwt
supabase secrets set MEM0_API_KEY=...            # from ~/.isomo/voiceai.env
supabase secrets set ELEVENLABS_WEBHOOK_SECRET=... # from step 2c
```
(`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)
See `webhook/README.md` for detail.

---

## 4. Build the app (Lovable)
1. [ ] New Lovable project → paste **`app/BUILD_PROMPT.md`**.
2. [ ] Connect it to your **Supabase project** (don't recreate tables — they exist).
3. [ ] Set env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ELEVENLABS_AGENT_ID`.
4. [ ] Confirm the agent embed passes the logged-in **Supabase UID as the `student_id`** dynamic variable.
5. [ ] Publish. Note the app URL — this is what students open on their laptops.

---

## 5. Verify end-to-end (do this before students)
- [ ] Sign in to the app with a test Google account → consent card shows once.
- [ ] Launch a conversation, talk for a minute, end it.
- [ ] In Supabase: a row appears in **`sessions`** with `student_talk_seconds` filled, and a row in
      **`memory_snapshots`**. If audio webhook is on, `recording_url` is set.
- [ ] Start a *second* conversation with the same account → the agent should recall something
      from the first (memory working).
- [ ] Promote yourself to facilitator to see the dashboard:
      `update students set role='facilitator' where display_name = 'Your Name';`

---

## 6. Daily operation (during the pilot)
- [ ] **Each morning:** open the ElevenLabs agent → replace the system prompt with that day's
      `agent/prompts/Session_NN_*.txt`. (Optional: set `session_no` and `topic` dynamic variables so
      the webhook logs them.)
- [ ] On assessment days, point students at the **assessment agent**
      (`agent/assessment/Assessment_Speaking_Task.txt`) instead.

---

## 7. Week-0 onboarding (the cohort's first day)
- [ ] Each student signs in with Google on their laptop, accepts consent.
- [ ] Facilitator tags each student's **cohort** (base / foundation) in the dashboard.
- [ ] Run the **baseline**: agent speaking task (recorded) + DET free practice + the confidence
      questionnaire. Enter rubric/DET scores into the dashboard.

---

## 8. Before go-live checklist
- [ ] `ELEVENLABS_WEBHOOK_SECRET` is set (signature verification on).
- [ ] API keys **rotated** once (they passed through setup) — update them in each dashboard + `~/.isomo/voiceai.env`.
- [ ] Consent card live; `recordings` retention understood (kept for the training corpus).
- [ ] Bandwidth checked for the number of **concurrent** students in the lab.
- [ ] A second facilitator briefed to double-rate ~10 speaking recordings for reliability.
