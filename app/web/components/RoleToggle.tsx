"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldOff } from "lucide-react";
import { cn } from "@/lib/cn";

export function RoleToggle({
  studentId,
  role,
  isSelf,
}: {
  studentId: string;
  role: "student" | "facilitator";
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const next = role === "facilitator" ? "student" : "facilitator";
  const label = role === "facilitator" ? "Demote" : "Promote";
  const confirmText =
    role === "facilitator"
      ? "Demote this facilitator back to student? They'll lose dashboard access."
      : "Promote this student to facilitator? They'll be able to view all student data.";

  function onClick() {
    if (isSelf || pending) return;
    if (!confirm(confirmText)) return;
    startTransition(async () => {
      const res = await fetch("/api/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, role: next }),
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
    <button
      onClick={onClick}
      disabled={isSelf || pending}
      title={
        isSelf
          ? "You can't change your own role"
          : `${label} to ${next}`
      }
      className={cn(
        "inline-flex items-center gap-1.5 border px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors",
        role === "facilitator"
          ? "border-fg bg-fg text-bg"
          : "border-fg/30 text-fg-dim hover:border-fg hover:text-fg",
        (isSelf || pending) && "opacity-40 cursor-not-allowed",
      )}
    >
      {role === "facilitator" ? (
        <Shield className="h-3 w-3" />
      ) : (
        <ShieldOff className="h-3 w-3" />
      )}
      {pending ? "…" : role === "facilitator" ? "Facilitator" : "Student"}
    </button>
  );
}
