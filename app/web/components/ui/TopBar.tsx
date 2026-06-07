import { cn } from "@/lib/cn";

export function TopBar({
  crumbs,
  title,
  right,
}: {
  crumbs: string[];
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4 border-b border-fg/20 px-1 pb-5 pt-1">
      <div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-fg-muted">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className={cn(i === crumbs.length - 1 && "text-fg")}>{c}</span>
              {i < crumbs.length - 1 && <span>/</span>}
            </span>
          ))}
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight uppercase">{title}</h1>
      </div>
      {right}
    </div>
  );
}
