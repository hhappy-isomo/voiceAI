import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export type TodayStats = {
  date: string;
  current_session_no: number;
  current_session_topic?: string | null;
  students_done_today: number;
  students_total: number;
  silent_today: number;
};

export type ActivityItem = {
  student_id: string;
  student_name: string;
  session_no: number;
  held_on: string;
  talk_min: number;
  flagged_low_talk: boolean;
};

export function TodayCard({
  today,
  activity,
}: {
  today: TodayStats;
  activity: ActivityItem[];
}) {
  const pct = today.students_total
    ? Math.round((today.students_done_today / today.students_total) * 100)
    : 0;
  const dateLabel = new Date(today.date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <Card glow className="!p-0">
      <div className="grid lg:grid-cols-[1.2fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-fg/20">
        <div className="p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
            Today · {dateLabel}
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="text-5xl font-bold uppercase tracking-tight tabular-nums">
              Session {String(today.current_session_no).padStart(2, "0")}
            </div>
            <div className="text-sm text-fg-muted">/ 24</div>
          </div>
          {today.current_session_topic && (
            <div className="mt-2 text-sm text-fg-dim">
              {today.current_session_topic}
            </div>
          )}

          <div className="mt-5 border border-fg/30">
            <div className="flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-widest text-fg-muted">
              <span>Progress today</span>
              <span className="font-bold text-fg">
                {today.students_done_today} / {today.students_total}
              </span>
            </div>
            <div className="h-3 border-t border-fg/30">
              <div className="h-full bg-fg" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-0 border border-fg/30">
            <div className="px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-fg-muted">
                Silent today
              </div>
              <div className="mt-1 flex items-center gap-2 text-xl font-bold tabular-nums">
                {today.silent_today > 0 && <AlertTriangle className="h-4 w-4" />}
                {today.silent_today}
              </div>
            </div>
            <div className="border-l border-fg/30 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-fg-muted">
                Done
              </div>
              <div className="mt-1 flex items-center gap-2 text-xl font-bold tabular-nums">
                <CheckCircle2 className="h-4 w-4" />
                {pct}%
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="border-b border-fg/20 px-5 py-4">
            <div className="text-sm font-bold uppercase tracking-[0.2em]">
              Recent activity
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
              Last 5 sessions
            </div>
          </div>
          <ul className="divide-y divide-fg/15">
            {activity.length === 0 && (
              <li className="px-5 py-8 text-center text-[11px] uppercase tracking-widest text-fg-muted">
                No activity yet
              </li>
            )}
            {activity.map((a, i) => (
              <li key={i}>
                <Link
                  href={`/dashboard/students/${a.student_id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-fg hover:text-bg"
                >
                  <div>
                    <div className="text-sm font-bold uppercase tracking-wider">
                      {a.student_name}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-fg-muted">
                      Session {a.session_no} · {a.held_on}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm tabular-nums">
                    {a.flagged_low_talk && <AlertTriangle className="h-3 w-3" />}
                    {a.talk_min} min
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
