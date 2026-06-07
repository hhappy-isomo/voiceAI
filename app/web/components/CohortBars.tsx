import { Card } from "@/components/ui/Card";

type Metrics = {
  cohort: "base" | "foundation";
  avg_talk_min: number | null;
  silent_sessions: number | null;
  det_gain: number | null;
  ixl_gain: number | null;
  confidence_gain: number | null;
  pct_would_continue: number | null;
};

const ROWS: { key: keyof Omit<Metrics, "cohort">; label: string }[] = [
  { key: "avg_talk_min", label: "Avg talk-time (min)" },
  { key: "det_gain", label: "DET gain" },
  { key: "ixl_gain", label: "IXL gain" },
  { key: "confidence_gain", label: "Confidence gain" },
  { key: "pct_would_continue", label: "% would continue" },
];

export function CohortBars({ metrics }: { metrics: Metrics[] }) {
  const base = metrics.find((m) => m.cohort === "base");
  const foundation = metrics.find((m) => m.cohort === "foundation");

  return (
    <Card className="!p-0">
      <div className="flex items-center justify-between border-b border-fg/20 px-5 py-4">
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.2em]">
            Base vs foundation
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
            Bar fill = relative magnitude per row
          </div>
        </div>
        <Legend />
      </div>
      <div className="divide-y divide-fg/15">
        {ROWS.map(({ key, label }) => {
          const a = base?.[key] ?? 0;
          const b = foundation?.[key] ?? 0;
          const max = Math.max(Math.abs(a), Math.abs(b), 1);
          return (
            <div key={key} className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3">
              <div className="text-[11px] uppercase tracking-widest text-fg-dim">
                {label}
              </div>
              <div className="space-y-1.5">
                <Bar
                  label="B"
                  value={a}
                  pct={Math.abs(a) / max}
                  pattern="solid"
                />
                <Bar
                  label="F"
                  value={b}
                  pct={Math.abs(b) / max}
                  pattern="hatched"
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Bar({
  label,
  value,
  pct,
  pattern,
}: {
  label: string;
  value: number;
  pct: number;
  pattern: "solid" | "hatched";
}) {
  const width = Math.max(2, pct * 100);
  return (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-fg-muted">
        {label}
      </div>
      <div className="relative h-4 border border-fg/40">
        <div
          className="h-full"
          style={{
            width: `${width}%`,
            background:
              pattern === "solid"
                ? "var(--color-fg)"
                : "repeating-linear-gradient(45deg, var(--color-fg) 0 2px, transparent 2px 5px)",
          }}
        />
      </div>
      <div className="w-12 text-right text-[11px] tabular-nums">{value}</div>
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden sm:flex items-center gap-3 text-[10px] uppercase tracking-widest text-fg-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 bg-fg" />
        Base
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-3 w-3 border border-fg"
          style={{
            background:
              "repeating-linear-gradient(45deg, var(--color-fg) 0 2px, transparent 2px 5px)",
          }}
        />
        Foundation
      </span>
    </div>
  );
}
