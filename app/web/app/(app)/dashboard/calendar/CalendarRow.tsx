"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

export type CalRow = {
  day_no: number;
  planned_date: string;
  session_no: number;
  skipped: boolean;
  notes: string | null;
};

export function CalendarRow({
  row,
  isToday,
  isLive,
}: {
  row: CalRow;
  isToday: boolean;
  isLive: boolean;
}) {
  const router = useRouter();
  const [skipped, setSkipped] = useState(row.skipped);
  const [notes, setNotes] = useState(row.notes ?? "");
  const [pending, startTransition] = useTransition();

  function save(patch: Partial<CalRow>) {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("pilot_calendar").update(patch).eq("day_no", row.day_no);
      router.refresh();
    });
  }

  return (
    <tr
      className={cn(
        "border-t border-fg/15",
        isToday && "bg-fg/[0.06]",
      )}
    >
      <td className="px-5 py-2 tabular-nums">
        <div className="flex items-center gap-2">
          <span className="font-bold">{String(row.day_no).padStart(2, "0")}</span>
          {isToday && (
            <span className="bg-fg px-1.5 py-[1px] text-[9px] uppercase tracking-widest text-bg">
              TODAY
            </span>
          )}
          {isLive && (
            <span className="border border-fg px-1.5 py-[1px] text-[9px] uppercase tracking-widest">
              LIVE
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-2 tabular-nums text-fg-dim">
        {new Date(row.planned_date).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </td>
      <td className="px-5 py-2 font-bold uppercase tracking-wider">
        Session {String(row.session_no).padStart(2, "0")}
      </td>
      <td className="px-5 py-2">
        <button
          onClick={() => {
            setSkipped((v) => {
              save({ skipped: !v });
              return !v;
            });
          }}
          disabled={pending}
          className={cn(
            "border px-2 py-1 text-[10px] uppercase tracking-widest",
            skipped ? "border-fg bg-fg text-bg" : "border-fg/30 text-fg-dim",
          )}
        >
          {skipped ? "Skip" : "On"}
        </button>
      </td>
      <td className="px-5 py-2">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (row.notes ?? "")) save({ notes: notes || null });
          }}
          placeholder="—"
          className="w-full border border-fg/20 bg-transparent px-2 py-1 text-[11px] focus:border-fg outline-none placeholder:text-fg-muted/50"
        />
      </td>
    </tr>
  );
}
