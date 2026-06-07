import { BYPASS_AUTH, requireFacilitator } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { CalendarRow, type CalRow } from "./CalendarRow";

export default async function CalendarPage() {
  await requireFacilitator();

  let rows: CalRow[];
  let activeNo = 1;

  if (BYPASS_AUTH) {
    const start = new Date();
    rows = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i + Math.floor(i / 5) * 2);
      return {
        day_no: i + 1,
        planned_date: d.toISOString().slice(0, 10),
        session_no: i + 1,
        skipped: false,
        notes: null,
      };
    });
  } else {
    const supabase = await createClient();
    const [cal, cfg] = await Promise.all([
      supabase
        .from("pilot_calendar")
        .select("day_no, planned_date, session_no, skipped, notes")
        .order("day_no"),
      supabase.from("pilot_config").select("active_session_no").eq("id", 1).single(),
    ]);
    rows = (cal.data ?? []) as CalRow[];
    activeNo = cfg.data?.active_session_no ?? 1;
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <TopBar crumbs={["Pages", "Dashboard", "Calendar"]} title="24-day calendar" />
      <Card className="!p-0">
        <div className="border-b border-fg/20 px-5 py-4">
          <div className="text-sm font-bold uppercase tracking-[0.2em]">
            Planned dates · sessions × days
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
            Manual activation only — this is the plan, not the trigger.
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-[10px] uppercase tracking-widest text-fg-muted">
            <tr className="border-b border-fg/15">
              <th className="px-5 py-3 font-bold">Day</th>
              <th className="px-5 py-3 font-bold">Date</th>
              <th className="px-5 py-3 font-bold">Session</th>
              <th className="px-5 py-3 font-bold">Skipped</th>
              <th className="px-5 py-3 font-bold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <CalendarRow
                key={r.day_no}
                row={r}
                isToday={r.planned_date === today}
                isLive={r.session_no === activeNo}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
