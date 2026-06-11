"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Search } from "lucide-react";
import { CohortToggle } from "@/components/CohortToggle";
import { cn } from "@/lib/cn";

export type RosterRow = {
  student_id: string;
  display_name: string | null;
  cohort: "base" | "foundation";
  sessions_done: number | null;
  avg_talk_min: number | null;
  silent_sessions: number | null;
};

type CohortFilter = "all" | "base" | "foundation";

export function RosterTable({ rows }: { rows: RosterRow[] }) {
  const [q, setQ] = useState("");
  const [cohort, setCohort] = useState<CohortFilter>("all");
  const [silentOnly, setSilentOnly] = useState(false);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (cohort !== "all" && r.cohort !== cohort) return false;
        if (silentOnly && (r.silent_sessions ?? 0) === 0) return false;
        if (ql) {
          const hay = (r.display_name ?? r.student_id).toLowerCase();
          if (!hay.includes(ql)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.silent_sessions ?? 0) - (a.silent_sessions ?? 0));
  }, [rows, q, cohort, silentOnly]);

  function exportCsv() {
    const headers = [
      "student_id",
      "display_name",
      "cohort",
      "sessions_done",
      "avg_talk_min",
      "silent_sessions",
    ];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          r.student_id,
          csv(r.display_name ?? ""),
          r.cohort,
          r.sessions_done ?? 0,
          r.avg_talk_min ?? 0,
          r.silent_sessions ?? 0,
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `isomo-roster-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-fg/20 px-5 py-4">
        <div className="flex flex-1 min-w-[200px] items-center gap-2 border border-fg/30 px-3 py-2 focus-within:border-fg">
          <Search className="h-4 w-4 text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search students…"
            className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
          />
        </div>
        <div className="flex border border-fg/30">
          {(["all", "base", "foundation"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCohort(c)}
              className={cn(
                "border-r border-fg/30 px-3 py-2 text-[10px] uppercase tracking-widest last:border-r-0",
                cohort === c ? "bg-fg text-bg" : "text-fg-dim hover:text-fg",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSilentOnly((v) => !v)}
          className={cn(
            "border px-3 py-2 text-[10px] uppercase tracking-widest",
            silentOnly ? "border-fg bg-fg text-bg" : "border-fg/30 text-fg-dim hover:text-fg",
          )}
        >
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          Silent only
        </button>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 border border-fg/30 px-3 py-2 text-[10px] uppercase tracking-widest text-fg-dim hover:border-fg hover:text-fg"
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
              <th className="px-5 py-3 font-bold">Student</th>
              <th className="px-5 py-3 font-bold">Cohort</th>
              <th className="px-5 py-3 font-bold text-right">Sessions</th>
              <th className="px-5 py-3 font-bold text-right">Avg talk</th>
              <th className="px-5 py-3 font-bold text-right">Silent</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-fg-muted">
                  No students match the filter.
                </td>
              </tr>
            )}
            {filtered.map((s) => {
              const silent = s.silent_sessions ?? 0;
              return (
                <tr
                  key={s.student_id}
                  className={cn(
                    "border-t border-fg/15 transition-colors hover:bg-fg hover:text-bg",
                    silent > 0 && "bg-fg/[0.06]",
                  )}
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/students/${s.student_id}`}
                      className="font-bold uppercase tracking-wider underline-offset-4 hover:underline"
                    >
                      {s.display_name ?? s.student_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <CohortToggle studentId={s.student_id} cohort={s.cohort} />
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {s.sessions_done ?? 0}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {s.avg_talk_min != null ? `${s.avg_talk_min} min` : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {silent > 0 ? (
                      <span className="inline-flex items-center gap-1 border border-current px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                        <AlertTriangle className="h-3 w-3" />
                        {silent}
                      </span>
                    ) : (
                      <span className="text-fg-muted">0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function csv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
