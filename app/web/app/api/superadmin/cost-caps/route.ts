import { NextResponse } from "next/server";
import { requireSuperadminApi } from "@/lib/superadmin-guard";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/admin";
import { checkSameOrigin } from "@/lib/csrf";

export async function POST(req: Request) {
  const csrf = checkSameOrigin(req);
  if (csrf) return csrf;
  const guard = await requireSuperadminApi();
  if (!guard.ok) return guard.response;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: guard.userId };
  if ("monthly_ceiling_usd" in body) {
    const v = body.monthly_ceiling_usd;
    patch.monthly_ceiling_usd = v === "" || v == null ? null : Number(v);
  }
  if ("per_student_cap_usd" in body) {
    const v = body.per_student_cap_usd;
    patch.per_student_cap_usd = v === "" || v == null ? null : Number(v);
  }
  if ("drain_mode" in body) patch.drain_mode = !!body.drain_mode;
  if ("kill_all" in body) patch.kill_all = !!body.kill_all;

  const admin = adminClient();
  const { error } = await admin.from("cost_caps").update(patch).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const supabase = await createServerClient();
  await supabase.rpc("log_audit", {
    p_action: "cost_caps_update",
    p_target_id: null,
    p_details: patch,
  });

  return NextResponse.json({ ok: true });
}
