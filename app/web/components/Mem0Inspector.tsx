import { Brain } from "lucide-react";
import { Card } from "@/components/ui/Card";

type Mem = {
  id?: string;
  memory?: string;
  text?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
};

async function fetchMem0(studentId: string): Promise<Mem[] | null> {
  if (!process.env.MEM0_API_KEY) return null;
  try {
    const r = await fetch(
      `https://api.mem0.ai/v1/memories/?user_id=${encodeURIComponent(studentId)}`,
      {
        headers: { Authorization: `Token ${process.env.MEM0_API_KEY}` },
        cache: "no-store",
      },
    );
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : (j.results ?? j.memories ?? []);
  } catch {
    return null;
  }
}

export async function Mem0Inspector({ studentId }: { studentId: string }) {
  const memories = await fetchMem0(studentId);

  return (
    <Card className="!p-0">
      <div className="flex items-center gap-2 border-b border-fg/20 px-5 py-4">
        <Brain className="h-4 w-4" />
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.2em]">
            What Mem0 actually has on this student
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
            Live · the tutor reads this at the start of every session
          </div>
        </div>
      </div>
      {memories == null ? (
        <div className="px-5 py-8 text-center text-[11px] uppercase tracking-widest text-fg-muted">
          MEM0_API_KEY not set
        </div>
      ) : memories.length === 0 ? (
        <div className="px-5 py-8 text-center text-[11px] uppercase tracking-widest text-fg-muted">
          No memories yet
        </div>
      ) : (
        <ul className="divide-y divide-fg/15">
          {memories.map((m, i) => (
            <li key={m.id ?? i} className="px-5 py-3">
              <div className="text-sm leading-relaxed">
                {m.memory ?? m.text ?? JSON.stringify(m).slice(0, 200)}
              </div>
              {(m.created_at || m.updated_at) && (
                <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
                  {new Date(m.updated_at ?? m.created_at!).toLocaleString()}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
