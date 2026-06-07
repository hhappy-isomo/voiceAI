"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Square } from "lucide-react";

export type ConvRow = {
  id: string;
  status: string;
  started: string | null;
  duration_s: number | null;
  messages: number | null;
};

export function LiveTable({ rows }: { rows: ConvRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function end(id: string) {
    if (!confirm(`Delete conversation ${id.slice(0, 8)}…?`)) return;
    setBusy(id);
    const res = await fetch("/api/end-conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: id }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Error: ${j.error ?? `HTTP ${res.status}`}`);
      return;
    }
    router.refresh();
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-[10px] uppercase tracking-widest text-fg-muted">
        <tr className="border-b border-fg/15">
          <th className="px-5 py-3 font-bold">Conv ID</th>
          <th className="px-5 py-3 font-bold">Status</th>
          <th className="px-5 py-3 font-bold">Started</th>
          <th className="px-5 py-3 font-bold text-right">Duration</th>
          <th className="px-5 py-3 font-bold text-right">Msgs</th>
          <th className="px-5 py-3"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-fg/15">
            <td className="px-5 py-2 font-mono text-[11px]">{r.id.slice(0, 16)}…</td>
            <td className="px-5 py-2 uppercase tracking-wider text-[11px]">
              {r.status}
            </td>
            <td className="px-5 py-2 text-[11px] text-fg-dim">
              {r.started ? new Date(r.started).toLocaleString() : "—"}
            </td>
            <td className="px-5 py-2 text-right tabular-nums">
              {r.duration_s != null ? `${Math.round(r.duration_s)}s` : "—"}
            </td>
            <td className="px-5 py-2 text-right tabular-nums">
              {r.messages ?? "—"}
            </td>
            <td className="px-5 py-2 text-right">
              <button
                onClick={() => end(r.id)}
                disabled={busy === r.id}
                className="inline-flex items-center gap-1 border border-fg/30 px-2 py-1 text-[10px] uppercase tracking-widest text-fg-dim hover:border-fg hover:text-fg disabled:opacity-50"
              >
                <Square className="h-3 w-3" />
                {busy === r.id ? "…" : "End"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
