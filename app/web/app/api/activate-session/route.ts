import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { SESSIONS } from "@/lib/sessions-data";
import { checkSameOrigin } from "@/lib/csrf";

const AGENT_ID =
  process.env.ELEVENLABS_AGENT_ID ??
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

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

  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not set" },
      { status: 500 },
    );
  }
  if (!AGENT_ID) {
    return NextResponse.json(
      { error: "ELEVENLABS_AGENT_ID not set" },
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
  const sessionNo = Number(body.session_no);
  if (!sessionNo || sessionNo < 1 || sessionNo > 24) {
    return NextResponse.json(
      { error: "session_no must be 1..24" },
      { status: 400 },
    );
  }

  const session = SESSIONS.find((s) => s.no === sessionNo);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  // PATCH the agent's system prompt on ElevenLabs.
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
          agent: {
            prompt: { prompt: session.prompt },
          },
        },
      }),
    },
  );

  if (!elRes.ok) {
    const text = await elRes.text();
    return NextResponse.json(
      { error: "ElevenLabs PATCH failed", status: elRes.status, body: text.slice(0, 300) },
      { status: 502 },
    );
  }

  // Record the activation in pilot_config (service-role bypasses RLS).
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { error: cfgErr } = await admin
    .from("pilot_config")
    .update({
      active_session_no: sessionNo,
      activated_at: new Date().toISOString(),
      activated_by: user.id,
    })
    .eq("id", 1);

  await supabase.rpc("log_audit", {
    p_action: "session_activated",
    p_target_id: String(sessionNo),
    p_details: { title: session.title },
  });

  return NextResponse.json({
    ok: true,
    active_session_no: sessionNo,
    title: session.title,
    config_error: cfgErr?.message ?? null,
  });
}
