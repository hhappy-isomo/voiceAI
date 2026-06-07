"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";

export function MasterPromptForm({
  sessions,
}: {
  sessions: { no: number; title: string }[];
}) {
  const router = useRouter();
  const [no, setNo] = useState(1);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function push() {
    if (!confirm(`Push Session ${String(no).padStart(2, "0")} to ALL agents?`)) return;
    setPending(true);
    setResult(null);
    const r = await fetch("/api/superadmin/master-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_no: no }),
    });
    const j = await r.json();
    setPending(false);
    if (!r.ok) {
      setResult(`Error: ${j.error ?? r.status}`);
      return;
    }
    setResult(`${j.succeeded ?? 0} ok · ${j.failed ?? 0} failed · across ${j.agents ?? 0} agents`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
          Session
        </div>
        <select
          value={no}
          onChange={(e) => setNo(Number(e.target.value))}
          className="w-full appearance-none border border-fg/30 bg-bg px-3 py-2.5 text-sm outline-none focus:border-fg"
        >
          {sessions.map((s) => (
            <option key={s.no} value={s.no} className="bg-bg">
              Session {String(s.no).padStart(2, "0")} — {s.title}
            </option>
          ))}
        </select>
      </label>

      <button
        onClick={push}
        disabled={pending}
        className="inline-flex items-center gap-2 border border-fg bg-fg px-5 py-3 text-sm font-bold uppercase tracking-wider text-bg hover:bg-bg hover:text-fg disabled:opacity-60"
      >
        <Megaphone className="h-4 w-4" />
        {pending ? "Pushing…" : "Push to all agents"}
      </button>

      {result && (
        <div className="border border-fg px-3 py-2 text-[11px] uppercase tracking-widest">
          {result}
        </div>
      )}
    </div>
  );
}
