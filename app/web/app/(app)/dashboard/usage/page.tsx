import { BYPASS_AUTH, requireFacilitator } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { MetricCard } from "@/components/ui/MetricCard";
import { SyncUsageButton } from "./SyncUsageButton";
import { CreditCard, MessageSquare, Brain, Users, DollarSign } from "lucide-react";

const COST_PER_CLAUDE_TOKEN = 0.000003;
const COST_PER_EL_CHAR = 0.00003;

type ElevenlabsSub = {
  character_count?: number;
  character_limit?: number;
  next_character_count_reset_unix?: number;
  tier?: string;
};

async function fetchElevenlabsSub(): Promise<ElevenlabsSub | null> {
  if (!process.env.ELEVENLABS_API_KEY) return null;
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as ElevenlabsSub;
  } catch {
    return null;
  }
}

type UsageRow = {
  source: string;
  units: number;
  cost_usd: number | null;
  student_id: string | null;
};

type PerStudent = {
  student_id: string;
  display_name: string | null;
  elevenlabs_cost: number;
  anthropic_cost: number;
  total_cost: number;
};

export default async function UsagePage() {
  await requireFacilitator();

  let usageRows: UsageRow[] = [];
  let studentMap = new Map<string, string | null>();

  if (!BYPASS_AUTH) {
    const supabase = await createClient();
    const [u, s] = await Promise.all([
      supabase
        .from("usage_log")
        .select("source, units, cost_usd, student_id"),
      supabase
        .from("students")
        .select("student_id, display_name")
        .eq("role", "student"),
    ]);
    usageRows = (u.data ?? []) as UsageRow[];
    for (const x of s.data ?? []) {
      studentMap.set(x.student_id, x.display_name);
    }
  }

  const elSub = await fetchElevenlabsSub();
  const elChars = elSub?.character_count ?? 0;
  const elLimit = elSub?.character_limit ?? 10000;
  const elPct = elLimit > 0 ? Math.min(100, (elChars / elLimit) * 100) : 0;
  const elCostFromSub = elChars * COST_PER_EL_CHAR;

  // Aggregate from usage_log
  const totals = { elevenlabs: 0, anthropic: 0 };
  const perStudent = new Map<string, PerStudent>();

  for (const r of usageRows) {
    const cost = Number(r.cost_usd ?? 0);
    if (r.source === "elevenlabs") totals.elevenlabs += cost;
    if (r.source === "anthropic") totals.anthropic += cost;
    if (r.student_id) {
      const entry =
        perStudent.get(r.student_id) ??
        {
          student_id: r.student_id,
          display_name: studentMap.get(r.student_id) ?? null,
          elevenlabs_cost: 0,
          anthropic_cost: 0,
          total_cost: 0,
        };
      if (r.source === "elevenlabs") entry.elevenlabs_cost += cost;
      if (r.source === "anthropic") entry.anthropic_cost += cost;
      entry.total_cost += cost;
      perStudent.set(r.student_id, entry);
    }
  }

  const perStudentRows = [...perStudent.values()].sort(
    (a, b) => b.total_cost - a.total_cost,
  );

  // Prefer attributed totals; fall back to subscription-derived if nothing synced yet.
  const elevenlabsCost = totals.elevenlabs > 0 ? totals.elevenlabs : elCostFromSub;
  const claudeCost = totals.anthropic;
  const grandTotal = elevenlabsCost + claudeCost;
  const studentCount = studentMap.size;
  const avgPerStudent = studentCount > 0 ? grandTotal / studentCount : 0;

  return (
    <>
      <TopBar
        crumbs={["Pages", "Dashboard", "Usage"]}
        title="Cost & usage"
        right={<SyncUsageButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Grand total $"
          value={`$${grandTotal.toFixed(2)}`}
          icon={DollarSign}
        />
        <MetricCard
          label="Avg / student"
          value={`$${avgPerStudent.toFixed(2)}`}
          delta={`${studentCount} students`}
          icon={Users}
        />
        <MetricCard
          label="ElevenLabs $"
          value={`$${elevenlabsCost.toFixed(2)}`}
          delta={`${elChars.toLocaleString()} chars · ${elPct.toFixed(0)}% of quota`}
          icon={MessageSquare}
        />
        <MetricCard
          label="Claude $"
          value={`$${claudeCost.toFixed(2)}`}
          delta={`${usageRows
            .filter((r) => r.source === "anthropic")
            .reduce((s, r) => s + Number(r.units), 0)
            .toLocaleString()} tokens`}
          icon={Brain}
        />
      </div>

      <Card className="mt-6 !p-0">
        <div className="border-b border-fg/20 px-5 py-4">
          <div className="text-sm font-bold uppercase tracking-[0.2em]">
            Per student
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
            Click <strong>Sync ElevenLabs</strong> above to pull per-conversation
            attribution. Auto-rubric is attributed automatically.
          </div>
        </div>
        {perStudentRows.length === 0 ? (
          <div className="px-5 py-12 text-center text-[11px] uppercase tracking-widest text-fg-muted">
            No attributed usage yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-widest text-fg-muted">
              <tr className="border-b border-fg/15">
                <th className="px-5 py-3 font-bold">Student</th>
                <th className="px-5 py-3 font-bold text-right">ElevenLabs</th>
                <th className="px-5 py-3 font-bold text-right">Claude</th>
                <th className="px-5 py-3 font-bold text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {perStudentRows.map((s) => (
                <tr key={s.student_id} className="border-t border-fg/15">
                  <td className="px-5 py-2 font-bold uppercase tracking-wider">
                    {s.display_name ?? s.student_id.slice(0, 8)}
                  </td>
                  <td className="px-5 py-2 text-right tabular-nums">
                    ${s.elevenlabs_cost.toFixed(2)}
                  </td>
                  <td className="px-5 py-2 text-right tabular-nums">
                    ${s.anthropic_cost.toFixed(2)}
                  </td>
                  <td className="px-5 py-2 text-right font-bold tabular-nums">
                    ${s.total_cost.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-6">
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          How these numbers come from
        </div>
        <div className="mt-2 space-y-1 text-[12px] leading-relaxed text-fg-dim">
          <div>
            <strong>ElevenLabs $</strong> — sum of per-conversation cost from
            usage_log (attributed by student via the synced dynamic_variables).
            Falls back to the subscription endpoint&apos;s char count × ${COST_PER_EL_CHAR}/char
            when nothing&apos;s been synced yet.
          </div>
          <div>
            <strong>Claude $</strong> — auto-rubric writes a row per scoring
            call with the session&apos;s student_id and an estimate of ${COST_PER_CLAUDE_TOKEN}/token.
          </div>
          <div>
            <strong>Mem0</strong> — not metered by their API yet; not included.
          </div>
        </div>
        {elSub?.next_character_count_reset_unix && (
          <div className="mt-3 text-[11px] uppercase tracking-widest text-fg-muted">
            ElevenLabs quota resets{" "}
            {new Date(elSub.next_character_count_reset_unix * 1000).toLocaleString()}
          </div>
        )}
      </Card>
    </>
  );
}
