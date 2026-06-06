// Isomo Voice AI - ElevenLabs post-call webhook (Supabase Edge Function, Deno).
//
// Handles two ElevenLabs webhook types:
//   post_call_transcription -> writes a `sessions` row (talk-time, duration) + a Mem0 memory snapshot
//   post_call_audio         -> stores the recording in Supabase Storage, links it on the session row
//
// Secrets to set (supabase secrets set ...):
//   MEM0_API_KEY                 - to snapshot what the tutor remembers
//   ELEVENLABS_WEBHOOK_SECRET    - to verify the signature (optional but recommended)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const MEM0_API_KEY = Deno.env.get("MEM0_API_KEY");
const WEBHOOK_SECRET = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");
const RECORDINGS_BUCKET = "recordings";

// ---- helpers ---------------------------------------------------------------

// Verify ElevenLabs HMAC signature header: "t=<ts>,v0=<hex>" over `${ts}.${body}`.
async function verify(rawBody: string, header: string | null): Promise<boolean> {
  if (!WEBHOOK_SECRET) return true;            // not configured yet -> allow (set it before go-live)
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = parts["t"], v0 = parts["v0"];
  if (!t || !v0) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === v0;
}

// Estimate how long the student (role 'user') spoke, from turn timestamps.
// A turn's length ~= next turn's start - this turn's start; last turn runs to call end.
function userTalkSeconds(transcript: any[], callDuration: number): number {
  let total = 0;
  for (let i = 0; i < transcript.length; i++) {
    const start = transcript[i]?.time_in_call_secs ?? 0;
    const end = transcript[i + 1]?.time_in_call_secs ?? callDuration ?? start;
    if (transcript[i]?.role === "user") total += Math.max(0, end - start);
  }
  return Math.round(total);
}

// Pull the student's current memories from Mem0 and fold them into one summary string.
async function mem0Summary(studentId: string): Promise<string | null> {
  if (!MEM0_API_KEY) return null;
  try {
    const r = await fetch(
      `https://api.mem0.ai/v1/memories/?user_id=${encodeURIComponent(studentId)}`,
      { headers: { Authorization: `Token ${MEM0_API_KEY}` } },
    );
    if (!r.ok) return null;
    const data = await r.json();
    const items = Array.isArray(data) ? data : (data?.results ?? []);
    const text = items.map((m: any) => m.memory ?? m.text ?? "").filter(Boolean).join(" | ");
    return text ? text.slice(0, 4000) : null;
  } catch (_e) {
    return null;
  }
}

function dynamicVars(data: any): Record<string, any> {
  return data?.conversation_initiation_client_data?.dynamic_variables ?? data?.dynamic_variables ?? {};
}

// ---- handler ---------------------------------------------------------------

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!(await verify(raw, req.headers.get("ElevenLabs-Signature")))) {
    return new Response("bad signature", { status: 401 });
  }

  const body = JSON.parse(raw);
  const type = body?.type;
  const data = body?.data ?? {};
  const conversationId = data?.conversation_id;

  // ---- AUDIO: bank the recording for the training corpus -------------------
  if (type === "post_call_audio") {
    const b64 = data?.full_audio ?? data?.audio;
    if (b64 && conversationId) {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `${conversationId}.mp3`;
      const up = await supabase.storage.from(RECORDINGS_BUCKET)
        .upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
      if (!up.error) {
        const { data: pub } = supabase.storage.from(RECORDINGS_BUCKET).getPublicUrl(path);
        await supabase.from("sessions").update({ recording_url: pub.publicUrl })
          .eq("conversation_id", conversationId);
      }
    }
    return new Response("ok", { status: 200 });
  }

  // ---- TRANSCRIPT: write the session row + memory snapshot -----------------
  if (type === "post_call_transcription") {
    const vars = dynamicVars(data);
    const studentId = vars["student_id"];
    if (!studentId) {
      console.error("no student_id in dynamic_variables; skipping", conversationId);
      return new Response("no student_id", { status: 200 }); // 200 so EL doesn't retry forever
    }
    const transcript = data?.transcript ?? [];
    const callDuration = data?.metadata?.call_duration_secs ?? 0;
    const talk = userTalkSeconds(transcript, callDuration);
    const sessionNo = vars["session_no"] ? Number(vars["session_no"]) : null;
    const topic = vars["topic"] ?? null;

    const { error } = await supabase.from("sessions").upsert({
      student_id: studentId,
      session_no: sessionNo,
      duration_seconds: callDuration,
      student_talk_seconds: talk,
      topic,
      conversation_id: conversationId,
    }, { onConflict: "conversation_id" });
    if (error) console.error("session upsert error", error);

    const summary = await mem0Summary(studentId);
    if (summary) {
      await supabase.from("memory_snapshots").insert({ student_id: studentId, summary });
    }
    return new Response("ok", { status: 200 });
  }

  return new Response("ignored", { status: 200 });
});
