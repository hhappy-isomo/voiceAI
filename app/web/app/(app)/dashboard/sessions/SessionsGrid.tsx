"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Session } from "@/lib/sessions-data";

export function SessionsGrid({
  sessions,
  activeNo,
}: {
  sessions: Session[];
  activeNo: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function activate(n: number) {
    if (n === activeNo || busy != null || pending) return;
    if (
      !confirm(
        `Push Session ${String(n).padStart(2, "0")} as the live system prompt for ALL students?`,
      )
    )
      return;
    setBusy(n);
    setError(null);
    try {
      const res = await fetch("/api/activate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_no: n }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? `HTTP ${res.status}`);
      } else {
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const byWeek = new Map<number, Session[]>();
  for (const s of sessions) {
    const arr = byWeek.get(s.week) ?? [];
    arr.push(s);
    byWeek.set(s.week, arr);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);

  return (
    <>
      {error && (
        <div className="mb-4 border border-fg px-4 py-2 text-[11px] uppercase tracking-widest">
          {error}
        </div>
      )}
      <div className="space-y-6">
        {weeks.map((w) => (
          <div key={w}>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
              Week {w}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {byWeek.get(w)!.map((s) => {
                const isActive = s.no === activeNo;
                const isOpen = open === s.no;
                const isBusy = busy === s.no;
                return (
                  <div
                    key={s.no}
                    className={cn(
                      "rect flex flex-col",
                      isActive && "border-2",
                    )}
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : s.no)}
                      className="flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-fg/[0.04]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-widest text-fg-muted">
                          Session {String(s.no).padStart(2, "0")}
                          {isActive && (
                            <span className="ml-2 bg-fg px-1.5 py-[1px] text-[9px] text-bg">
                              LIVE
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-bold uppercase tracking-tight">
                          {s.title}
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-fg-muted" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-fg-muted" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="border-t border-fg/20 bg-fg/[0.02] px-4 py-3 max-h-72 overflow-y-auto scrollbar-thin text-[11px] whitespace-pre-wrap font-mono leading-relaxed">
                        {s.prompt}
                      </div>
                    )}

                    <div className="mt-auto border-t border-fg/20">
                      <button
                        onClick={() => activate(s.no)}
                        disabled={isActive || isBusy || pending}
                        className={cn(
                          "flex w-full items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors",
                          isActive
                            ? "bg-fg/10 text-fg-muted cursor-not-allowed"
                            : "bg-fg text-bg hover:bg-bg hover:text-fg disabled:opacity-50",
                        )}
                      >
                        <Play className="h-3 w-3" />
                        {isActive
                          ? "Currently live"
                          : isBusy
                            ? "Pushing…"
                            : "Activate"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
