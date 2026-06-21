import { NextResponse } from "next/server";
import { requireSuperadminApi } from "@/lib/superadmin-guard";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkSameOrigin } from "@/lib/csrf";

const EL = "https://api.elevenlabs.io/v1/convai/agents";

export async function GET() {
  const guard = await requireSuperadminApi();
  if (!guard.ok) return guard.response;
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });
  }
  const r = await fetch(`${EL}?page_size=100`, {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "list failed", status: r.status }, { status: 502 });
  const j = await r.json();
  return NextResponse.json(j);
}

export async function POST(req: Request) {
  const csrf = checkSameOrigin(req);
  if (csrf) return csrf;
  const guard = await requireSuperadminApi();
  if (!guard.ok) return guard.response;
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const prompt = String(body.prompt ?? "").trim();
  const firstMessage = String(body.first_message ?? "").trim();
  const voiceId = String(body.voice_id ?? "").trim() || undefined;
  const language = String(body.language ?? "en").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const payload: Record<string, unknown> = {
    name,
    conversation_config: {
      agent: {
        prompt: { prompt },
        first_message: firstMessage,
        language,
      },
      tts: voiceId ? { voice_id: voiceId } : undefined,
    },
  };

  const r = await fetch(EL, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  const supabase = await createServerClient();
  await supabase.rpc("log_audit", {
    p_action: "agent_create",
    p_target_id: null,
    p_details: { name, status: r.status },
  });
  if (!r.ok) {
    return NextResponse.json(
      { error: "create failed", status: r.status, body: text.slice(0, 300) },
      { status: 502 },
    );
  }
  return NextResponse.json(JSON.parse(text));
}

export async function PATCH(req: Request) {
  const csrf = checkSameOrigin(req);
  if (csrf) return csrf;
  const guard = await requireSuperadminApi();
  if (!guard.ok) return guard.response;
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.agent_id ?? "");
  if (!id) return NextResponse.json({ error: "agent_id required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name;
  const conv: Record<string, unknown> = {};
  const agent: Record<string, unknown> = {};
  if (typeof body.prompt === "string") agent.prompt = { prompt: body.prompt };
  if (typeof body.first_message === "string") agent.first_message = body.first_message;
  if (typeof body.language === "string") agent.language = body.language;
  if (Object.keys(agent).length) conv.agent = agent;
  if (typeof body.voice_id === "string") conv.tts = { voice_id: body.voice_id };
  if (Object.keys(conv).length) patch.conversation_config = conv;

  const r = await fetch(`${EL}/${id}`, {
    method: "PATCH",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  const text = await r.text();
  const supabase = await createServerClient();
  await supabase.rpc("log_audit", {
    p_action: "agent_update",
    p_target_id: id,
    p_details: { keys: Object.keys(patch), status: r.status },
  });
  if (!r.ok) {
    return NextResponse.json(
      { error: "patch failed", status: r.status, body: text.slice(0, 300) },
      { status: 502 },
    );
  }
  return NextResponse.json(JSON.parse(text));
}

export async function DELETE(req: Request) {
  const csrf = checkSameOrigin(req);
  if (csrf) return csrf;
  const guard = await requireSuperadminApi();
  if (!guard.ok) return guard.response;
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("agent_id");
  if (!id) return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  const r = await fetch(`${EL}/${id}`, {
    method: "DELETE",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
  });
  const supabase = await createServerClient();
  await supabase.rpc("log_audit", {
    p_action: "agent_delete",
    p_target_id: id,
    p_details: { status: r.status },
  });
  if (!r.ok) {
    return NextResponse.json(
      { error: "delete failed", status: r.status },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
