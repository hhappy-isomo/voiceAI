import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

type Role = "student" | "facilitator" | "superadmin";

const ALLOWED_TARGET_ROLES: Record<Role, Role[]> = {
  // Students can't promote anyone.
  student: [],
  // Facilitators can flip between student and facilitator only — they can
  // neither create nor demote a superadmin.
  facilitator: ["student", "facilitator"],
  // Superadmins can set any role on anyone (except themselves).
  superadmin: ["student", "facilitator", "superadmin"],
};

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
  const callerRole = (me?.role ?? "student") as Role;

  if (callerRole === "student") {
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
  const requested = body.role as Role | undefined;

  if (!targetId || !requested) {
    return NextResponse.json(
      { error: "student_id and role required" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TARGET_ROLES[callerRole].includes(requested)) {
    return NextResponse.json(
      {
        error: `${callerRole} cannot set role to ${requested}`,
      },
      { status: 403 },
    );
  }

  // Self-role-change: allowed only if it leaves at least one other
  // superadmin standing (so a sole superadmin can never lock themselves out).
  if (targetId === user.id) {
    if (callerRole !== "superadmin") {
      return NextResponse.json(
        { error: "only superadmin can change own role" },
        { status: 403 },
      );
    }
    const { count } = await supabase
      .from("students")
      .select("student_id", { count: "exact", head: true })
      .eq("role", "superadmin");
    const total = count ?? 0;
    if (requested !== "superadmin" && total <= 1) {
      return NextResponse.json(
        {
          error:
            "you're the only superadmin — promote someone else first or you'll lock everyone out",
        },
        { status: 400 },
      );
    }
  }

  // Also block a facilitator from demoting an existing superadmin.
  if (callerRole === "facilitator") {
    const { data: target } = await supabase
      .from("students")
      .select("role")
      .eq("student_id", targetId)
      .single();
    if (target?.role === "superadmin") {
      return NextResponse.json(
        { error: "facilitators cannot modify a superadmin" },
        { status: 403 },
      );
    }
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await admin
    .from("students")
    .update({ role: requested })
    .eq("student_id", targetId)
    .select("student_id, role")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.rpc("log_audit", {
    p_action: "role_change",
    p_target_id: targetId,
    p_details: { from: callerRole === "superadmin" ? null : undefined, to: requested },
  });

  return NextResponse.json({ ok: true, student_id: data.student_id, role: data.role });
}
