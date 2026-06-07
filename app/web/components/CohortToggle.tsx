"use client";

import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

export function CohortToggle({
  studentId,
  cohort,
}: {
  studentId: string;
  cohort: "base" | "foundation";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setCohort(next: "base" | "foundation") {
    if (next === cohort || pending) return;
    const supabase = createClient();
    startTransition(async () => {
      await supabase.from("students").update({ cohort: next }).eq("student_id", studentId);
      router.refresh();
    });
  }

  return (
    <div className="inline-flex items-center border border-fg/30 text-[10px]">
      {(["base", "foundation"] as const).map((c) => (
        <button
          key={c}
          onClick={() => setCohort(c)}
          disabled={pending}
          className={cn(
            "px-3 py-1 uppercase tracking-widest transition-colors",
            cohort === c
              ? "bg-fg text-bg"
              : "text-fg-dim hover:text-fg",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
