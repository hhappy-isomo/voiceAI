"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

type Rule = {
  id: number;
  word_or_re: string;
  is_regex: boolean;
  severity: string;
  notes: string | null;
  added_at: string;
};
type Consent = {
  id: number;
  body: string;
  is_active: boolean;
  created_at: string;
};

export function GovernancePanel({
  rules,
  consents,
}: {
  rules: Rule[];
  consents: Consent[];
}) {
  const router = useRouter();
  const [newWord, setNewWord] = useState("");
  const [severity, setSeverity] = useState("warn");
  const [isRegex, setIsRegex] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [newConsent, setNewConsent] = useState("");

  async function addWord() {
    if (!newWord.trim()) return;
    setPending("add");
    const r = await fetch("/api/superadmin/governance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "add_word",
        word_or_re: newWord.trim(),
        is_regex: isRegex,
        severity,
      }),
    });
    setPending(null);
    if (!r.ok) {
      alert(`Error: ${(await r.json().catch(() => ({}))).error ?? r.status}`);
      return;
    }
    setNewWord("");
    router.refresh();
  }

  async function removeWord(id: number) {
    if (!confirm("Remove this rule?")) return;
    setPending(`r${id}`);
    await fetch("/api/superadmin/governance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "remove_word", id }),
    });
    setPending(null);
    router.refresh();
  }

  async function saveConsent() {
    if (newConsent.trim().length < 30) {
      alert("Consent text must be at least 30 characters.");
      return;
    }
    if (!confirm("Activate a new consent version? All future first-time signups will agree to this text. Already-consented students are unaffected.")) return;
    setPending("c");
    const r = await fetch("/api/superadmin/governance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "set_consent", body: newConsent }),
    });
    setPending(null);
    if (!r.ok) {
      alert(`Error: ${(await r.json().catch(() => ({}))).error ?? r.status}`);
      return;
    }
    setNewConsent("");
    router.refresh();
  }

  const active = consents.find((c) => c.is_active);

  return (
    <>
      <div className="border-b border-fg/20 px-5 py-4">
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          Banned-word / safety rules
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
          Recorded in safety_rules · enforcement is wired in the post-call webhook
          (writes flags to sessions for facilitator review)
        </div>
      </div>

      <div className="border-b border-fg/15 p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder="word or /regex/"
            className="flex-1 min-w-[200px] border border-fg/30 bg-bg px-3 py-2 text-sm outline-none focus:border-fg"
          />
          <label className="flex items-center gap-1.5 border border-fg/30 px-2 py-2 text-[10px] uppercase tracking-widest">
            <input
              type="checkbox"
              checked={isRegex}
              onChange={(e) => setIsRegex(e.target.checked)}
            />
            Regex
          </label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="appearance-none border border-fg/30 bg-bg px-3 py-2 text-sm outline-none focus:border-fg"
          >
            <option value="warn" className="bg-bg">Warn</option>
            <option value="flag" className="bg-bg">Flag</option>
            <option value="block" className="bg-bg">Block</option>
          </select>
          <button
            onClick={addWord}
            disabled={pending === "add" || !newWord.trim()}
            className="flex items-center gap-1.5 border border-fg bg-fg px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-bg hover:bg-bg hover:text-fg disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>

        {rules.length === 0 ? (
          <div className="border border-dashed border-fg/30 px-4 py-6 text-center text-[11px] uppercase tracking-widest text-fg-muted">
            No rules yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-widest text-fg-muted">
              <tr className="border-b border-fg/15">
                <th className="px-2 py-2 font-bold">Pattern</th>
                <th className="px-2 py-2 font-bold">Type</th>
                <th className="px-2 py-2 font-bold">Severity</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-fg/15">
                  <td className="px-2 py-2 font-mono">{r.word_or_re}</td>
                  <td className="px-2 py-2 text-[11px] uppercase tracking-widest text-fg-dim">
                    {r.is_regex ? "regex" : "word"}
                  </td>
                  <td className="px-2 py-2 text-[11px] uppercase tracking-widest">
                    {r.severity}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => removeWord(r.id)}
                      disabled={pending === `r${r.id}`}
                      className="inline-flex items-center gap-1 border border-fg/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-fg-dim hover:border-fg hover:text-fg disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-b border-fg/20 px-5 py-4">
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          Consent text — version control
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
          students.consent_version_id pins which version each student agreed to
        </div>
      </div>

      <div className="p-5 space-y-4">
        {active && (
          <div className="border border-fg/30 p-3 text-[11px] leading-relaxed">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
              Active (v{active.id} · {new Date(active.created_at).toLocaleDateString()})
            </div>
            <div>{active.body}</div>
          </div>
        )}

        <textarea
          value={newConsent}
          onChange={(e) => setNewConsent(e.target.value)}
          rows={5}
          placeholder="Draft a new consent text…"
          className="w-full border border-fg/30 bg-bg px-3 py-2.5 text-sm outline-none focus:border-fg"
        />
        <button
          onClick={saveConsent}
          disabled={pending === "c"}
          className="border border-fg bg-fg px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-bg hover:bg-bg hover:text-fg disabled:opacity-50"
        >
          {pending === "c" ? "Activating…" : "Activate new version"}
        </button>

        {consents.length > 1 && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-fg-muted">
              Past versions
            </div>
            <ul className="space-y-1">
              {consents
                .filter((c) => !c.is_active)
                .map((c) => (
                  <li
                    key={c.id}
                    className="border border-fg/15 px-3 py-2 text-[11px]"
                  >
                    <span className="text-fg-muted">
                      v{c.id} · {new Date(c.created_at).toLocaleDateString()} ·
                    </span>{" "}
                    {c.body.slice(0, 120)}…
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
