"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, Pause } from "lucide-react";
import { cn } from "@/lib/cn";

export function PowerControls({
  initial,
}: {
  initial: { kill_all: boolean; drain_mode: boolean };
}) {
  const router = useRouter();
  const [killAll, setKillAll] = useState(initial.kill_all);
  const [drainMode, setDrainMode] = useState(initial.drain_mode);
  const [pending, setPending] = useState(false);

  async function toggle(key: "kill_all" | "drain_mode", next: boolean) {
    const verb = next ? "ENGAGE" : "RELEASE";
    const word = key === "kill_all" ? "kill switch" : "drain mode";
    if (
      !confirm(
        `${verb} ${word.toUpperCase()}?\n\n${
          key === "kill_all" && next
            ? "Students lose portal access for new conversations. Calls already in progress will continue until the student hangs up — this does NOT terminate live calls."
            : key === "drain_mode" && next
              ? "No new conversations will be allowed (existing finish naturally)."
              : "Reverting to normal operation."
        }`,
      )
    )
      return;
    setPending(true);
    const r = await fetch("/api/superadmin/cost-caps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    });
    setPending(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(`Error: ${j.error ?? r.status}`);
      return;
    }
    if (key === "kill_all") setKillAll(next);
    if (key === "drain_mode") setDrainMode(next);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Row
        title="Kill switch"
        description="Bounces all students from the portal — they can't start a new conversation. Calls already in progress continue until the student hangs up; the kill switch does not terminate live ElevenLabs calls. Staff still get in. Use in an emergency (distress, runaway agent, lab evacuation)."
        icon={<AlertOctagon className="h-5 w-5" />}
        active={killAll}
        pending={pending}
        onClick={() => toggle("kill_all", !killAll)}
        engageLabel="ENGAGE KILL SWITCH"
        releaseLabel="Release kill switch"
      />

      <Row
        title="Drain mode"
        description="No new conversations allowed. Currently in-flight calls finish naturally. Use to gracefully wind down the day or before a maintenance window."
        icon={<Pause className="h-5 w-5" />}
        active={drainMode}
        pending={pending}
        onClick={() => toggle("drain_mode", !drainMode)}
        engageLabel="Engage drain"
        releaseLabel="Release drain"
      />
    </div>
  );
}

function Row({
  title,
  description,
  icon,
  active,
  pending,
  onClick,
  engageLabel,
  releaseLabel,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  active: boolean;
  pending: boolean;
  onClick: () => void;
  engageLabel: string;
  releaseLabel: string;
}) {
  return (
    <div
      className={cn(
        "border p-4 flex items-center gap-4",
        active ? "border-fg bg-fg/[0.06]" : "border-fg/30",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center border",
          active ? "border-fg bg-fg text-bg" : "border-fg/30",
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          {title}
          {active && (
            <span className="ml-2 bg-fg px-1.5 py-[1px] text-[9px] text-bg animate-pulse">
              ACTIVE
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] text-fg-dim leading-relaxed">
          {description}
        </div>
      </div>
      <button
        onClick={onClick}
        disabled={pending}
        className={cn(
          "border px-3 py-2 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50",
          active
            ? "border-fg text-fg hover:bg-fg/10"
            : "border-fg bg-fg text-bg hover:bg-bg hover:text-fg",
        )}
      >
        {active ? releaseLabel : engageLabel}
      </button>
    </div>
  );
}
