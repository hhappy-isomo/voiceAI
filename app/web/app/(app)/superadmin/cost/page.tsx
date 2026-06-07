import { requireSuperadmin } from "@/lib/dal";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { CostCapsForm } from "./CostCapsForm";

export default async function CostPage() {
  await requireSuperadmin();
  const supabase = await createClient();
  const { data: caps } = await supabase
    .from("cost_caps")
    .select("monthly_ceiling_usd, per_student_cap_usd, drain_mode, kill_all")
    .eq("id", 1)
    .single();

  const { data: usage } = await supabase
    .from("usage_log")
    .select("cost_usd, student_id, source");
  const totalSpend = (usage ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const perStudent = new Map<string, number>();
  for (const r of usage ?? []) {
    if (!r.student_id) continue;
    perStudent.set(r.student_id, (perStudent.get(r.student_id) ?? 0) + Number(r.cost_usd ?? 0));
  }
  const topStudent = [...perStudent.values()].sort((a, b) => b - a)[0] ?? 0;

  return (
    <>
      <TopBar crumbs={["Superadmin", "Cost caps"]} title="Cost guardrails" />
      <Card glow>
        <CostCapsForm
          initial={{
            monthly_ceiling_usd: caps?.monthly_ceiling_usd ?? null,
            per_student_cap_usd: caps?.per_student_cap_usd ?? null,
          }}
          currentSpend={totalSpend}
          topStudentSpend={topStudent}
        />
      </Card>
    </>
  );
}
