import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/admin";
import { RUBRIC_SYSTEM, parseRubric } from "@/lib/rubric";
import { checkBudget } from "@/lib/cost-guard";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { computeAnthropicCost, type Usage } from "@/lib/anthropic-cost";
import { checkSameOrigin } from "@/lib/csrf";

const MODEL = "claude-sonnet-4-6";

// SSRF guard: only fetch transcripts from ElevenLabs-controlled hosts.
const TRANSCRIPT_HOST_ALLOWLIST = [
  "api.elevenlabs.io",
  "storage.elevenlabs.io",
  "elevenlabs.io",
];

function isAllowedTranscriptUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return TRANSCRIPT_HOST_ALLOWLIST.some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const csrf = checkSameOrigin(req);
  if (csrf) return csrf;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: me } = await supabase
    .from("students")
    .select("role")
    .eq("student_id", user.id)
    .single();
  if (me?.role !== "facilitator" && me?.role !== "superadmin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set" },
      { status: 500 },
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = Number(body.session_id);
  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, student_id, transcript_url")
    .eq("id", sessionId)
    .single();
  if (sErr || !session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (!session.transcript_url) {
    return NextResponse.json(
      { error: "session has no transcript_url" },
      { status: 422 },
    );
  }
  if (!isAllowedTranscriptUrl(session.transcript_url)) {
    return NextResponse.json(
      { error: "transcript_url host not allowlisted" },
      { status: 422 },
    );
  }

  const admin = adminClient();

  // Rate limit: 20 rubric runs per facilitator per 5 minutes. Cost cap
  // is the hard ceiling; this just stops a runaway loop from blowing
  // through it in a single second.
  const rl = await rateLimit(admin, `auto-rubric:${user.id}`, 20, 300);
  if (!rl.allowed) return rateLimitResponse(rl);

  // Cost cap pre-flight. Estimate one Sonnet call ~ $0.05 worst case.
  const guard = await checkBudget(admin, {
    studentId: session.student_id,
    estimatedCostUsd: 0.05,
  });
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason, detail: guard.detail },
      { status: guard.status },
    );
  }

  const transcript = await fetchTranscript(session.transcript_url);
  if (!transcript) {
    return NextResponse.json(
      { error: "could not fetch transcript" },
      { status: 502 },
    );
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const completion = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: [
      {
        type: "text",
        text: RUBRIC_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Score this transcript:\n\n${transcript}`,
      },
    ],
  });

  const block = completion.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    return NextResponse.json({ error: "no text from model" }, { status: 502 });
  }

  let rubric;
  try {
    rubric = parseRubric(block.text);
  } catch {
    return NextResponse.json(
      { error: "could not parse model output", raw: block.text },
      { status: 502 },
    );
  }

  const { error: insertErr } = await admin.from("auto_rubric_scores").upsert(
    {
      session_id: sessionId,
      student_id: session.student_id,
      cefr: rubric.cefr,
      overall: rubric.overall,
      range_score: rubric.range,
      accuracy_score: rubric.accuracy,
      fluency_score: rubric.fluency,
      interaction_score: rubric.interaction,
      coherence_score: rubric.coherence,
      rationale: rubric.rationale,
      model: MODEL,
    },
    { onConflict: "session_id" },
  );

  const { cost, totalTokens, inTok, outTok, readTok, writeTok } =
    computeAnthropicCost(completion.usage as Usage);

  if (totalTokens > 0) {
    await admin.from("usage_log").upsert(
      {
        source: "anthropic",
        units: totalTokens,
        cost_usd: cost,
        student_id: session.student_id,
        external_id: `auto-rubric:${sessionId}`,
        meta: {
          model: MODEL,
          session_id: sessionId,
          input_tokens: inTok,
          output_tokens: outTok,
          cache_read: readTok,
          cache_write: writeTok,
        },
      },
      { onConflict: "source,external_id" },
    );
  }

  await supabase.rpc("log_audit", {
    p_action: "rubric_scored",
    p_target_id: String(sessionId),
    p_details: { cefr: rubric.cefr, overall: rubric.overall, cost_usd: cost },
  });

  return NextResponse.json({
    saved: !insertErr,
    error: insertErr?.message ?? null,
    rubric,
    cost_usd: cost,
    cache_hit_tokens: readTok,
  });
}

async function fetchTranscript(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "*/*" },
      signal: AbortSignal.timeout(10_000),
      redirect: "error", // don't follow redirects — they could leave the allowlist
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("json")) {
      const j = (await res.json()) as unknown;
      return extractText(j);
    }
    return (await res.text()).slice(0, 50000);
  } catch {
    return null;
  }
}

function extractText(j: unknown): string {
  if (typeof j === "string") return j.slice(0, 50000);
  if (Array.isArray(j)) {
    return j
      .map((x) => extractText(x))
      .filter(Boolean)
      .join("\n")
      .slice(0, 50000);
  }
  if (j && typeof j === "object") {
    const o = j as Record<string, unknown>;
    if (typeof o.text === "string") return o.text.slice(0, 50000);
    if (typeof o.transcript === "string") return o.transcript.slice(0, 50000);
    if (Array.isArray(o.segments)) {
      return (o.segments as Array<{ text?: string; speaker?: string }>)
        .map((s) => (s.speaker ? `${s.speaker}: ${s.text ?? ""}` : s.text ?? ""))
        .filter(Boolean)
        .join("\n")
        .slice(0, 50000);
    }
    if (Array.isArray(o.messages)) {
      return (o.messages as Array<{ text?: string; role?: string }>)
        .map((m) => (m.role ? `${m.role}: ${m.text ?? ""}` : m.text ?? ""))
        .filter(Boolean)
        .join("\n")
        .slice(0, 50000);
    }
  }
  return "";
}
