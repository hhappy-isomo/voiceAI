# Isomo Voice AI — Build Session Summary

**Date:** 2026-06-06
**Repo:** https://github.com/hhappy-isomo/voiceAI (local: `~/Desktop/voiceAI`)
**Outcome:** Went from a board brief to a tested, live backend + AI agent. Only the front-end app remains.

---

## 1. What we set out to do
Turn Isomo's "First Move on AI" brief into a working **6-week Voice AI English pilot**: students talk
to an AI "Thinking Partner" that pushes them to express themselves and debate, while the system
measures their growth.

## 2. Research (evidence base)
Ran a deep-research pass on how to build second-language fluency. Key findings:
- **Strongest, proven levers:** spaced retrieval + **pushed conversational output** (make them speak).
- **Affective gains** (confidence ↑, anxiety ↓) are the best-supported AI-tutor outcome; hard fluency
  gains are earlier-stage — so the pilot *tests* fluency rather than assuming it.
- Conversation > passive input. This shaped the whole agent design.

## 3. Key decisions (locked)
- **Agent:** ONE ElevenLabs agent; facilitator swaps the day's session prompt each morning.
- **Experience:** expression-first — real ideas, debate, storytelling; grammar is a *hidden* focus the
  agent recasts invisibly. 24 sessions arc from "The Story of You" → "Your Manifesto."
- **Identity:** Supabase Auth + **Google sign-in**; the user's UID is the universal key (passed to the
  agent as `student_id`, used as the Mem0 memory key). Email/name stay in Supabase only.
- **Memory:** Mem0. Read live via a `search_memories` tool; written automatically by the post-call webhook.
- **Web search:** Exa (`/answer`), used sparingly to sharpen debate.
- **Assessment:** internal agent-administered CEFR speaking rubric (pre/post) + DET free practice
  (external cross-check) + EF SET once at endline (external validation). IXL for grammar, a Google-Form
  questionnaire for confidence.
- **Consent:** one checkbox at first login (incl. training-use); recordings **kept** as a Rwandan-accented
  English training corpus. Heavy compliance parked for scale.

## 4. What we built (in the repo)
| Path | What |
|---|---|
| `agent/prompts/` | 24 standalone session prompts (Mem0 + Exa aware) |
| `agent/build_prompts.py` | regenerates all 24 from one template |
| `agent/assessment/` | standardized speaking-assessment prompt |
| `db/01_schema.sql`, `db/02_auth.sql` | tables + monitoring views + Google auth/RLS |
| `app/BUILD_PROMPT.md` | Lovable spec: student portal + facilitator dashboard |
| `webhook/elevenlabs-postcall/index.ts` | post-call webhook (talk-time, Mem0 write, recording bank) |
| `docs/` | scope & sequence (xlsx), success metrics, CEFR rubric, questionnaire, build spec |
| `README.md`, `SETUP.md`, `DEPLOYMENT.md` | architecture, setup steps, live-resource record |

## 5. What we stood up live (and tested)
- **Supabase** (`buuyfdjpupolvvocdzna`): schema + auth applied, Google sign-in on, `recordings` bucket created.
- **ElevenLabs agent** `agent_0801ktfcddbaekmay4yjbgzcw7hp`: Session 1 prompt, Sarah voice, `search_memories`
  (Mem0) + `web_search` (Exa) tools attached.
- **Webhook** deployed (`/functions/v1/elevenlabs-postcall`), Verify-JWT off, **registered** as the agent's
  post-call webhook. **End-to-end test passed** — a sample call wrote a `sessions` row with correct
  computed talk-time (585s) and grew Mem0.
- Full live-ID record in `DEPLOYMENT.md`.

## 6. What's left
1. **Build the app in Lovable** (`app/BUILD_PROMPT.md`) — the last big piece. Pass the Supabase UID as the
   `student_id` dynamic variable.
2. **Before go-live:** add `ELEVENLABS_WEBHOOK_SECRET` to the Edge Function secrets (turns on signature
   verification); set Supabase Auth Site URL to the published app URL.
3. **For the real pilot:** upgrade ElevenLabs off the free tier (10k-char cap; also unlocks MCP).
4. **Ops:** Week-0 onboarding, the 24-day calendar, lab bandwidth check, double-rating for the rubric.

## 7. Where the secrets live
All API keys, the DB password, Google client secret, and the webhook signing secret are in
**`~/.isomo/voiceai.env`** (chmod 600, never committed). Worth **rotating once before go-live** since they
passed through setup.
