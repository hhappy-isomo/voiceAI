"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export function ExportsPanel({
  students,
}: {
  students: { id: string; name: string }[];
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  async function download(url: string, filename: string, key: string) {
    setBusy(key);
    const r = await fetch(url);
    setBusy(null);
    if (!r.ok) {
      alert(`Error: HTTP ${r.status}`);
      return;
    }
    const blob = await r.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  }

  return (
    <div className="space-y-7">
      <section>
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          GDPR per-student export
        </div>
        <div className="mt-1 text-[11px] text-fg-dim leading-relaxed">
          Generates a JSON dump of one student&apos;s full record: profile, sessions,
          transcripts, assessments, questionnaire, memory snapshots, auto-rubric
          scores, attributed usage. Hand to a parent/student on request.
        </div>
        <div className="mt-3 flex gap-2">
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="flex-1 appearance-none border border-fg/30 bg-bg px-3 py-2.5 text-sm outline-none focus:border-fg"
          >
            {students.length === 0 ? (
              <option value="" className="bg-bg">No students yet</option>
            ) : (
              students.map((s) => (
                <option key={s.id} value={s.id} className="bg-bg">
                  {s.name}
                </option>
              ))
            )}
          </select>
          <button
            onClick={() =>
              download(
                `/api/superadmin/export?student_id=${encodeURIComponent(studentId)}`,
                `ijwi-student-${studentId.slice(0, 8)}.json`,
                "g",
              )
            }
            disabled={busy === "g" || !studentId}
            className="flex items-center gap-1.5 border border-fg bg-fg px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-bg hover:bg-bg hover:text-fg disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            {busy === "g" ? "Building…" : "Download"}
          </button>
        </div>
      </section>

      <section>
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          Anonymized dataset
        </div>
        <div className="mt-1 text-[11px] text-fg-dim leading-relaxed">
          De-identified rows across the whole pilot — cohort, dates, scores,
          questionnaire responses, aggregate rubric. No names, no student_ids,
          no transcripts. For academic publication and funder reports.
        </div>
        <button
          onClick={() =>
            download(
              `/api/superadmin/export?anon=1`,
              `ijwi-anon-${new Date().toISOString().slice(0, 10)}.json`,
              "a",
            )
          }
          disabled={busy === "a"}
          className="mt-3 flex items-center gap-1.5 border border-fg bg-fg px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-bg hover:bg-bg hover:text-fg disabled:opacity-50"
        >
          <Download className="h-3 w-3" />
          {busy === "a" ? "Building…" : "Download anonymized JSON"}
        </button>
      </section>
    </div>
  );
}
