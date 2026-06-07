"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw, Play } from "lucide-react";
import { cn } from "@/lib/cn";

export function StudentControls({
  studentId,
  suspended,
  isSelf,
}: {
  studentId: string;
  suspended: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleSuspend() {
    if (isSelf) return;
    const next = !suspended;
    const msg = next
      ? "Suspend this student? They lose portal access until reactivated."
      : "Reactivate this student?";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await fetch("/api/suspend-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, suspended: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Error: ${j.error ?? `HTTP ${res.status}`}`);
        return;
      }
      router.refresh();
    });
  }

  function reset() {
    if (isSelf) return;
    if (
      !confirm(
        "RESET this student?\n\nWipes sessions, assessments, questionnaire, memory snapshots, consent, and Mem0 memories.\n\nIrreversible.",
      )
    )
      return;
    if (!confirm("Are you really sure?")) return;
    startTransition(async () => {
      const res = await fetch("/api/reset-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Error: ${j.error ?? `HTTP ${res.status}`}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="inline-flex items-stretch border border-fg/30">
      <button
        onClick={toggleSuspend}
        disabled={isSelf || pending}
        title={isSelf ? "Can't suspend yourself" : suspended ? "Reactivate" : "Suspend"}
        className={cn(
          "flex items-center gap-1.5 border-r border-fg/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
          suspended
            ? "bg-fg text-bg"
            : "text-fg-dim hover:bg-fg/10 hover:text-fg",
          (isSelf || pending) && "opacity-40 cursor-not-allowed",
        )}
      >
        {suspended ? <Play className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
        {suspended ? "Suspended" : "Suspend"}
      </button>
      <button
        onClick={reset}
        disabled={isSelf || pending}
        title={isSelf ? "Can't reset yourself" : "Reset all student data"}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-fg-dim hover:bg-fg/10 hover:text-fg",
          (isSelf || pending) && "opacity-40 cursor-not-allowed",
        )}
      >
        <RotateCcw className="h-3 w-3" />
        Reset
      </button>
    </div>
  );
}
