import { NextResponse } from "next/server";
import { requireSuperadminApi } from "@/lib/superadmin-guard";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/admin";
import { checkSameOrigin } from "@/lib/csrf";

export async function GET() {
  const guard = await requireSuperadminApi();
  if (!guard.ok) return guard.response;
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });
  }
  const [elRes, dbRes] = await Promise.all([
    fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
      cache: "no-store",
    }),
    (async () => {
      const supabase = await createServerClient();
      return supabase.from("approved_voices").select("voice_id, voice_name, notes");
    })(),
  ]);
  if (!elRes.ok) return NextResponse.json({ error: "list failed" }, { status: 502 });
  const el = await elRes.json();
  return NextResponse.json({ voices: el.voices ?? [], approved: dbRes.data ?? [] });
}

export async function POST(req: Request) {
  const csrf = checkSameOrigin(req);
  if (csrf) return csrf;
  const guard = await requireSuperadminApi();
  if (!guard.ok) return guard.response;
  const body = await req.json().catch(() => ({}));
  const voiceId = String(body.voice_id ?? "");
  const voiceName = String(body.voice_name ?? "");
  const approve = body.approve !== false;
  if (!voiceId) return NextResponse.json({ error: "voice_id required" }, { status: 400 });

  const admin = adminClient();
  if (approve) {
    const { error } = await admin
      .from("approved_voices")
      .upsert({
        voice_id: voiceId,
        voice_name: voiceName,
        approved_by: guard.userId,
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("approved_voices")
      .delete()
      .eq("voice_id", voiceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const supabase = await createServerClient();
  await supabase.rpc("log_audit", {
    p_action: approve ? "voice_approve" : "voice_unapprove",
    p_target_id: voiceId,
    p_details: { voice_name: voiceName },
  });
  return NextResponse.json({ ok: true });
}
