"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, RefreshCw, Edit2 } from "lucide-react";
import { cn } from "@/lib/cn";

type EAgent = { agent_id: string; name: string; created_at_unix_secs?: number };

export function AgentsPanel({ initialAgents }: { initialAgents: EAgent[] }) {
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setBusy("refresh");
    const r = await fetch("/api/superadmin/agents");
    const j = await r.json();
    setAgents(j.agents ?? []);
    setBusy(null);
  }

  async function deleteAgent(id: string, name: string) {
    if (!confirm(`Delete agent "${name}"? Irreversible on ElevenLabs.`)) return;
    setBusy(id);
    const r = await fetch(`/api/superadmin/agents?agent_id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    setBusy(null);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(`Error: ${j.error ?? r.status}`);
      return;
    }
    await refresh();
    router.refresh();
  }

  async function createAgent(form: { name: string; prompt: string; first_message: string; voice_id: string }) {
    setBusy("create");
    const r = await fetch("/api/superadmin/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(null);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(`Error: ${j.error ?? r.status}`);
      return;
    }
    setShowCreate(false);
    await refresh();
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-fg/20 px-5 py-4">
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.2em]">
            All ElevenLabs agents
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
            {agents.length} agent{agents.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={!!busy}
            className="flex items-center gap-1.5 border border-fg/30 px-3 py-1.5 text-[10px] uppercase tracking-widest text-fg-dim hover:border-fg hover:text-fg disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", busy === "refresh" && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 border border-fg bg-fg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-bg hover:bg-bg hover:text-fg"
          >
            <Plus className="h-3 w-3" />
            New agent
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateForm
          onCancel={() => setShowCreate(false)}
          onSubmit={createAgent}
          pending={busy === "create"}
        />
      )}

      {agents.length === 0 ? (
        <div className="px-5 py-12 text-center text-[11px] uppercase tracking-widest text-fg-muted">
          No agents
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-[10px] uppercase tracking-widest text-fg-muted">
            <tr className="border-b border-fg/15">
              <th className="px-5 py-3 font-bold">Name</th>
              <th className="px-5 py-3 font-bold">Agent ID</th>
              <th className="px-5 py-3 font-bold">Created</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.agent_id} className="border-t border-fg/15">
                <td className="px-5 py-2 font-bold uppercase tracking-wider">{a.name}</td>
                <td className="px-5 py-2 font-mono text-[11px] text-fg-dim">{a.agent_id}</td>
                <td className="px-5 py-2 text-[11px] text-fg-dim">
                  {a.created_at_unix_secs
                    ? new Date(a.created_at_unix_secs * 1000).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-5 py-2 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      onClick={() => alert("Edit UI not built — use ElevenLabs dashboard or the PATCH /api/superadmin/agents endpoint")}
                      className="inline-flex items-center gap-1 border border-fg/30 px-2 py-1 text-[10px] uppercase tracking-widest text-fg-dim hover:border-fg hover:text-fg"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAgent(a.agent_id, a.name)}
                      disabled={busy === a.agent_id}
                      className="inline-flex items-center gap-1 border border-fg/30 px-2 py-1 text-[10px] uppercase tracking-widest text-fg-dim hover:border-fg hover:text-fg disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function CreateForm({
  onSubmit,
  onCancel,
  pending,
}: {
  onSubmit: (f: { name: string; prompt: string; first_message: string; voice_id: string }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("Hello! I'm so glad you're here. Tell me — where did your story begin?");
  const [voiceId, setVoiceId] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name || !prompt) return;
        onSubmit({ name, prompt, first_message: firstMessage, voice_id: voiceId });
      }}
      className="border-b border-fg/20 bg-fg/[0.03] p-5 space-y-3"
    >
      <input
        placeholder="Agent name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-fg/30 bg-bg px-3 py-2 text-sm outline-none focus:border-fg"
      />
      <input
        placeholder="Voice ID (leave blank to use the default)"
        value={voiceId}
        onChange={(e) => setVoiceId(e.target.value)}
        className="w-full border border-fg/30 bg-bg px-3 py-2 text-sm font-mono outline-none focus:border-fg"
      />
      <input
        placeholder="First message"
        value={firstMessage}
        onChange={(e) => setFirstMessage(e.target.value)}
        className="w-full border border-fg/30 bg-bg px-3 py-2 text-sm outline-none focus:border-fg"
      />
      <textarea
        placeholder="System prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={8}
        className="w-full border border-fg/30 bg-bg px-3 py-2 text-[12px] font-mono outline-none focus:border-fg"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !name || !prompt}
          className="border border-fg bg-fg px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-bg disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create agent"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-fg/30 px-4 py-2 text-[11px] uppercase tracking-widest text-fg-dim hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
