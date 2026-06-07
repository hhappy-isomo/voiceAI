"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/cn";

type Role = "student" | "facilitator" | "superadmin";

const OPTIONS: { role: Role; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { role: "student", label: "Student", icon: User },
  { role: "facilitator", label: "Facilitator", icon: Shield },
  { role: "superadmin", label: "Superadmin", icon: ShieldCheck },
];

const ALLOWED: Record<Role, Role[]> = {
  student: [],
  facilitator: ["student", "facilitator"],
  superadmin: ["student", "facilitator", "superadmin"],
};

const CONFIRM: Record<string, string> = {
  "student->facilitator": "Promote this student to facilitator? They'll be able to view all student data.",
  "student->superadmin": "Promote this student straight to superadmin? They'll have full system access.",
  "facilitator->student": "Demote this facilitator back to student? They'll lose dashboard access.",
  "facilitator->superadmin": "Elevate this facilitator to superadmin? They'll be able to manage other facilitators.",
  "superadmin->facilitator": "Demote this superadmin to facilitator? They'll lose role-management powers.",
  "superadmin->student": "Demote this superadmin all the way to student? They'll lose all staff access.",
};

export function RoleToggle({
  studentId,
  role,
  isSelf,
  callerRole,
  selfChangeAllowed = false,
}: {
  studentId: string;
  role: Role;
  isSelf: boolean;
  callerRole: Role;
  selfChangeAllowed?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const allowed = ALLOWED[callerRole];
  const locked = isSelf && !selfChangeAllowed;

  function setRole(next: Role) {
    if (next === role || locked || pending) return;
    if (!allowed.includes(next)) return;
    let msg = CONFIRM[`${role}->${next}`] ?? `Set role to ${next}?`;
    if (isSelf) msg = `Change YOUR OWN role to ${next}?\n\n${msg}`;
    if (!confirm(msg)) return;
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
    <div
      title={
        locked
          ? "You're the only superadmin — can't change your own role"
          : "Change role"
      }
      className={cn(
        "inline-flex items-stretch border border-fg/30",
        locked && "opacity-60",
      )}
    >
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const active = role === o.role;
        const canPick = !locked && !pending && allowed.includes(o.role);
        return (
          <button
            key={o.role}
            onClick={() => setRole(o.role)}
            disabled={!canPick && !active}
            className={cn(
              "flex items-center gap-1.5 border-r border-fg/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest last:border-r-0 transition-colors",
              active
                ? "bg-fg text-bg"
                : canPick
                  ? "text-fg-dim hover:bg-fg/10 hover:text-fg cursor-pointer"
                  : "text-fg-muted cursor-not-allowed",
            )}
          >
            <Icon className="h-3 w-3" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
