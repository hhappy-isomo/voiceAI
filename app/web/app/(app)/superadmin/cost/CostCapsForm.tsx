"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CostCapsForm({
  initial,
  currentSpend,
  topStudentSpend,
}: {
  initial: { monthly_ceiling_usd: number | null; per_student_cap_usd: number | null };
  currentSpend: number;
  topStudentSpend: number;
}) {
  const router = useRouter();
  const [monthly, setMonthly] = useState(
    initial.monthly_ceiling_usd != null ? String(initial.monthly_ceiling_usd) : "",
  );
  const [perStudent, setPerStudent] = useState(
    initial.per_student_cap_usd != null ? String(initial.per_student_cap_usd) : "",
  );
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setMsg(null);
    const r = await fetch("/api/superadmin/cost-caps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthly_ceiling_usd: monthly === "" ? null : Number(monthly),
        per_student_cap_usd: perStudent === "" ? null : Number(perStudent),
      }),
    });
    setPending(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMsg(`Error: ${j.error ?? r.status}`);
      return;
    }
    setMsg("Saved.");
    router.refresh();
  }

  const monthlyN = Number(monthly);
  const monthlyPct =
    monthly && monthlyN > 0 ? Math.min(100, (currentSpend / monthlyN) * 100) : null;

  return (
    <div className="space-y-5">
      <label className="block">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
          Monthly $ ceiling
        </div>
        <input
          type="number"
          step="0.01"
          placeholder="e.g. 200 (blank = no ceiling)"
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          className="w-full border border-fg/30 bg-bg px-3 py-2.5 text-sm outline-none focus:border-fg"
        />
        <div className="mt-2 text-[11px] uppercase tracking-widest text-fg-muted">
          Current spend ${currentSpend.toFixed(2)}
          {monthlyPct != null && ` · ${monthlyPct.toFixed(0)}% of ceiling`}
        </div>
        {monthlyPct != null && (
          <div className="mt-2 h-2 border border-fg/40">
            <div
              className="h-full bg-fg anim-draw-in"
              style={{ width: `${monthlyPct}%` }}
            />
          </div>
        )}
      </label>

      <label className="block">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
          Per-student $ cap
        </div>
        <input
          type="number"
          step="0.01"
          placeholder="e.g. 25 (blank = no cap)"
          value={perStudent}
          onChange={(e) => setPerStudent(e.target.value)}
          className="w-full border border-fg/30 bg-bg px-3 py-2.5 text-sm outline-none focus:border-fg"
        />
        <div className="mt-2 text-[11px] uppercase tracking-widest text-fg-muted">
          Top-spending student so far: ${topStudentSpend.toFixed(2)}
        </div>
      </label>

      <button
        onClick={save}
        disabled={pending}
        className="border border-fg bg-fg px-5 py-3 text-sm font-bold uppercase tracking-wider text-bg hover:bg-bg hover:text-fg disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save caps"}
      </button>

      {msg && (
        <div className="border border-fg px-3 py-2 text-[11px] uppercase tracking-widest">
          {msg}
        </div>
      )}

      <div className="border border-fg/30 p-3 text-[11px] text-fg-dim leading-relaxed">
        <strong className="uppercase tracking-widest">How enforcement works:</strong>{" "}
        The proxy reads <code className="text-fg">cost_caps</code> on every request.
        Kill switch (set on the Power page) immediately routes students to
        <code className="text-fg">/paused</code>. Monthly ceiling and per-student cap
        are recorded but currently advisory — wire them into the ElevenLabs post-call
        webhook to auto-flip kill switch once a threshold is crossed.
      </div>
    </div>
  );
}
