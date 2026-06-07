import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Best-effort end. ElevenLabs Convai doesn't expose a "kill active session"
// API — the browser holds the websocket. We can DELETE the conversation
// record (post-fact cleanup) but cannot force-terminate a live call.

export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({}));
  const conversationId = String(body.conversation_id ?? "");
  if (!conversationId) {
    return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
  }

  const elRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
    {
      method: "DELETE",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    },
  );

  await supabase.rpc("log_audit", {
    p_action: "end_conversation",
    p_target_id: conversationId,
    p_details: { http_status: elRes.status },
  });

  if (!elRes.ok) {
    return NextResponse.json(
      { error: `ElevenLabs DELETE failed`, status: elRes.status },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
