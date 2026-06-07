"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Row = {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  approved: boolean;
};

export function VoicesPanel({ voices }: { voices: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(v: Row) {
    setBusy(v.voice_id);
    const r = await fetch("/api/superadmin/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voice_id: v.voice_id,
        voice_name: v.name,
        approve: !v.approved,
      }),
    });
    setBusy(null);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(`Error: ${j.error ?? r.status}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  const approved = voices.filter((v) => v.approved);
  const rest = voices.filter((v) => !v.approved);

  return (
    <>
      <div className="border-b border-fg/20 px-5 py-4">
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          ElevenLabs voices
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
          {approved.length} approved · {voices.length} total
        </div>
      </div>

      <Section title="Approved" voices={approved} busy={busy} pending={pending} onToggle={toggle} />
      <Section title="Available" voices={rest} busy={busy} pending={pending} onToggle={toggle} />
    </>
  );
}

function Section({
  title,
  voices,
  busy,
  pending,
  onToggle,
}: {
  title: string;
  voices: Row[];
  busy: string | null;
  pending: boolean;
  onToggle: (v: Row) => void;
}) {
  if (voices.length === 0) return null;
  return (
    <div className="border-t border-fg/15">
      <div className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
        {title}
      </div>
      <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
        {voices.map((v) => (
          <div
            key={v.voice_id}
            className="border-t border-fg/10 p-4 sm:border-l"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold uppercase tracking-wider">{v.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-fg-muted">
                  {v.category ?? "—"}
                </div>
              </div>
              <button
                onClick={() => onToggle(v)}
                disabled={busy === v.voice_id || pending}
                className={cn(
                  "inline-flex items-center gap-1 border px-2 py-1 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50",
                  v.approved
                    ? "border-fg bg-fg text-bg"
                    : "border-fg/30 text-fg-dim hover:border-fg hover:text-fg",
                )}
              >
                {v.approved ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {v.approved ? "Approved" : "Approve"}
              </button>
            </div>
            {v.description && (
              <div className="mt-2 text-[11px] text-fg-dim leading-relaxed line-clamp-2">
                {v.description}
              </div>
            )}
            <div className="mt-2 font-mono text-[10px] text-fg-muted">
              {v.voice_id}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
