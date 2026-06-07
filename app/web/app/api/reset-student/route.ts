import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/admin";

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

  const body = await req.json().catch(() => ({}));
  const targetId = String(body.student_id ?? "");
  if (!targetId) return NextResponse.json({ error: "student_id required" }, { status: 400 });
  if (targetId === user.id) {
    return NextResponse.json({ error: "cannot reset yourself" }, { status: 400 });
  }

  const admin = adminClient();

  // 1) Wipe DB-side state
  const { error: rpcErr } = await admin.rpc("reset_student", {
    p_student_id: targetId,
  });
  if (rpcErr) {
    return NextResponse.json({ error: `db: ${rpcErr.message}` }, { status: 500 });
  }

  // 2) Wipe Mem0 memories (best-effort)
  let mem0Status: number | null = null;
  if (process.env.MEM0_API_KEY) {
    const r = await fetch(
      `https://api.mem0.ai/v1/memories/?user_id=${encodeURIComponent(targetId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Token ${process.env.MEM0_API_KEY}` },
      },
    ).catch(() => null);
    mem0Status = r?.status ?? null;
  }

  await supabase.rpc("log_audit", {
    p_action: "reset_student",
    p_target_id: targetId,
    p_details: { mem0_status: mem0Status },
  });

  return NextResponse.json({ ok: true, mem0_status: mem0Status });
}
