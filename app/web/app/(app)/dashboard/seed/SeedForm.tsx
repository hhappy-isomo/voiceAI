"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

type Row = { email: string; name: string | null; cohort: "base" | "foundation" };
type PendingRow = {
  id: number;
  email: string;
  display_name: string | null;
  cohort: "base" | "foundation";
  added_at: string;
};

const EXAMPLE = `email,name,cohort
amani@example.rw,Amani K.,base
jolie@example.rw,Jolie U.,foundation
patrick@example.rw,Patrick M.,base`;

export function SeedForm({ pending }: { pending: PendingRow[] }) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [pendingInsert, setPendingInsert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parsed = useMemo(() => parseCsv(csv), [csv]);

  async function onSubmit() {
    if (parsed.valid.length === 0) return;
    setPendingInsert(true);
    setMessage(null);
    const supabase = createClient();
    const payload = parsed.valid.map((r) => ({
      email: r.email.toLowerCase(),
      display_name: r.name,
      cohort: r.cohort,
    }));
    const { error, count } = await supabase
      .from("pending_students")
      .upsert(payload, { onConflict: "email", count: "exact" });
    setPendingInsert(false);
    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }
    setMessage(`Saved ${count ?? payload.length} row${payload.length === 1 ? "" : "s"}.`);
    setCsv("");
    router.refresh();
  }

  async function remove(id: number) {
    const supabase = createClient();
    await supabase.from("pending_students").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="p-5 space-y-5">
      <div>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={EXAMPLE}
          rows={8}
          className="w-full border border-fg/30 bg-bg px-3 py-2.5 font-mono text-[12px] text-fg outline-none focus:border-fg placeholder:text-fg-muted/60"
        />
        <div className="mt-2 flex items-center gap-3 text-[10px] uppercase tracking-widest">
          <span className="text-fg">
            <strong className="tabular-nums">{parsed.valid.length}</strong> ready
          </span>
          {parsed.invalid.length > 0 && (
            <span className="flex items-center gap-1 text-fg">
              <AlertTriangle className="h-3 w-3" />
              <strong className="tabular-nums">{parsed.invalid.length}</strong> skipped
            </span>
          )}
        </div>
      </div>

      {parsed.invalid.length > 0 && (
        <div className="border border-fg/30 p-3 text-[11px] text-fg-dim">
          <div className="mb-1 font-bold uppercase tracking-widest text-fg">
            Skipped lines
          </div>
          <ul className="space-y-0.5 font-mono">
            {parsed.invalid.slice(0, 5).map((line, i) => (
              <li key={i} className="truncate">{line}</li>
            ))}
            {parsed.invalid.length > 5 && (
              <li className="text-fg-muted">…and {parsed.invalid.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={pendingInsert || parsed.valid.length === 0}
        className="w-full border border-fg bg-fg px-5 py-3 text-sm font-bold uppercase tracking-wider text-bg transition-colors hover:bg-bg hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pendingInsert ? "Saving…" : `Add ${parsed.valid.length || ""} pending student${parsed.valid.length === 1 ? "" : "s"}`}
      </button>

      {message && (
        <div className="border border-fg px-3 py-2 text-[11px] uppercase tracking-widest">
          {message}
        </div>
      )}

      <div className="border border-fg/20">
        <div className="border-b border-fg/20 px-4 py-3">
          <div className="text-sm font-bold uppercase tracking-[0.2em]">
            Pending invites
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
            They&apos;ll be auto-merged into students on first Google sign-in
          </div>
        </div>
        {pending.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] uppercase tracking-widest text-fg-muted">
            None yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-widest text-fg-muted">
              <tr className="border-b border-fg/15">
                <th className="px-4 py-2 font-bold">Email</th>
                <th className="px-4 py-2 font-bold">Name</th>
                <th className="px-4 py-2 font-bold">Cohort</th>
                <th className="px-4 py-2 font-bold text-right">Added</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id} className="border-t border-fg/15 hover:bg-fg/[0.05]">
                  <td className="px-4 py-2 font-mono text-[11px]">{p.email}</td>
                  <td className="px-4 py-2">{p.display_name ?? "—"}</td>
                  <td className="px-4 py-2 capitalize">{p.cohort}</td>
                  <td className="px-4 py-2 text-right text-[11px] text-fg-dim">
                    {p.added_at.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => remove(p.id)}
                      aria-label="Remove"
                      className="text-fg-muted hover:text-fg"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function parseCsv(input: string): { valid: Row[]; invalid: string[] } {
  const valid: Row[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip a likely header on the first non-empty line
    if (i === 0 && /^(email|name|address|cohort)/i.test(line)) continue;

    const parts = line.split(",").map((s) => s.trim());
    const [emailRaw, nameRaw, cohortRaw] = parts;
    const email = (emailRaw ?? "").toLowerCase();

    if (!email || !email.includes("@") || !email.includes(".")) {
      invalid.push(line);
      continue;
    }
    if (seen.has(email)) {
      invalid.push(line);
      continue;
    }
    seen.add(email);

    const cohort = cohortRaw?.toLowerCase() === "foundation" ? "foundation" : "base";
    const name = nameRaw && nameRaw.length > 0 ? nameRaw : null;
    valid.push({ email, name, cohort });
  }

  return { valid, invalid };
}

// suppress unused warning on cn (kept available for future styling work)
export const _cn = cn;
