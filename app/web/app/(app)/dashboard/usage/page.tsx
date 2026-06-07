import { BYPASS_AUTH, requireFacilitator } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { MetricCard } from "@/components/ui/MetricCard";
import { CreditCard, MessageSquare, Brain } from "lucide-react";

// Rough USD per unit (update from your billing dashboards).
const COST_PER_UNIT = {
  elevenlabs: 0.00003, // ~$0.30 per 10,000 chars on Creator tier (approx)
  anthropic: 0.000003, // ~$3 per 1M input tokens (Sonnet 4.6, approx)
};

type ElevenlabsSub = {
  character_count?: number;
  character_limit?: number;
  next_character_count_reset_unix?: number;
  tier?: string;
};

async function fetchElevenlabsUsage(): Promise<ElevenlabsSub | null> {
  if (!process.env.ELEVENLABS_API_KEY) return null;
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as ElevenlabsSub;
  } catch {
    return null;
  }
}

export default async function UsagePage() {
  await requireFacilitator();

  let usageRows: { source: string; units: number; cost_usd: number | null }[] = [];
  if (!BYPASS_AUTH) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("usage_log")
      .select("source, units, cost_usd");
    usageRows = data ?? [];
  }

  const sums = usageRows.reduce(
    (acc, r) => {
      acc[r.source] = (acc[r.source] ?? 0) + Number(r.units);
      acc[`${r.source}_cost`] =
        (acc[`${r.source}_cost`] ?? 0) + Number(r.cost_usd ?? 0);
      return acc;
    },
    {} as Record<string, number>,
  );

  const elSub = await fetchElevenlabsUsage();
  const elChars = elSub?.character_count ?? 0;
  const elLimit = elSub?.character_limit ?? 10000;
  const elPct = elLimit > 0 ? Math.min(100, (elChars / elLimit) * 100) : 0;

  const claudeTokens = sums.anthropic ?? 0;
  const claudeCost =
    sums.anthropic_cost ?? claudeTokens * COST_PER_UNIT.anthropic;
  const elCost = elChars * COST_PER_UNIT.elevenlabs;

  return (
    <>
      <TopBar crumbs={["Pages", "Dashboard", "Usage"]} title="Cost & usage" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="ElevenLabs chars"
          value={elChars.toLocaleString()}
          delta={`${elPct.toFixed(0)}% of ${elLimit.toLocaleString()} (${elSub?.tier ?? "—"})`}
          icon={MessageSquare}
        />
        <MetricCard
          label="ElevenLabs est. $"
          value={`$${elCost.toFixed(2)}`}
          icon={CreditCard}
        />
        <MetricCard
          label="Claude tokens"
          value={claudeTokens.toLocaleString()}
          delta={`≈ $${claudeCost.toFixed(2)}`}
          icon={Brain}
        />
      </div>

      <Card className="mt-6">
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          Estimates only
        </div>
        <div className="mt-2 text-[12px] leading-relaxed text-fg-dim">
          ElevenLabs character count is live from your subscription endpoint.
          Claude token totals come from the <code className="text-fg">usage_log</code>{" "}
          table, written by /api/auto-rubric per call. Mem0 usage isn&apos;t
          metered by their API yet — that one&apos;s missing on purpose.
        </div>
        {elSub?.next_character_count_reset_unix && (
          <div className="mt-2 text-[11px] uppercase tracking-widest text-fg-muted">
            ElevenLabs quota resets{" "}
            {new Date(elSub.next_character_count_reset_unix * 1000).toLocaleString()}
          </div>
        )}
      </Card>
    </>
  );
}
