import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/admin";
import { checkBudget } from "@/lib/cost-guard";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { checkSameOrigin } from "@/lib/csrf";

// Fallback ElevenLabs Conversational AI cost per second, used only when the
// detail response omits metadata.cost. (Creator tier ≈ $0.08–0.10/min.)
const EL_COST_PER_SEC = 0.0015;

type EConv = {
  conversation_id: string;
  agent_id?: string;
  start_time_unix_secs?: number;
  call_duration_secs?: number;
  message_count?: number;
  status?: string;
};

type EConvDetail = {
  conversation_id: string;
  call_duration_secs?: number;
  conversation_initiation_client_data?: {
    dynamic_variables?: Record<string, unknown>;
  };
  metadata?: {
    cost?: number;
    total_cost?: number;
    call_duration_secs?: number;
    start_time_unix_secs?: number;
  };
};

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

  // Kill switch still applies to sync (it touches the ElevenLabs API);
  // drain_mode does not — sync just records what already happened.
  const adminEarly = adminClient();

  // Rate limit: 5 syncs per minute globally. Stops accidental refresh
  // hammering and keeps us well under ElevenLabs' API limits.
  const rl = await rateLimit(adminEarly, "sync-usage:global", 5, 60);
  if (!rl.allowed) return rateLimitResponse(rl);

  const guard = await checkBudget(adminEarly);
  if (!guard.ok && guard.reason === "kill_all") {
    return NextResponse.json(
      { error: guard.reason, detail: guard.detail },
      { status: guard.status },
    );
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not set" },
      { status: 500 },
    );
  }

  // 1) List recent conversations.
  const listRes = await fetch(
    "https://api.elevenlabs.io/v1/convai/conversations?page_size=100",
    { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY }, cache: "no-store" },
  );
  if (!listRes.ok) {
    return NextResponse.json(
      { error: "ElevenLabs list failed", status: listRes.status },
      { status: 502 },
    );
  }
  const listJson = (await listRes.json()) as { conversations?: EConv[] };
  const convs = listJson.conversations ?? [];

  // Pre-load the set of real student_ids so we can null-out FK violations
  // (e.g. the dev-bypass placeholder UUID) before they error the upsert.
  const admin = adminEarly;
  const { data: studentRows } = await admin
    .from("students")
    .select("student_id");
  const realStudentIds = new Set((studentRows ?? []).map((r) => r.student_id));

  let inserted = 0;
  let skipped = 0;
  let untagged = 0;
  const errors: string[] = [];

  for (const c of convs) {
    if (!c.conversation_id) {
      skipped++;
      continue;
    }
    const detailRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${c.conversation_id}`,
      { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY }, cache: "no-store" },
    );
    if (!detailRes.ok) {
      skipped++;
      errors.push(`${c.conversation_id}: detail ${detailRes.status}`);
      continue;
    }
    const detail = (await detailRes.json()) as EConvDetail;

    const rawSid =
      (detail.conversation_initiation_client_data?.dynamic_variables
        ?.student_id as string | undefined) ?? null;
    // Only attribute if the id actually exists in students. Otherwise treat
    // as untagged (the dev-bypass placeholder, public ElevenLabs share-link
    // hits, and stale ids all fall here.)
    const sid = rawSid && realStudentIds.has(rawSid) ? rawSid : null;
    if (!sid) untagged++;

    // Duration: detail top-level is often null; check metadata, then list.
    const dur =
      detail.call_duration_secs ??
      detail.metadata?.call_duration_secs ??
      c.call_duration_secs ??
      0;
    // Prefer ElevenLabs' authoritative cost when present; fall back to
    // the per-second estimate. metadata.cost is in USD on recent API
    // versions; some older payloads use total_cost.
    const reportedCost =
      typeof detail.metadata?.cost === "number"
        ? detail.metadata.cost
        : typeof detail.metadata?.total_cost === "number"
          ? detail.metadata.total_cost
          : null;
    const cost = reportedCost ?? dur * EL_COST_PER_SEC;

    const { error } = await admin.from("usage_log").upsert(
      {
        source: "elevenlabs",
        units: dur,
        cost_usd: cost,
        student_id: sid,
        external_id: c.conversation_id,
        meta: {
          duration_secs: dur,
          message_count: c.message_count,
          status: c.status,
          raw_student_id: rawSid,
          cost_source: reportedCost != null ? "reported" : "estimate",
        },
      },
      { onConflict: "source,external_id" },
    );
    if (error) {
      skipped++;
      errors.push(`${c.conversation_id}: ${error.message}`);
    } else {
      inserted++;
    }
  }

  await supabase.rpc("log_audit", {
    p_action: "sync_usage",
    p_target_id: null,
    p_details: { conversations: convs.length, inserted, skipped, untagged, errors: errors.slice(0, 5) },
  });

  return NextResponse.json({
    ok: true,
    conversations: convs.length,
    inserted,
    skipped,
    untagged,
    errors: errors.slice(0, 5),
  });
}
