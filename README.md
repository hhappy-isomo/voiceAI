# Isomo Voice AI

A 6-week conversational-English pilot for Year 1 Academy students in Rwanda. Students
talk to an AI "Thinking Partner" that pushes them to express themselves, tell stories,
and debate — building spoken fluency and confidence. Built on ElevenLabs (voice agent),
Mem0 (per-student memory), Exa (web search), and Supabase (auth, data, monitoring).

## Architecture

```
Student (Google login) ──> Web app (Supabase Auth) ──> Embedded ElevenLabs agent
                                  │                              │
                                  │ UID = student_id             ├─ Exa  (web search tool)
                                  │                              └─ Mem0 (memory, keyed by UID)
                                  ▼
                            Supabase / Postgres  <── post-call webhook (talk-time, transcript, memory snapshot)
                                  │
                                  └─ Facilitator dashboard (progress, flags, the 6 metrics)
```

- **One ElevenLabs agent.** The facilitator swaps the day's session prompt each morning
  (24 sessions over 6 weeks). Memory continuity keys off the stable student UID, so the
  prompt can change daily without losing the thread.
- **Identity:** Supabase Auth with Google sign-in. The Supabase UID is the universal key
  passed to the agent as a dynamic variable and used as the Mem0 `user_id`. Only the
  opaque UID reaches the agent/Mem0/Exa. The student's email never leaves Supabase;
  their Google `full_name` (if set) is stored as `display_name` so facilitators can
  recognise students in the dashboard — it's never sent to the agent.
- **Memory:** Mem0 cloud MCP for the pilot; self-hosted OpenMemory MCP at scale.

## Repo layout

| Path | What |
|------|------|
| `agent/prompts/` | The 24 standalone session system prompts (paste one per day) |
| `agent/build_prompts.py` | Regenerates all 24 prompts from one template + per-session data |
| `agent/system-prompts.txt` | Reference master prompts (design artifact — the pilot runs one ElevenLabs agent) |
| `agent/content-pack.md` | The 24 themes (provocations, push moves, compose tasks) |
| `db/01_schema.sql` | Supabase tables + the monitoring views (incl. the 6 metrics) |
| `db/02_auth.sql` | Google-auth wiring, roles, row-level security |
| `app/` | The student portal + facilitator dashboard (build prompt) |
| `webhook/` | Post-call webhook (Supabase Edge Function): transcripts, talk-time, memory snapshots, recording capture |
| `docs/` | Board materials: scope & sequence, success metrics, build spec, questionnaire |

## Setup order

1. Create a Supabase project → run `db/01_schema.sql`, then `db/02_auth.sql`,
   then the remaining migrations in order (`db/03..11_*.sql`). In the Supabase
   dashboard, create a Storage bucket named `recordings` and set it to PRIVATE
   (the webhook stores paths; the app mints signed URLs on demand).
2. Enable Google provider in Supabase Auth.
3. Create the ElevenLabs agent → paste `agent/prompts/Session_01_*.txt`, set voice.
4. Add Mem0 as a Custom MCP Server in ElevenLabs; map the `student_id` dynamic variable
   to the Mem0 `user_id` tool parameter.
5. Add Exa as a web-search tool.
6. Build the app (`app/`) → embed the agent, pass the logged-in UID as `student_id`.
7. Deploy the post-call webhook (`webhook/`).

> Secrets live in a local `.env` only (gitignored). Never commit API keys.
