import { BYPASS_AUTH, getStudent, getUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { ConsentGate } from "@/components/ConsentGate";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { ConvaiWidget } from "@/components/ConvaiWidget";
import { mockSessionsCount } from "@/lib/mock";
import { Mic, Flame, Brain } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { humanizeMemory } from "@/lib/humanize-memory";

export default async function StudentHome() {
  // Proxy already bounced facilitators to /dashboard, so we know the
  // viewer is a student here (or bypass mode).
  const student = await getStudent();

  if (!student.consent_given) return <ConsentGate studentId={student.student_id} />;

  const user = await getUser();
  const firstName =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    student.display_name?.split(" ")[0] ??
    "friend";

  let sessionsDone: number;
  let lastMemory: { summary: string | null; captured_on: string | null } | null = null;
  let lastSession: { held_on: string; topic: string | null; session_no: number | null } | null = null;
  if (BYPASS_AUTH) {
    sessionsDone = mockSessionsCount;
  } else {
    const supabase = await createClient();
    const [countRes, memRes, sessRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student.student_id),
      supabase
        .from("memory_snapshots")
        .select("summary, captured_on")
        .eq("student_id", student.student_id)
        .order("captured_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sessions")
        .select("held_on, topic, session_no")
        .eq("student_id", student.student_id)
        .order("held_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    sessionsDone = countRes.count ?? 0;
    lastMemory = memRes.data;
    lastSession = sessRes.data;
  }
  const day = Math.min(sessionsDone + 1, 24);

  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

  return (
    <>
      <TopBar crumbs={["Pages", "Today"]} title={`Hi, ${firstName}`} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="relative space-y-5">
            <div className="inline-flex items-center gap-2 border border-fg px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-fg">
              <Flame className="h-3 w-3" />
              Day {day} / 24
            </div>
            <h2 className="text-4xl font-bold leading-[1.05] tracking-tight uppercase">
              Ready to talk?<br />You&apos;ve got this.
            </h2>
            <p className="max-w-md text-fg-dim leading-relaxed">
              Press the button below to start today&apos;s conversation with
              your AI thinking partner. Tell stories. Disagree. Get curious.
            </p>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
              Your journey
            </div>
            <div className="text-6xl font-bold tracking-tight tabular-nums">
              {String(sessionsDone).padStart(2, "0")}
              <span className="ml-1 text-2xl text-fg-muted">/ 24</span>
            </div>
            <div className="text-[11px] uppercase tracking-widest text-fg-dim">
              conversations done
            </div>
            <div className="mt-2 flex h-3 w-full border border-fg">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1",
                    i < sessionsDone ? "bg-fg" : "bg-bg",
                    i < 23 && "border-r border-fg",
                  )}
                />
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <Card className="!p-7">
          <div className="mb-6 flex items-center justify-between border-b border-fg/20 pb-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center border border-fg bg-bg">
                <Mic className="h-5 w-5 text-fg" />
              </div>
              <div>
                <div className="text-sm font-bold uppercase tracking-[0.2em]">
                  Today&apos;s conversation
                </div>
                <div className="text-[11px] uppercase tracking-widest text-fg-muted">
                  Tap mic to begin · headphones recommended
                </div>
              </div>
            </div>
          </div>

          {agentId ? (
            <ConvaiWidget agentId={agentId} studentId={student.student_id} />
          ) : (
            <div className="border border-dashed border-fg/30 px-6 py-12 text-center text-[11px] uppercase tracking-widest text-fg-muted">
              Set <code className="text-fg-dim">NEXT_PUBLIC_ELEVENLABS_AGENT_ID</code> to load the agent
            </div>
          )}
        </Card>
      </div>

      {(lastMemory?.summary || lastSession) && (
        <div className="mt-5">
          <Card>
            <div className="mb-4 flex items-center justify-between border-b border-fg/20 pb-3">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-fg" />
                <div className="text-sm font-bold uppercase tracking-[0.2em]">
                  Last time we talked
                </div>
              </div>
              <Link
                href="/story"
                className="text-[10px] uppercase tracking-widest text-fg-dim underline-offset-4 hover:underline hover:text-fg"
              >
                See all →
              </Link>
            </div>

            {lastSession && (
              <div className="mb-3 text-[11px] uppercase tracking-widest text-fg-muted">
                {lastSession.session_no ? `Day ${lastSession.session_no} · ` : ""}
                {formatDate(lastSession.held_on)}
                {lastSession.topic ? ` · ${lastSession.topic}` : ""}
              </div>
            )}

            {lastMemory?.summary ? (
              <p className="text-sm leading-relaxed text-fg whitespace-pre-wrap">
                {humanizeMemory(lastMemory.summary, firstName)}
              </p>
            ) : (
              <div className="text-sm text-fg-dim">
                Your AI partner is still getting to know you. Come back after your next call.
              </div>
            )}
          </Card>
        </div>
      )}
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
