import { Card } from "@/components/ui/Card";
import { Ban } from "lucide-react";

export default function SuspendedPage() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <Card glow className="w-full max-w-xl">
        <div className="flex flex-col items-center gap-6 p-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center border border-fg bg-bg">
            <Ban className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold uppercase tracking-tight">
              Access paused
            </h2>
            <p className="max-w-md text-fg-dim leading-relaxed">
              Your facilitator has paused your access. Talk to them to lift it.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
