import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/admin";
import { checkSameOrigin } from "@/lib/csrf";

type Role = "student" | "facilitator" | "superadmin";

const ALLOWED_TARGET_ROLES: Record<Role, Role[]> = {
  // Students can't promote anyone.
  student: [],
  // Facilitators can no longer promote or demote anyone. Role changes are
  // a superadmin-only power so staff can't accidentally (or maliciously)
  // hand out elevated access.
  facilitator: [],
  // Superadmins can set any role on anyone (except themselves losing the
  // only superadmin slot — enforced atomically in safe_set_role()).
  superadmin: ["student", "facilitator", "superadmin"],
};

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
      { error: `${callerRole} cannot set role to ${requested}` },
      { status: 403 },
    );
  }
  if (targetId === user.id && callerRole !== "superadmin") {
    return NextResponse.json(
      { error: "only superadmin can change own role" },
      { status: 403 },
    );
  }

  // Facilitators can't touch a superadmin.
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

  // Atomic role change. The RPC:
  //   - checks that demoting the last superadmin can't lock everyone out
  //     (no read-then-write race even with concurrent callers),
  //   - returns the previous role so we can record a meaningful audit row.
  const admin = adminClient();
  const { data, error } = await admin.rpc("safe_set_role", {
    p_target: targetId,
    p_new_role: requested,
  });

  if (error) {
    // P0001 is "cannot remove last superadmin"; surface that as 400.
    if (error.code === "P0001") {
      return NextResponse.json(
        { error: "you're the only superadmin — promote someone else first" },
        { status: 400 },
      );
    }
    if (error.code === "P0002") {
      return NextResponse.json({ error: "student not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const fromRole = row?.from_role ?? null;
  const toRole = row?.to_role ?? requested;

  await supabase.rpc("log_audit", {
    p_action: "role_change",
    p_target_id: targetId,
    p_details: { from: fromRole, to: toRole },
  });

  return NextResponse.json({
    ok: true,
    student_id: targetId,
    from: fromRole,
    role: toRole,
  });
}
