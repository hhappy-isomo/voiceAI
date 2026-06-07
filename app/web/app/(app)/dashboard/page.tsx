import { BYPASS_AUTH, requireFacilitator } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { MetricCard } from "@/components/ui/MetricCard";
import { RosterTable, type RosterRow } from "@/components/RosterTable";
import { CohortBars } from "@/components/CohortBars";
import { TodayCard, type ActivityItem, type TodayStats } from "@/components/TodayCard";
import { mockMetrics, mockRoster, mockToday, mockActivity } from "@/lib/mock";
import {
  Clock,
  AlertTriangle,
  TrendingUp,
  Brain,
  HeartHandshake,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Metrics = {
  cohort: "base" | "foundation";
  avg_talk_min: number | null;
  silent_sessions: number | null;
  det_gain: number | null;
  ixl_gain: number | null;
  confidence_gain: number | null;
  pct_would_continue: number | null;
};

export default async function DashboardPage() {
  await requireFacilitator();

  let metricsRows: Metrics[];
  let rosterRows: RosterRow[];
  let today: TodayStats;
  let activity: ActivityItem[];

  if (BYPASS_AUTH) {
    metricsRows = mockMetrics;
    rosterRows = mockRoster;
    today = mockToday;
    activity = mockActivity;
  } else {
    const supabase = await createClient();
    const todayIso = new Date().toISOString().slice(0, 10);

    const [m, r, doneToday, recent, maxSession, totals] = await Promise.all([
      supabase.from("v_pilot_metrics").select("*"),
      supabase.from("v_student_progress").select("*"),
      supabase
        .from("sessions")
        .select("student_id, flagged_low_talk", { count: "exact" })
        .eq("held_on", todayIso),
      supabase
        .from("sessions")
        .select(
          "student_id, session_no, held_on, student_talk_seconds, flagged_low_talk, students!inner(display_name)",
        )
        .order("held_on", { ascending: false })
        .order("id", { ascending: false })
        .limit(5),
      supabase
        .from("sessions")
        .select("session_no")
        .order("session_no", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("students")
        .select("student_id", { count: "exact", head: true })
        .eq("role", "student"),
    ]);

    metricsRows = (m.data ?? []) as Metrics[];
    rosterRows = (r.data ?? []) as RosterRow[];

    const uniqueDone = new Set(
      (doneToday.data ?? []).map((s: { student_id: string }) => s.student_id),
    ).size;
    const silentToday = (doneToday.data ?? []).filter(
      (s: { flagged_low_talk: boolean | null }) => s.flagged_low_talk,
    ).length;
    today = {
      date: todayIso,
      current_session_no:
        ((maxSession.data?.session_no as number | null | undefined) ?? 0) + 1 || 1,
      current_session_topic: null,
      students_done_today: uniqueDone,
      students_total: totals.count ?? 0,
      silent_today: silentToday,
    };

    activity = (recent.data ?? []).map(
      (s: {
        student_id: string;
        session_no: number | null;
        held_on: string;
        student_talk_seconds: number | null;
        flagged_low_talk: boolean | null;
        students: { display_name: string | null } | { display_name: string | null }[];
      }) => {
        const stu = Array.isArray(s.students) ? s.students[0] : s.students;
        return {
          student_id: s.student_id,
          student_name: stu?.display_name ?? s.student_id.slice(0, 8),
          session_no: s.session_no ?? 0,
          held_on: s.held_on,
          talk_min: s.student_talk_seconds != null ? Math.round(s.student_talk_seconds / 60) : 0,
          flagged_low_talk: !!s.flagged_low_talk,
        };
      },
    );
  }

  const byCohort: Record<"base" | "foundation", Metrics | undefined> = {
    base: metricsRows.find((r) => r.cohort === "base"),
    foundation: metricsRows.find((r) => r.cohort === "foundation"),
  };
  const all = metricsRows.reduce(
    (acc, m) => {
      acc.avg_talk_min = avg(acc.avg_talk_min, m.avg_talk_min);
      acc.silent_sessions = (acc.silent_sessions ?? 0) + (m.silent_sessions ?? 0);
      acc.det_gain = avg(acc.det_gain, m.det_gain);
      acc.ixl_gain = avg(acc.ixl_gain, m.ixl_gain);
      acc.confidence_gain = avg(acc.confidence_gain, m.confidence_gain);
      acc.pct_would_continue = avg(acc.pct_would_continue, m.pct_would_continue);
      return acc;
    },
    {} as Partial<Metrics>,
  );

  return (
    <>
      <TopBar crumbs={["Pages", "Dashboard"]} title="Pilot dashboard" />

      <TodayCard today={today} activity={activity} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Avg talk-time" value={fmt(all.avg_talk_min, "min")} icon={Clock} />
        <MetricCard label="Silent sessions" value={all.silent_sessions ?? 0} icon={AlertTriangle} />
        <MetricCard label="DET gain" value={fmt(all.det_gain)} icon={TrendingUp} />
        <MetricCard label="IXL gain" value={fmt(all.ixl_gain)} icon={Brain} />
        <MetricCard label="Confidence gain" value={fmt(all.confidence_gain)} icon={HeartHandshake} />
        <MetricCard label="Would continue" value={fmt(all.pct_would_continue, "%")} icon={CheckCircle2} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CohortCard label="Base" m={byCohort.base} />
        <CohortCard label="Foundation" m={byCohort.foundation} />
      </div>

      <div className="mt-6">
        <CohortBars metrics={metricsRows} />
      </div>

      <div className="mt-6">
        <Card className="!p-0">
          <div className="border-b border-fg/30 px-5 py-4">
            <div className="text-sm font-bold uppercase tracking-[0.2em]">Roster</div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
              Search, filter, export
            </div>
          </div>
          <RosterTable rows={rosterRows} />
        </Card>
      </div>
    </>
  );
}

function CohortCard({ label, m }: { label: string; m: Metrics | undefined }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between border-b border-fg/20 pb-3">
        <div className="text-sm font-bold uppercase tracking-[0.2em]">{label} cohort</div>
        {m && (
          <span className="border border-fg/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-fg-muted">
            {m.cohort}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-0 border border-fg/20 text-sm">
        <Stat label="Talk-time" value={fmt(m?.avg_talk_min, "min")} />
        <Stat label="DET gain" value={fmt(m?.det_gain)} borderL />
        <Stat label="IXL gain" value={fmt(m?.ixl_gain)} borderL />
        <Stat label="Confidence" value={fmt(m?.confidence_gain)} borderT />
        <Stat label="Continue" value={fmt(m?.pct_would_continue, "%")} borderT borderL />
        <Stat label="Silent" value={m?.silent_sessions ?? 0} borderT borderL />
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  borderL,
  borderT,
}: {
  label: string;
  value: string | number;
  borderL?: boolean;
  borderT?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-3 py-3",
        borderL && "border-l border-fg/20",
        borderT && "border-t border-fg/20",
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function fmt(v: number | null | undefined, suffix = ""): string {
  if (v == null) return "—";
  return `${v}${suffix ? ` ${suffix}` : ""}`;
}

function avg(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b!;
  if (b == null) return a;
  return Math.round(((a + b) / 2) * 100) / 100;
}
