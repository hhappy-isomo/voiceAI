import { Card } from "./Card";
import type { LucideIcon } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { Sparkline } from "@/components/Sparkline";
import { splitValue } from "@/lib/format";

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  series,
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon?: LucideIcon;
  accent?: "violet" | "cyan" | "mint" | "magenta";
  series?: number[];
}) {
  const parts = splitValue(value);

  return (
    <Card className="flex items-stretch justify-between">
      <div className="flex flex-col">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted">{label}</div>
        <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
          {parts ? <CountUp value={parts.num} suffix={parts.suffix} /> : value}
        </div>
        {delta && (
          <div className="mt-1 text-[10px] uppercase tracking-wider text-fg-dim">{delta}</div>
        )}
        {series && series.length >= 2 && (
          <div className="mt-auto pt-3 text-fg">
            <Sparkline data={series} />
          </div>
        )}
      </div>
      {Icon && (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-fg bg-bg">
          <Icon className="h-5 w-5 text-fg" />
        </div>
      )}
    </Card>
  );
}
