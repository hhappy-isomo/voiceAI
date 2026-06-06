# Deployment record

Live resource identifiers for the pilot. **No secrets here** — API keys, DB password, and the
webhook signing secret live only in `~/.isomo/voiceai.env` (chmod 600, never committed).

_Last updated: 2026-06-06._

## Supabase (project `buuyfdjpupolvvocdzna`)
- URL: `https://buuyfdjpupolvvocdzna.supabase.co`
- Schema + auth migrations: **applied** (`db/01_schema.sql`, `db/02_auth.sql`)
- Google sign-in: **enabled**
- Storage bucket: `recordings` (private) — **created**
- Edge Function: `elevenlabs-postcall` — **deployed, Verify-JWT OFF, tested**
  - URL: `https://buuyfdjpupolvvocdzna.supabase.co/functions/v1/elevenlabs-postcall`

## ElevenLabs (tier: free — upgrade before the real pilot)
- Agent: **`agent_0801ktfcddbaekmay4yjbgzcw7hp`** ("Isomo Thinking Partner")
  - Voice: Sarah (`EXAVITQu4vr4xnSDxMaL`) · language `en` · max duration 1320s
  - System prompt: swap `agent/prompts/Session_NN_*.txt` each day (currently Session 01)
- Tools attached:
  - `search_memories` → `tool_0401ktfcs6k0fqnv3q3x0bwbkamq` (Mem0 v1 search; `user_id` bound to `student_id` dynamic var)
  - `web_search` → `tool_9101ktfcs784eyfaa7v9etdkkm2e` (Exa `/answer`)
- Post-call webhook: workspace webhook `8028c036c1d04eda9ad40ce91c937592` → the Edge Function URL above
  - signing secret stored in `~/.isomo/voiceai.env` as `ELEVENLABS_WEBHOOK_SECRET`

## Memory architecture
- **Read:** agent calls `search_memories` at session start (Mem0, keyed by `student_id`).
- **Write:** the post-call webhook posts the transcript to Mem0 (`mem0Add`) + snapshots to `memory_snapshots`.
- MCP is disabled on the free tier; everything above uses native tools instead.

## Remaining before go-live
- [ ] Build the app in Lovable (`app/BUILD_PROMPT.md`) — pass Supabase UID as `student_id` dynamic var.
- [ ] Add `ELEVENLABS_WEBHOOK_SECRET` to the Edge Function secrets (turns on signature verification).
- [ ] Upgrade ElevenLabs off the free tier (10k-char cap won't survive the cohort).
- [ ] Set Supabase Auth → URL Configuration → Site URL to the published app URL.
