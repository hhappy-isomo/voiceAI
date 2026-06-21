import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { SESSIONS } from "@/lib/sessions-data";

// Daily auto-activate hit by the Supabase pg_cron job from db/15_daily_activate.sql.
//   - Header: X-Cron-Secret must match cron_settings.cron_secret
//   - Body: { session_no: number }
// On success: PATCH the ElevenLabs agent with the session prompt + update
// pilot_config. On failure: write a master_prompt_events row with succeeded=0.
//
// CSRF check intentionally skipped — this is server-to-server, the secret IS
// the auth.

const AGENT_ID =
  process.env.ELEVENLABS_AGENT_ID ??
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

export async function POST(req: Request) {
  const provided = req.headers.get("X-Cron-Secret");
  const admin = adminClient();

  const { data: cfg } = await admin
    .from("cron_settings")
    .select("cron_secret, enabled")
    .eq("id", 1)
    .maybeSingle();

  if (!cfg?.enabled || !cfg.cron_secret) {
    return NextResponse.json({ error: "cron disabled" }, { status: 503 });
  }
  if (!provided || provided !== cfg.cron_secret) {
    return NextResponse.json({ error: "bad cron secret" }, { status: 401 });
  }
  if (!process.env.ELEVENLABS_API_KEY || !AGENT_ID) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY or AGENT_ID not set" },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const sessionNo = Number(body.session_no);
  if (!sessionNo || sessionNo < 1 || sessionNo > 24) {
    await admin.from("master_prompt_events").insert({
      session_no: null,
      agents_count: 0,
      succeeded: 0,
      failed: 1,
    });
    return NextResponse.json(
      { error: "session_no must be 1..24" },
      { status: 400 },
    );
  }

  const session = SESSIONS.find((s) => s.no === sessionNo);
  if (!session) {
    await admin.from("master_prompt_events").insert({
      session_no: sessionNo,
      agents_count: 0,
      succeeded: 0,
      failed: 1,
    });
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const elRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`,
    {
      method: "PATCH",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversation_config: {
          agent: { prompt: { prompt: session.prompt } },
        },
      }),
    },
  );

  if (!elRes.ok) {
    const text = await elRes.text();
    await admin.from("master_prompt_events").insert({
      session_no: sessionNo,
      agents_count: 1,
      succeeded: 0,
      failed: 1,
    });
    return NextResponse.json(
      { error: "ElevenLabs PATCH failed", status: elRes.status, body: text.slice(0, 300) },
      { status: 502 },
    );
  }

  await admin
    .from("pilot_config")
    .update({
      active_session_no: sessionNo,
      activated_at: new Date().toISOString(),
      activated_by: null, // cron, not a user
    })
    .eq("id", 1);

  await admin.from("master_prompt_events").insert({
    session_no: sessionNo,
    agents_count: 1,
    succeeded: 1,
    failed: 0,
  });

  await admin.rpc("log_audit", {
    p_action: "session_activated_cron",
    p_target_id: String(sessionNo),
    p_details: { title: session.title, source: "cron" },
  });

  return NextResponse.json({
    ok: true,
    active_session_no: sessionNo,
    title: session.title,
  });
}
