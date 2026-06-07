import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

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
  if (me?.role !== "facilitator") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const targetId = String(body.student_id ?? "");
  const nextRole = body.role === "facilitator" ? "facilitator" : "student";

  if (!targetId) {
    return NextResponse.json({ error: "student_id required" }, { status: 400 });
  }
  if (targetId === user.id) {
    // Block self-demotion (and self-promotion as a footgun guard).
    return NextResponse.json(
      { error: "cannot change your own role" },
      { status: 400 },
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await admin
    .from("students")
    .update({ role: nextRole })
    .eq("student_id", targetId)
    .select("student_id, role")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, student_id: data.student_id, role: data.role });
}
