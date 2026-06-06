# Post-call webhook

A Supabase Edge Function that catches every finished ElevenLabs call and:
- writes a row into `sessions` (student talk-time → Metric 1, duration, topic, conversation id),
- snapshots what Mem0 remembers about the student into `memory_snapshots`,
- (audio webhook) banks the recording into Supabase Storage and links it on the session row.

## What it reads from the call
- `student_id` and (optional) `session_no`, `topic` from the conversation's **dynamic variables**
  (the app passes `student_id` = the student's Supabase UID; you can set `session_no`/`topic` on the
  agent each day).
- `transcript` (per-turn `role` + `time_in_call_secs`) and `metadata.call_duration_secs` — used to
  estimate how long the student spoke.

## Deploy
```bash
# from the repo root, with the Supabase CLI linked to your project:
supabase functions deploy elevenlabs-postcall --no-verify-jwt

# secrets (values live in ~/.isomo/voiceai.env):
supabase secrets set MEM0_API_KEY=...            # enables memory snapshots
supabase secrets set ELEVENLABS_WEBHOOK_SECRET=... # from ElevenLabs when you create the webhook
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
```
`--no-verify-jwt` is required: ElevenLabs calls this with its own signature, not a Supabase JWT.
The function verifies the ElevenLabs signature itself.

## Storage (for recordings)
Create a Storage bucket named **`recordings`** in Supabase (private is fine; the function writes with
the service role). Skip this if you don't want to bank audio yet.

## Wire it up in ElevenLabs
1. Agent settings → Webhooks → add a **post-call transcription** webhook pointing at the function URL:
   `https://<project-ref>.functions.supabase.co/elevenlabs-postcall`
2. (Optional) add the **post-call audio** webhook to the same URL to bank recordings.
3. Copy the signing secret ElevenLabs gives you into `ELEVENLABS_WEBHOOK_SECRET`.

## Note
Until `ELEVENLABS_WEBHOOK_SECRET` is set, the function skips signature checks so you can test — set
it before go-live.
