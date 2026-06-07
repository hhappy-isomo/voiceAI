import { requireSuperadmin } from "@/lib/dal";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { AgentsPanel } from "./AgentsPanel";

type EAgent = {
  agent_id: string;
  name: string;
  created_at_unix_secs?: number;
};

async function fetchAgents(): Promise<EAgent[]> {
  if (!process.env.ELEVENLABS_API_KEY) return [];
  try {
    const r = await fetch(
      "https://api.elevenlabs.io/v1/convai/agents?page_size=100",
      {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
        cache: "no-store",
      },
    );
    if (!r.ok) return [];
    const j = await r.json();
    return j.agents ?? [];
  } catch {
    return [];
  }
}

export default async function AgentsPage() {
  await requireSuperadmin();
  const agents = await fetchAgents();
  return (
    <>
      <TopBar crumbs={["Superadmin", "Agents"]} title="Agents" />
      <Card className="!p-0">
        <AgentsPanel initialAgents={agents} />
      </Card>
    </>
  );
}
