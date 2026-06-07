import { requireSuperadmin } from "@/lib/dal";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { VoicesPanel } from "./VoicesPanel";
import { createClient } from "@/lib/supabase/server";

type EVoice = {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  description?: string;
};

async function fetchVoices(): Promise<EVoice[]> {
  if (!process.env.ELEVENLABS_API_KEY) return [];
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
      cache: "no-store",
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j.voices ?? [];
  } catch {
    return [];
  }
}

export default async function VoicesPage() {
  await requireSuperadmin();
  const supabase = await createClient();
  const [voices, approved] = await Promise.all([
    fetchVoices(),
    supabase.from("approved_voices").select("voice_id"),
  ]);
  const approvedSet = new Set(
    (approved.data ?? []).map((r) => r.voice_id),
  );
  return (
    <>
      <TopBar crumbs={["Superadmin", "Voices"]} title="Voice library" />
      <Card className="!p-0">
        <VoicesPanel
          voices={voices.map((v) => ({
            voice_id: v.voice_id,
            name: v.name,
            category: v.category,
            description: v.description,
            approved: approvedSet.has(v.voice_id),
          }))}
        />
      </Card>
    </>
  );
}
