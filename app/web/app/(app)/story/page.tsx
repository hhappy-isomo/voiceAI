import { BYPASS_AUTH, getStudent } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { Brain, Calendar, Clock } from "lucide-react";

type Session = {
  id: number;
  session_no: number | null;
  held_on: string;
  duration_seconds: number | null;
  student_talk_seconds: number | null;
  topic: string | null;
};

type Memory = { summary: string | null; captured_on: string };

export default async function StoryPage() {
  // Proxy already enforces student-only access for this route group.
  const student = await getStudent();

  let sessions: Session[] = [];
  let memories: Memory[] = [];

  if (!BYPASS_AUTH) {
    const supabase = await createClient();
    const [sRes, mRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, session_no, held_on, duration_seconds, student_talk_seconds, topic")
        .eq("student_id", student.student_id)
        .order("held_on", { ascending: false })
        .order("id", { ascending: false }),
      supabase
        .from("memory_snapshots")
        .select("summary, captured_on")
        .eq("student_id", student.student_id)
        .order("captured_on", { ascending: false }),
    ]);
    sessions = (sRes.data as Session[] | null) ?? [];
    memories = (mRes.data as Memory[] | null) ?? [];
  }

  const latestMemory = memories[0];

  return (
    <>
      <TopBar crumbs={["Pages", "Story"]} title="Your story so far" />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 border-b border-fg/20 pb-3">
            <Brain className="h-4 w-4 text-fg" />
            <div className="text-sm font-bold uppercase tracking-[0.2em]">
              What your AI partner remembers
            </div>
          </div>
          {latestMemory?.summary ? (
            <>
              <p className="text-sm leading-relaxed text-fg whitespace-pre-wrap">
                {latestMemory.summary}
              </p>
              <div className="mt-3 text-[11px] uppercase tracking-widest text-fg-muted">
                Captured {formatDate(latestMemory.captured_on)}
              </div>
            </>
          ) : (
            <div className="text-sm text-fg-dim">
              Your AI partner is still getting to know you. The first memory snapshot
              is saved after your first call.
            </div>
          )}
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
              Calls so far
            </div>
            <div className="text-5xl font-bold tabular-nums">
              {String(sessions.length).padStart(2, "0")}
              <span className="ml-1 text-2xl text-fg-muted">/ 24</span>
            </div>
            <div className="text-[11px] uppercase tracking-widest text-fg-dim">
              {totalTalkMinutes(sessions)} minutes of you, talking
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <Card className="!p-0">
          <div className="border-b border-fg/20 px-5 py-4">
            <div className="text-sm font-bold uppercase tracking-[0.2em]">
              Every conversation
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
              Newest first · {sessions.length} {sessions.length === 1 ? "call" : "calls"}
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="px-5 py-12 text-center text-fg-muted text-sm">
              No calls yet. Today is the day.
            </div>
          ) : (
            <ul className="divide-y divide-fg/15">
              {sessions.map((s) => (
                <li key={s.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline gap-3">
                    {s.session_no != null && (
                      <span className="border border-fg px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-widest">
                        Day {s.session_no}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[12px] text-fg-dim">
                      <Calendar className="h-3 w-3" />
                      {formatDate(s.held_on)}
                    </span>
                    {s.student_talk_seconds != null && (
                      <span className="inline-flex items-center gap-1 text-[12px] text-fg-dim tabular-nums">
                        <Clock className="h-3 w-3" />
                        {Math.round(s.student_talk_seconds / 60)} min of talk
                      </span>
                    )}
                  </div>
                  {s.topic && (
                    <div className="mt-1 text-sm text-fg leading-relaxed">
                      {s.topic}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function formatDate(d: string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function totalTalkMinutes(sessions: Session[]): number {
  const total = sessions.reduce(
    (acc, s) => acc + (s.student_talk_seconds ?? 0),
    0,
  );
  return Math.round(total / 60);
}
