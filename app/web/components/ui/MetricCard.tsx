import { Card } from "./Card";
import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon?: LucideIcon;
  accent?: "violet" | "cyan" | "mint" | "magenta";
}) {
  return (
    <Card className="flex items-center justify-between">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted">{label}</div>
        <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{value}</div>
        {delta && (
          <div className="mt-1 text-[10px] uppercase tracking-wider text-fg-dim">{delta}</div>
        )}
      </div>
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center border border-fg bg-bg">
          <Icon className="h-5 w-5 text-fg" />
        </div>
      )}
    </Card>
  );
}
