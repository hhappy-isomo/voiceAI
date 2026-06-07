"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, AlertTriangle, Ban, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { RoleToggle } from "@/components/RoleToggle";
import { CohortToggle } from "@/components/CohortToggle";
import { useRouter } from "next/navigation";

export type UserRow = {
  kind: "signed_in" | "pending";
  id: string;
  display_name: string | null;
  role: "student" | "facilitator" | "superadmin";
  cohort: "base" | "foundation";
  consent_given: boolean;
  suspended: boolean;
  enrolled_on: string;
  email: string | null;
};

type Filter = "all" | "student" | "facilitator" | "superadmin" | "pending" | "suspended";

export function UsersTable({
  rows,
  myId,
  superadminCount,
}: {
  rows: UserRow[];
  myId: string;
  superadminCount: number;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "pending" && r.kind !== "pending") return false;
      if (filter === "suspended" && !r.suspended) return false;
      if (
        (filter === "student" || filter === "facilitator" || filter === "superadmin") &&
        (r.kind !== "signed_in" || r.role !== filter)
      )
        return false;
      if (ql) {
        const hay = `${r.display_name ?? ""} ${r.email ?? ""} ${r.id}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rows, q, filter]);

  function exportCsv() {
    const headers = ["id", "kind", "name", "email", "role", "cohort", "consent", "suspended", "enrolled_on"];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          r.id,
          r.kind,
          csv(r.display_name ?? ""),
          csv(r.email ?? ""),
          r.role,
          r.cohort,
          r.consent_given ? "y" : "",
          r.suspended ? "y" : "",
          r.enrolled_on,
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ijwi-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function toggleSuspend(r: UserRow) {
    if (r.kind !== "signed_in") return;
    if (r.id === myId) {
      alert("Can't suspend yourself.");
      return;
    }
    const next = !r.suspended;
    if (
      !confirm(
        next
          ? "Suspend this user? They lose portal access until reactivated."
          : "Reactivate this user?",
      )
    )
      return;
    setBusy(r.id);
    const res = await fetch("/api/suspend-student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: r.id, suspended: next }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Error: ${j.error ?? res.status}`);
      return;
    }
    router.refresh();
  }

  async function resetUser(r: UserRow) {
    if (r.kind !== "signed_in") return;
    if (r.id === myId) {
      alert("Can't reset yourself.");
      return;
    }
    if (
      !confirm(
        "RESET this user?\n\nWipes sessions, assessments, questionnaire, memory snapshots, consent, and Mem0 memories.\n\nIrreversible.",
      )
    )
      return;
    if (!confirm("Are you really sure?")) return;
    setBusy(r.id);
    const res = await fetch("/api/reset-student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: r.id }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Error: ${j.error ?? res.status}`);
      return;
    }
    router.refresh();
  }

  async function removePending(r: UserRow) {
    if (r.kind !== "pending") return;
    if (!confirm(`Remove pending invite for ${r.email}?`)) return;
    setBusy(r.id);
    // Reuse the seed page's delete pattern via direct Supabase call.
    // Pending IDs come in as "pending:N"; strip the prefix.
    const pendingId = Number(r.id.replace(/^pending:/, ""));
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.from("pending_students").delete().eq("id", pendingId);
    setBusy(null);
    router.refresh();
  }

  return (
    <>
      <div className="border-b border-fg/20 px-5 py-4">
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          All users
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
          Students · facilitators · superadmins · pending invites — change access from here
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-fg/20 px-5 py-3">
        <div className="flex flex-1 min-w-[200px] items-center gap-2 border border-fg/30 px-3 py-1.5 focus-within:border-fg">
          <Search className="h-3 w-3 text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, id…"
            className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
          />
        </div>
        <div className="flex flex-wrap border border-fg/30">
          {(["all", "student", "facilitator", "superadmin", "pending", "suspended"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "border-r border-fg/30 px-2.5 py-1.5 text-[10px] uppercase tracking-widest last:border-r-0",
                filter === f ? "bg-fg text-bg" : "text-fg-dim hover:text-fg",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 border border-fg/30 px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-fg-dim hover:border-fg hover:text-fg"
        >
          <Download className="h-3 w-3" />
          CSV
        </button>
        <div className="ml-auto text-[10px] uppercase tracking-widest text-fg-muted">
          {filtered.length} / {rows.length}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[10px] uppercase tracking-widest text-fg-muted">
            <tr className="border-b border-fg/15">
              <th className="px-5 py-3 font-bold">Name</th>
              <th className="px-5 py-3 font-bold">State</th>
              <th className="px-5 py-3 font-bold">Role</th>
              <th className="px-5 py-3 font-bold">Cohort</th>
              <th className="px-5 py-3 font-bold">Consent</th>
              <th className="px-5 py-3 font-bold text-right">Controls</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-fg-muted">
                  No users match.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const isSelf = r.kind === "signed_in" && r.id === myId;
              const selfChangeAllowed =
                isSelf && r.role === "superadmin" && superadminCount > 1;
              return (
                <tr
                  key={r.id}
                  className={cn(
                    "border-t border-fg/15",
                    r.suspended && "bg-fg/[0.06]",
                  )}
                >
                  <td className="px-5 py-3">
                    {r.kind === "signed_in" ? (
                      <Link
                        href={`/dashboard/students/${r.id}`}
                        className="font-bold uppercase tracking-wider underline-offset-4 hover:underline"
                      >
                        {r.display_name ?? r.id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="font-bold uppercase tracking-wider">
                        {r.display_name ?? r.email}
                      </span>
                    )}
                    {isSelf && (
                      <span className="ml-2 border border-fg/30 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-fg-muted">
                        you
                      </span>
                    )}
                    {r.email && (
                      <div className="text-[10px] text-fg-muted font-mono mt-0.5">{r.email}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span
                        className={cn(
                          "border px-1.5 py-0.5 text-[10px] uppercase tracking-widest",
                          r.kind === "pending" ? "border-fg" : "border-fg/30 text-fg-dim",
                        )}
                      >
                        {r.kind === "pending" ? "Pending" : "Signed in"}
                      </span>
                      {r.suspended && (
                        <span className="inline-flex items-center gap-1 border border-fg px-1.5 py-0.5 text-[10px] uppercase tracking-widest">
                          <AlertTriangle className="h-3 w-3" />
                          Suspended
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {r.kind === "signed_in" ? (
                      <RoleToggle
                        studentId={r.id}
                        role={r.role}
                        isSelf={isSelf}
                        callerRole="superadmin"
                        selfChangeAllowed={selfChangeAllowed}
                      />
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest text-fg-muted">
                        (on sign-in)
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {r.kind === "signed_in" ? (
                      <CohortToggle studentId={r.id} cohort={r.cohort} />
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest text-fg-muted capitalize">
                        {r.cohort}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[10px] uppercase tracking-widest text-fg-dim">
                    {r.consent_given ? "Given" : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      {r.kind === "signed_in" ? (
                        <>
                          <button
                            onClick={() => toggleSuspend(r)}
                            disabled={isSelf || busy === r.id}
                            title={isSelf ? "Can't suspend yourself" : r.suspended ? "Reactivate" : "Suspend"}
                            className={cn(
                              "inline-flex items-center gap-1 border px-2 py-1 text-[10px] font-bold uppercase tracking-widest",
                              r.suspended
                                ? "border-fg bg-fg text-bg"
                                : "border-fg/30 text-fg-dim hover:border-fg hover:text-fg",
                              (isSelf || busy === r.id) && "opacity-40 cursor-not-allowed",
                            )}
                          >
                            <Ban className="h-3 w-3" />
                            {r.suspended ? "Suspended" : "Suspend"}
                          </button>
                          <button
                            onClick={() => resetUser(r)}
                            disabled={isSelf || busy === r.id}
                            title={isSelf ? "Can't reset yourself" : "Reset all data"}
                            className={cn(
                              "inline-flex items-center gap-1 border border-fg/30 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-fg-dim hover:border-fg hover:text-fg",
                              (isSelf || busy === r.id) && "opacity-40 cursor-not-allowed",
                            )}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => removePending(r)}
                          disabled={busy === r.id}
                          className="inline-flex items-center gap-1 border border-fg/30 px-2 py-1 text-[10px] uppercase tracking-widest text-fg-dim hover:border-fg hover:text-fg disabled:opacity-50"
                        >
                          Remove invite
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function csv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
