// Isomo Voice AI - ElevenLabs post-call webhook (Supabase Edge Function, Deno).
//
// Handles two ElevenLabs webhook types:
//   post_call_transcription -> writes a `sessions` row (talk-time, duration) + a Mem0 memory snapshot
//   post_call_audio         -> stores the recording in a PRIVATE Supabase Storage bucket
//                              and stores its PATH in sessions.recording_url
//                              (the dashboard signs a short-lived URL on demand)
//
// Required secrets (supabase secrets set ...):
//   MEM0_API_KEY              - to snapshot what the tutor remembers
//   ELEVENLABS_WEBHOOK_SECRET - REQUIRED. Set to verify signatures.
//                               Set WEBHOOK_DEV_BYPASS=1 to skip for local only.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// IMPORTANT manual step: in the Supabase dashboard, set the `recordings`
// bucket to PRIVATE. The webhook stores paths; signed URLs are minted in-app.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const MEM0_API_KEY = Deno.env.get("MEM0_API_KEY");
const WEBHOOK_SECRET = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");
const WEBHOOK_DEV_BYPASS = Deno.env.get("WEBHOOK_DEV_BYPASS") === "1";
const RECORDINGS_BUCKET = "recordings";

// ---- helpers ---------------------------------------------------------------

// Constant-time equal for hex strings of equal length.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verify ElevenLabs HMAC signature header: "t=<ts>,v0=<hex>" over `${ts}.${body}`.
// Default-closed: returns false if no secret is configured. Use
// WEBHOOK_DEV_BYPASS=1 to opt out for local testing only.
async function verify(rawBody: string, header: string | null): Promise<boolean> {
  if (WEBHOOK_DEV_BYPASS) return true;
  if (!WEBHOOK_SECRET) return false;
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2)));
  const t = parts["t"], v0 = parts["v0"];
  if (!t || !v0) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, v0);
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

// Read the configurable "silent session" threshold via the SECURITY DEFINER
// RPC. Falls back to 600s if the RPC is missing (migration not yet applied).
async function lowTalkThreshold(): Promise<number> {
  const { data, error } = await supabase.rpc("get_low_talk_threshold");
  if (error || typeof data !== "number") return 600;
  return data;
}

// Pull the student's current memories from Mem0 and fold them into one summary string.
async function mem0Summary(studentId: string): Promise<string | null> {
  if (!MEM0_API_KEY) return null;
  try {
    const r = await fetch(
      `https://api.mem0.ai/v1/memories?user_id=${encodeURIComponent(studentId)}`,
      {
        headers: { Authorization: `Token ${MEM0_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      },
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

// Write the conversation into Mem0 so the student's memory grows each session.
async function mem0Add(studentId: string, transcript: any[]): Promise<void> {
  if (!MEM0_API_KEY) return;
  const messages = transcript
    .filter((t) => t?.message)
    .map((t) => ({ role: t.role === "agent" ? "assistant" : "user", content: t.message }));
  if (!messages.length) return;
  try {
    await fetch("https://api.mem0.ai/v1/memories/", {
      method: "POST",
      headers: { Authorization: `Token ${MEM0_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages, user_id: studentId }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (_e) { /* best-effort */ }
}

function dynamicVars(data: any): Record<string, any> {
  return data?.conversation_initiation_client_data?.dynamic_variables ?? data?.dynamic_variables ?? {};
}

// Run `task` after we've returned the response to ElevenLabs. Uses
// Supabase Edge Function's `EdgeRuntime.waitUntil` when available so the
// runtime keeps the worker alive; falls back to fire-and-forget.
function background(task: Promise<unknown>): void {
  const er = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(task.catch(() => {}));
  else task.catch(() => {});
}

// ---- handler ---------------------------------------------------------------

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!(await verify(raw, req.headers.get("ElevenLabs-Signature")))) {
    // 401 if a signature was attempted but invalid; 503 if simply unconfigured.
    if (!WEBHOOK_SECRET && !WEBHOOK_DEV_BYPASS) {
      return new Response("webhook secret not configured", { status: 503 });
    }
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
        // Store the storage PATH (not a URL). Dashboard mints a signed URL
        // on demand via lib/recordings.ts.
        await supabase.from("sessions").update({ recording_url: path })
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

    const threshold = await lowTalkThreshold();
    const flagged = talk > 0 && talk < threshold;

    const { error } = await supabase.from("sessions").upsert({
      student_id: studentId,
      session_no: sessionNo,
      duration_seconds: callDuration,
      student_talk_seconds: talk,
      flagged_low_talk: flagged,
      topic,
      conversation_id: conversationId,
    }, { onConflict: "conversation_id" });
    if (error) console.error("session upsert error", error);

    // Don't block the 200 — Mem0 calls happen after we reply.
    background((async () => {
      await mem0Add(studentId, transcript);
      const summary = await mem0Summary(studentId);
      if (summary) {
        await supabase.from("memory_snapshots").insert({ student_id: studentId, summary });
      }
    })());

    return new Response("ok", { status: 200 });
  }

  return new Response("ignored", { status: 200 });
});
