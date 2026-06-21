import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GuardResult =
  | { ok: true }
  | {
      ok: false;
      status: 503 | 402;
      reason: "kill_all" | "drain_mode" | "monthly_cap" | "student_cap";
      detail?: string;
    };

// Read cost_caps + month-to-date usage_log and decide whether the caller
// is allowed to spend `estimatedCostUsd` more right now. Service-role
// client only — bypasses RLS on cost_caps and usage_log.
export async function checkBudget(
  admin: SupabaseClient,
  opts: { studentId?: string | null; estimatedCostUsd?: number } = {},
): Promise<GuardResult> {
  const { data: caps } = await admin
    .from("cost_caps")
    .select("monthly_ceiling_usd, per_student_cap_usd, kill_all, drain_mode")
    .eq("id", 1)
    .maybeSingle();

  if (caps?.kill_all) {
    return { ok: false, status: 503, reason: "kill_all", detail: "pilot stopped" };
  }
  if (caps?.drain_mode) {
    return { ok: false, status: 503, reason: "drain_mode", detail: "no new calls" };
  }

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const isoStart = startOfMonth.toISOString();
  const estimate = opts.estimatedCostUsd ?? 0;

  if (caps?.monthly_ceiling_usd != null) {
    const total = await sumUsage(admin, { since: isoStart });
    if (total + estimate > Number(caps.monthly_ceiling_usd)) {
      return {
        ok: false,
        status: 402,
        reason: "monthly_cap",
        detail: `month-to-date $${total.toFixed(2)} would exceed cap $${caps.monthly_ceiling_usd}`,
      };
    }
  }

  if (caps?.per_student_cap_usd != null && opts.studentId) {
    const total = await sumUsage(admin, {
      since: isoStart,
      studentId: opts.studentId,
    });
    if (total + estimate > Number(caps.per_student_cap_usd)) {
      return {
        ok: false,
        status: 402,
        reason: "student_cap",
        detail: `student MTD $${total.toFixed(2)} would exceed cap $${caps.per_student_cap_usd}`,
      };
    }
  }

  return { ok: true };
}

async function sumUsage(
  admin: SupabaseClient,
  opts: { since: string; studentId?: string },
): Promise<number> {
  let q = admin.from("usage_log").select("cost_usd").gte("at", opts.since);
  if (opts.studentId) q = q.eq("student_id", opts.studentId);
  const { data } = await q;
  return (data ?? []).reduce(
    (acc: number, r: { cost_usd: number | null }) =>
      acc + Number(r.cost_usd ?? 0),
    0,
  );
}
