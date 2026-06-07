"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function ConsentGate({ studentId: _studentId }: { studentId: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function agree() {
    setPending(true);
    const supabase = createClient();
    // give_consent() runs as security definer and updates the caller's own
    // students row (auth.uid()). Avoids needing an UPDATE RLS policy on the
    // students table (which would risk mass-assignment of role/cohort/etc).
    const { error } = await supabase.rpc("give_consent");
    if (error) {
      setPending(false);
      alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <Card glow className="w-full max-w-xl">
        <div className="flex flex-col gap-7 p-3">
          <div className="flex h-12 w-12 items-center justify-center border border-fg bg-bg">
            <Sparkles className="h-5 w-5 text-fg" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight uppercase">Before we start</h2>
            <p className="text-fg-dim leading-relaxed">
              I&apos;m happy to practice English with the AI tutor. I understand
              my sessions are recorded to help me improve and to help Ijwi
              build and improve its educational tools.
            </p>
          </div>
          <button
            onClick={agree}
            disabled={pending}
            className="w-full border border-fg bg-fg px-5 py-3 text-sm font-bold uppercase tracking-wider text-bg transition-colors hover:bg-bg hover:text-fg disabled:opacity-60"
          >
            {pending ? "Saving…" : "I agree — let's begin"}
          </button>
        </div>
      </Card>
    </div>
  );
}
