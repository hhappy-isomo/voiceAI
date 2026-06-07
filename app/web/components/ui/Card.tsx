import { cn } from "@/lib/cn";

export function Card({
  className,
  glow = false,
  children,
}: {
  className?: string;
  glow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rect p-5",
        glow && "border-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-sm font-medium text-fg-dim tracking-wide uppercase", className)}>
      {children}
    </h3>
  );
}
