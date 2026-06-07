import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type WaterfallBar = {
  session_no: number;
  talk_min: number | null;
  flagged: boolean;
  held_on: string | null;
};

export function TalkTimeWaterfall({
  bars,
  target = 20,
}: {
  bars: WaterfallBar[];
  target?: number;
}) {
  const max = Math.max(
    target,
    ...bars.map((b) => (b.talk_min == null ? 0 : b.talk_min)),
  );
  const done = bars.filter((b) => b.talk_min != null && b.talk_min > 0).length;
  const avg =
    done > 0
      ? bars
          .filter((b) => b.talk_min != null && b.talk_min > 0)
          .reduce((s, b) => s + (b.talk_min ?? 0), 0) / done
      : 0;

  return (
    <Card className="!p-0">
      <div className="flex items-end justify-between border-b border-fg/20 px-5 py-4">
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.2em]">Talk-time waterfall</div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
            24 sessions · {done} done · avg {avg.toFixed(1)} min
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[10px] uppercase tracking-widest text-fg-muted">
          <Legend swatch={<span className="h-3 w-3 bg-fg" />} label="Met target" />
          <Legend
            swatch={
              <span
                className="h-3 w-3 border border-fg"
                style={{
                  background:
                    "repeating-linear-gradient(45deg, var(--color-fg) 0 2px, transparent 2px 5px)",
                }}
              />
            }
            label="Low talk"
          />
          <Legend swatch={<span className="h-3 w-3 border border-fg/40" />} label="Not done" />
        </div>
      </div>
      <div className="px-5 py-5">
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-fg/30"
            style={{ bottom: `${(target / max) * 100}%` }}
          >
            <div className="absolute -right-1 -translate-y-1/2 bg-bg pl-2 text-[9px] uppercase tracking-widest text-fg-muted">
              {target} min target
            </div>
          </div>
          <div className="flex h-32 items-end gap-1">
            {bars.map((b) => {
              const hasData = b.talk_min != null && b.talk_min > 0;
              const pct = hasData ? Math.min(100, ((b.talk_min ?? 0) / max) * 100) : 4;
              const title = hasData
                ? `Session ${b.session_no} · ${b.talk_min} min${b.flagged ? " · low" : ""}${b.held_on ? ` · ${b.held_on}` : ""}`
                : `Session ${b.session_no} · not done`;
              return (
                <div
                  key={b.session_no}
                  className="group relative flex-1 flex flex-col items-center"
                  title={title}
                >
                  <div
                    className={cn(
                      "anim-rise-in w-full border border-fg/40",
                      hasData ? "border-fg" : "border-dashed",
                    )}
                    style={{
                      height: `${pct}%`,
                      background: !hasData
                        ? "transparent"
                        : b.flagged
                          ? "repeating-linear-gradient(45deg, var(--color-fg) 0 2px, transparent 2px 5px)"
                          : "var(--color-fg)",
                      animationDelay: `${b.session_no * 18}ms`,
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1">
            {bars.map((b) => (
              <div
                key={b.session_no}
                className="flex-1 text-center text-[9px] tabular-nums text-fg-muted"
              >
                {b.session_no % 4 === 1 || b.session_no === 24 ? b.session_no : ""}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  );
}
