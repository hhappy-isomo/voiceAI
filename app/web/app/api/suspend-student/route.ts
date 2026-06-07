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
  const suspended = !!body.suspended;
  if (!targetId) return NextResponse.json({ error: "student_id required" }, { status: 400 });
  if (targetId === user.id) {
    return NextResponse.json({ error: "cannot suspend yourself" }, { status: 400 });
  }

  // Block facilitator from suspending a superadmin
  const { data: target } = await supabase
    .from("students")
    .select("role")
    .eq("student_id", targetId)
    .single();
  if (me.role === "facilitator" && target?.role === "superadmin") {
    return NextResponse.json(
      { error: "facilitators cannot suspend a superadmin" },
      { status: 403 },
    );
  }

  const admin = adminClient();
  const { error } = await admin
    .from("students")
    .update({ suspended })
    .eq("student_id", targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.rpc("log_audit", {
    p_action: suspended ? "suspend" : "unsuspend",
    p_target_id: targetId,
    p_details: null,
  });

  return NextResponse.json({ ok: true, suspended });
}
