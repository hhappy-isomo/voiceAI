"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search, Download, Sparkles, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { SessionDrawer, type SessionRow } from "@/components/SessionDrawer";

export type SafetyFlag = {
  severity: "warn" | "flag" | "block";
  snippet: string | null;
};

export type CallRow = {
  id: number;
  student_id: string;
  student_name: string | null;
  cohort: "base" | "foundation";
  session_no: number | null;
  held_on: string;
  duration_seconds: number | null;
  student_talk_seconds: number | null;
  flagged_low_talk: boolean;
  safety_severity: "clean" | "warn" | "flag" | "block" | null;
  safety_flags: SafetyFlag[];
  topic: string | null;
  conversation_id: string | null;
  transcript_url: string | null;
  recording_url: string | null;
  cefr: string | null;
  rubric_overall: number | null;
  summary: string | null;
};

type CohortFilter = "all" | "base" | "foundation";

export function CallsTable({ rows }: { rows: CallRow[] }) {
  const [q, setQ] = useState("");
  const [cohort, setCohort] = useState<CohortFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [scoredOnly, setScoredOnly] = useState(false);
  const [safetyOnly, setSafetyOnly] = useState(false);
  const [open, setOpen] = useState<SessionRow | null>(null);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (cohort !== "all" && r.cohort !== cohort) return false;
      if (flaggedOnly && !r.flagged_low_talk) return false;
      if (scoredOnly && r.cefr == null) return false;
      if (safetyOnly && r.safety_severity !== "flag" && r.safety_severity !== "block") return false;
      if (from && r.held_on < from) return false;
      if (to && r.held_on > to) return false;
      if (ql) {
        const hay =
          (r.student_name ?? r.student_id) +
          " " +
          (r.topic ?? "") +
          " " +
          (r.summary ?? "");
        if (!hay.toLowerCase().includes(ql)) return false;
      }
      return true;
    });
  }, [rows, q, cohort, from, to, flaggedOnly, scoredOnly, safetyOnly]);

  function exportCsv() {
    const headers = [
      "held_on",
      "student",
      "cohort",
      "session_no",
      "duration_min",
      "talk_min",
      "flagged",
      "cefr",
      "rubric_overall",
      "summary",
    ];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          r.held_on,
          csv(r.student_name ?? r.student_id.slice(0, 8)),
          r.cohort,
          r.session_no ?? "",
          r.duration_seconds ? Math.round(r.duration_seconds / 60) : "",
          r.student_talk_seconds ? Math.round(r.student_talk_seconds / 60) : "",
          r.flagged_low_talk ? "y" : "",
          r.cefr ?? "",
          r.rubric_overall ?? "",
          csv(r.summary ?? ""),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `isomo-voice-calls-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function openDrawer(r: CallRow) {
    setOpen({
      id: r.id,
      session_no: r.session_no,
      held_on: r.held_on,
      duration_seconds: r.duration_seconds,
      student_talk_seconds: r.student_talk_seconds,
      flagged_low_talk: r.flagged_low_talk,
      safety_severity: r.safety_severity,
      safety_flags: r.safety_flags,
      topic: r.topic,
      conversation_id: r.conversation_id,
      transcript_url: r.transcript_url,
      recording_url: r.recording_url,
    });
  }

  return (
    <>
      <div className="border-b border-fg/20 px-5 py-4">
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          All calls
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
          Student · when · duration · CEFR score · summary · click row for transcript / recording
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-fg/20 px-5 py-3">
        <div className="flex flex-1 min-w-[200px] items-center gap-2 border border-fg/30 px-3 py-1.5 focus-within:border-fg">
          <Search className="h-3 w-3 text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, topic, summary…"
            className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
          />
        </div>
        <div className="flex border border-fg/30">
          {(["all", "base", "foundation"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCohort(c)}
              className={cn(
                "border-r border-fg/30 px-2.5 py-1.5 text-[10px] uppercase tracking-widest last:border-r-0",
                cohort === c ? "bg-fg text-bg" : "text-fg-dim hover:text-fg",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
        <FilterToggle
          on={flaggedOnly}
          onClick={() => setFlaggedOnly((v) => !v)}
          label="Flagged"
          icon={<AlertTriangle className="h-3 w-3" />}
        />
        <FilterToggle
          on={scoredOnly}
          onClick={() => setScoredOnly((v) => !v)}
          label="Scored"
          icon={<Sparkles className="h-3 w-3" />}
        />
        <FilterToggle
          on={safetyOnly}
          onClick={() => setSafetyOnly((v) => !v)}
          label="Safety"
          icon={<ShieldAlert className="h-3 w-3" />}
        />
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 border border-fg/30 px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-fg-dim hover:border-fg hover:text-fg"
        >
          <Download className="h-3 w-3" />
          CSV
        </button>
        <div className="ml-auto text-[10px] uppercase tracking-widest text-fg-muted">
          {filtered.length} / {rows.length}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[10px] uppercase tracking-widest text-fg-muted">
            <tr className="border-b border-fg/15">
              <th className="px-5 py-2.5 font-bold">Date</th>
              <th className="px-5 py-2.5 font-bold">Student</th>
              <th className="px-5 py-2.5 font-bold text-right">Sess</th>
              <th className="px-5 py-2.5 font-bold text-right">Dur</th>
              <th className="px-5 py-2.5 font-bold text-right">Talk</th>
              <th className="px-5 py-2.5 font-bold text-center">Safety</th>
              <th className="px-5 py-2.5 font-bold text-center">CEFR</th>
              <th className="px-5 py-2.5 font-bold text-right">Score</th>
              <th className="px-5 py-2.5 font-bold">Summary</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-fg-muted">
                  No calls match.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => openDrawer(r)}
                className={cn(
                  "cursor-pointer border-t border-fg/15 transition-colors hover:bg-fg hover:text-bg",
                  r.flagged_low_talk && "bg-fg/[0.06]",
                  (r.safety_severity === "flag" || r.safety_severity === "block") &&
                    "bg-fg/[0.12]",
                )}
              >
                <td className="px-5 py-2 tabular-nums text-fg-dim">{r.held_on}</td>
                <td className="px-5 py-2">
                  <Link
                    href={`/dashboard/students/${r.student_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-bold uppercase tracking-wider underline-offset-4 hover:underline"
                  >
                    {r.student_name ?? r.student_id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-5 py-2 text-right tabular-nums">
                  {r.session_no ?? "—"}
                </td>
                <td className="px-5 py-2 text-right tabular-nums">
                  {r.duration_seconds != null
                    ? `${Math.round(r.duration_seconds / 60)}m`
                    : "—"}
                </td>
                <td className="px-5 py-2 text-right tabular-nums">
                  {r.student_talk_seconds != null ? (
                    <span
                      className={
                        r.flagged_low_talk
                          ? "inline-flex items-center gap-1 border border-current px-1.5 text-[10px] uppercase tracking-widest"
                          : ""
                      }
                    >
                      {r.flagged_low_talk && <AlertTriangle className="h-3 w-3" />}
                      {Math.round(r.student_talk_seconds / 60)}m
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-2 text-center">
                  <SafetyBadge severity={r.safety_severity} />
                </td>
                <td className="px-5 py-2 text-center font-bold">
                  {r.cefr ?? "—"}
                </td>
                <td className="px-5 py-2 text-right tabular-nums">
                  {r.rubric_overall != null ? r.rubric_overall.toFixed(1) : "—"}
                </td>
                <td className="px-5 py-2 max-w-[300px] truncate text-fg-dim">
                  {r.summary ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SessionDrawer session={open} onClose={() => setOpen(null)} />
    </>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 border border-fg/30 px-2 py-1 text-[10px] uppercase tracking-widest">
      <span className="text-fg-muted">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-fg outline-none text-sm normal-case tracking-normal"
      />
    </label>
  );
}

function FilterToggle({
  on,
  onClick,
  label,
  icon,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 border px-2.5 py-1.5 text-[10px] uppercase tracking-widest",
        on ? "border-fg bg-fg text-bg" : "border-fg/30 text-fg-dim hover:text-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function csv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function SafetyBadge({
  severity,
}: {
  severity: "clean" | "warn" | "flag" | "block" | null;
}) {
  if (severity == null || severity === "clean") return <span className="text-fg-dim">—</span>;
  const label = severity.toUpperCase();
  return (
    <span
      className="inline-flex items-center gap-1 border border-current px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
      title={`Safety scan: ${severity}`}
    >
      <ShieldAlert className="h-3 w-3" />
      {label}
    </span>
  );
}
