"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function SyncUsageButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setPending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync-usage", { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        setMsg(`Error: ${j.error ?? `HTTP ${res.status}`}`);
      } else {
        setMsg(
          `${j.inserted ?? 0} synced · ${j.untagged ?? 0} untagged · ${j.conversations ?? 0} total`,
        );
        router.refresh();
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && (
        <span className="text-[10px] uppercase tracking-widest text-fg-dim">
          {msg}
        </span>
      )}
      <button
        onClick={sync}
        disabled={pending}
        className="inline-flex items-center gap-1.5 border border-fg bg-fg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-bg hover:bg-bg hover:text-fg disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Syncing…" : "Sync ElevenLabs"}
      </button>
    </div>
  );
}
