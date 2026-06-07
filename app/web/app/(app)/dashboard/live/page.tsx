import { requireFacilitator } from "@/lib/dal";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { LiveTable, type ConvRow } from "./LiveTable";

type EConv = {
  conversation_id: string;
  agent_id: string;
  start_time_unix_secs?: number;
  call_duration_secs?: number;
  status?: string;
  message_count?: number;
};

async function fetchConversations(): Promise<EConv[]> {
  if (!process.env.ELEVENLABS_API_KEY) return [];
  try {
    const r = await fetch(
      "https://api.elevenlabs.io/v1/convai/conversations?page_size=20",
      {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
        cache: "no-store",
      },
    );
    if (!r.ok) return [];
    const j = (await r.json()) as { conversations?: EConv[] };
    return j.conversations ?? [];
  } catch {
    return [];
  }
}

export default async function LivePage() {
  await requireFacilitator();
  const convs = await fetchConversations();

  const rows: ConvRow[] = convs.map((c) => ({
    id: c.conversation_id,
    status: c.status ?? "—",
    started: c.start_time_unix_secs
      ? new Date(c.start_time_unix_secs * 1000).toISOString()
      : null,
    duration_s: c.call_duration_secs ?? null,
    messages: c.message_count ?? null,
  }));

  return (
    <>
      <TopBar crumbs={["Pages", "Dashboard", "Live"]} title="Live & recent" />

      <Card glow className="mb-5">
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          About this page
        </div>
        <div className="mt-2 text-[12px] leading-relaxed text-fg-dim">
          ElevenLabs Convai doesn&apos;t expose a server-side &ldquo;terminate
          active session&rdquo; — the browser holds the websocket. The
          &ldquo;End&rdquo; button below deletes the conversation record
          (post-fact cleanup), it cannot force-disconnect a live call.
        </div>
      </Card>

      <Card className="!p-0">
        <div className="border-b border-fg/20 px-5 py-4">
          <div className="text-sm font-bold uppercase tracking-[0.2em]">
            Recent conversations · {rows.length}
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-[11px] uppercase tracking-widest text-fg-muted">
            No conversations yet
          </div>
        ) : (
          <LiveTable rows={rows} />
        )}
      </Card>
    </>
  );
}
