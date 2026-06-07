import { NextResponse } from "next/server";
import { requireSuperadminApi } from "@/lib/superadmin-guard";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/admin";
import { SESSIONS } from "@/lib/sessions-data";

const EL = "https://api.elevenlabs.io/v1/convai/agents";

export async function POST(req: Request) {
  const guard = await requireSuperadminApi();
  if (!guard.ok) return guard.response;
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });
  }
  const body = await req.json().catch(() => ({}));
  const sessionNo = Number(body.session_no);
  if (!sessionNo || sessionNo < 1 || sessionNo > 24) {
    return NextResponse.json({ error: "session_no 1..24" }, { status: 400 });
  }
  const session = SESSIONS.find((s) => s.no === sessionNo);
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  // List all agents
  const listRes = await fetch(`${EL}?page_size=100`, {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    cache: "no-store",
  });
  if (!listRes.ok) return NextResponse.json({ error: "list failed" }, { status: 502 });
  const list = await listRes.json();
  const agents = (list.agents ?? []) as Array<{ agent_id: string; name: string }>;

  let succeeded = 0;
  let failed = 0;
  const results: { agent_id: string; ok: boolean; status: number }[] = [];

  for (const a of agents) {
    const r = await fetch(`${EL}/${a.agent_id}`, {
      method: "PATCH",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversation_config: { agent: { prompt: { prompt: session.prompt } } },
      }),
    });
    if (r.ok) succeeded++;
    else failed++;
    results.push({ agent_id: a.agent_id, ok: r.ok, status: r.status });
  }

  const admin = adminClient();
  await admin.from("master_prompt_events").insert({
    session_no: sessionNo,
    agents_count: agents.length,
    succeeded,
    failed,
    by_user: guard.userId,
  });
  await admin.from("pilot_config").update({
    active_session_no: sessionNo,
    activated_at: new Date().toISOString(),
    activated_by: guard.userId,
  }).eq("id", 1);

  const supabase = await createServerClient();
  await supabase.rpc("log_audit", {
    p_action: "master_prompt_push",
    p_target_id: String(sessionNo),
    p_details: { title: session.title, agents: agents.length, succeeded, failed },
  });

  return NextResponse.json({ ok: true, agents: agents.length, succeeded, failed, results });
}
