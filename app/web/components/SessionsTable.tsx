"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { SessionDrawer, type SessionRow } from "@/components/SessionDrawer";

export function SessionsTable({ sessions }: { sessions: SessionRow[] }) {
  const [open, setOpen] = useState<SessionRow | null>(null);

  return (
    <>
      <table className="w-full text-sm">
        <thead className="text-left text-[10px] uppercase tracking-widest text-fg-muted">
          <tr className="border-b border-fg/15">
            <th className="px-5 py-2.5 font-bold">#</th>
            <th className="px-5 py-2.5 font-bold">Date</th>
            <th className="px-5 py-2.5 font-bold text-right">Duration</th>
            <th className="px-5 py-2.5 font-bold text-right">Talk</th>
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 && (
            <tr>
              <td colSpan={4} className="px-5 py-8 text-center text-fg-muted">
                No sessions yet.
              </td>
            </tr>
          )}
          {sessions.map((s) => (
            <tr
              key={s.id}
              onClick={() => setOpen(s)}
              className="cursor-pointer border-t border-fg/15 transition-colors hover:bg-fg hover:text-bg"
            >
              <td className="px-5 py-2.5 tabular-nums">
                {s.session_no ?? "—"}
              </td>
              <td className="px-5 py-2.5">{s.held_on}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">
                {s.duration_seconds != null ? `${Math.round(s.duration_seconds / 60)} min` : "—"}
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums">
                {s.student_talk_seconds != null ? (
                  <span
                    className={
                      s.flagged_low_talk
                        ? "inline-flex items-center gap-1 border border-current px-2 py-0.5 text-[10px] uppercase tracking-widest"
                        : ""
                    }
                  >
                    {s.flagged_low_talk && <AlertTriangle className="h-3 w-3" />}
                    {Math.round(s.student_talk_seconds / 60)} min
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <SessionDrawer session={open} onClose={() => setOpen(null)} />
    </>
  );
}
