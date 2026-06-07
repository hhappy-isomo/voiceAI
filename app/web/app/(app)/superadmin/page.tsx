import { requireSuperadmin } from "@/lib/dal";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { MetricCard } from "@/components/ui/MetricCard";
import { createClient } from "@/lib/supabase/server";
import {
  Bot,
  Users,
  Phone,
  CreditCard,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";

type EConv = { call_duration_secs?: number };

async function fetchAgentCount(): Promise<number | null> {
  if (!process.env.ELEVENLABS_API_KEY) return null;
  try {
    const r = await fetch(
      "https://api.elevenlabs.io/v1/convai/agents?page_size=100",
      {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
        cache: "no-store",
      },
    );
    if (!r.ok) return null;
    const j = await r.json();
    return (j.agents ?? []).length;
  } catch {
    return null;
  }
}

async function fetchConvCount(): Promise<{
  total: number;
  duration_seconds: number;
}> {
  if (!process.env.ELEVENLABS_API_KEY) return { total: 0, duration_seconds: 0 };
  try {
    const r = await fetch(
      "https://api.elevenlabs.io/v1/convai/conversations?page_size=100",
      {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
        cache: "no-store",
      },
    );
    if (!r.ok) return { total: 0, duration_seconds: 0 };
    const j = (await r.json()) as { conversations?: EConv[] };
    const convs = j.conversations ?? [];
    const total = convs.length;
    const duration_seconds = convs.reduce(
      (s, c) => s + (c.call_duration_secs ?? 0),
      0,
    );
    return { total, duration_seconds };
  } catch {
    return { total: 0, duration_seconds: 0 };
  }
}

export default async function SuperadminHome() {
  await requireSuperadmin();
  const supabase = await createClient();

  const [
    students,
    pendingStudents,
    staff,
    sessionsRows,
    questCount,
    spend,
    caps,
    pilotCfg,
    agentCount,
    convAgg,
  ] = await Promise.all([
    supabase.from("students").select("student_id, consent_given", { count: "exact" }).eq("role", "student"),
    supabase.from("pending_students").select("id", { count: "exact", head: true }),
    supabase.from("students").select("student_id", { count: "exact", head: true }).in("role", ["facilitator", "superadmin"]),
    supabase.from("sessions").select("id, student_id"),
    supabase.from("questionnaire_responses").select("student_id"),
    supabase.from("usage_log").select("cost_usd, source"),
    supabase.from("cost_caps").select("monthly_ceiling_usd, per_student_cap_usd, drain_mode, kill_all").eq("id", 1).single(),
    supabase.from("pilot_config").select("active_session_no").eq("id", 1).single(),
    fetchAgentCount(),
    fetchConvCount(),
  ]);

  const studentCount = students.count ?? 0;
  const consented = (students.data ?? []).filter((s) => s.consent_given).length;
  const sessionsAll = sessionsRows.data ?? [];
  const studentsWithCall = new Set(sessionsAll.map((s) => s.student_id)).size;
  const studentsWithFive = new Set(
    [...new Set(sessionsAll.map((s) => s.student_id))].filter((sid) =>
      sessionsAll.filter((s) => s.student_id === sid).length >= 5,
    ),
  ).size;
  const finished = new Set(
    [...new Set(sessionsAll.map((s) => s.student_id))].filter((sid) =>
      sessionsAll.filter((s) => s.student_id === sid).length >= 20,
    ),
  ).size;
  const questDone = new Set((questCount.data ?? []).map((r) => r.student_id)).size;

  const totalSpend = (spend.data ?? []).reduce(
    (s, r) => s + Number(r.cost_usd ?? 0),
    0,
  );
  const elSpend = (spend.data ?? [])
    .filter((r) => r.source === "elevenlabs")
    .reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const claudeSpend = (spend.data ?? [])
    .filter((r) => r.source === "anthropic")
    .reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

  const ceiling = caps.data?.monthly_ceiling_usd as number | null | undefined;
  const ceilingPct =
    ceiling != null && ceiling > 0 ? Math.min(100, (totalSpend / ceiling) * 100) : null;

  return (
    <>
      <TopBar
        crumbs={["Superadmin", "Overview"]}
        title="System overview"
        right={
          <div className="flex gap-2">
            {caps.data?.kill_all && (
              <span className="border border-fg bg-fg px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-bg animate-pulse">
                KILL SWITCH ON
              </span>
            )}
            {caps.data?.drain_mode && (
              <span className="border border-fg px-2 py-1 text-[10px] font-bold uppercase tracking-widest">
                DRAIN MODE
              </span>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Agents" value={agentCount ?? "—"} icon={Bot} />
        <MetricCard
          label="Staff"
          value={staff.count ?? 0}
          icon={ShieldCheck}
        />
        <MetricCard
          label="Students"
          value={studentCount}
          delta={`${pendingStudents.count ?? 0} pending`}
          icon={Users}
        />
        <MetricCard
          label="Calls (EL)"
          value={convAgg.total}
          delta={`${Math.round(convAgg.duration_seconds / 60)} min total`}
          icon={Phone}
        />
        <MetricCard
          label="Spend total"
          value={`$${totalSpend.toFixed(2)}`}
          delta={
            ceilingPct != null
              ? `${ceilingPct.toFixed(0)}% of $${ceiling}/mo ceiling`
              : "no ceiling set"
          }
          icon={CreditCard}
        />
        <MetricCard
          label="ElevenLabs $"
          value={`$${elSpend.toFixed(2)}`}
          icon={CreditCard}
        />
        <MetricCard
          label="Claude $"
          value={`$${claudeSpend.toFixed(2)}`}
          icon={CreditCard}
        />
        <MetricCard
          label="Active session"
          value={pilotCfg.data?.active_session_no ?? 1}
          delta="of 24"
          icon={CalendarDays}
        />
      </div>

      <Card className="mt-6">
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          Engagement funnel
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
          Signed up → consented → first call → 5 calls → finished → surveyed
        </div>
        <div className="mt-5">
          <Funnel
            steps={[
              { label: "Signed up", value: studentCount },
              { label: "Consented", value: consented },
              { label: "First call", value: studentsWithCall },
              { label: "≥ 5 calls", value: studentsWithFive },
              { label: "Finished (20+)", value: finished },
              { label: "Survey done", value: questDone },
            ]}
          />
        </div>
      </Card>
    </>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const pct = (s.value / top) * 100;
        return (
          <div
            key={i}
            className="grid grid-cols-[160px_1fr_60px] items-center gap-3"
          >
            <div className="text-[11px] uppercase tracking-widest text-fg-dim">
              {s.label}
            </div>
            <div className="relative h-5 border border-fg/30">
              <div
                className="anim-draw-in h-full bg-fg"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <div className="text-right tabular-nums font-bold">{s.value}</div>
          </div>
        );
      })}
    </div>
  );
}
