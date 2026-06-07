import { redirect } from "next/navigation";
import { BYPASS_AUTH, getStudent, getUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { ConsentGate } from "@/components/ConsentGate";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { ConvaiWidget } from "@/components/ConvaiWidget";
import { mockSessionsCount } from "@/lib/mock";
import { Mic, Flame } from "lucide-react";
import { cn } from "@/lib/cn";

export default async function StudentHome() {
  const student = await getStudent();

  if (!BYPASS_AUTH && student.role === "facilitator") redirect("/dashboard");
  if (!student.consent_given) return <ConsentGate studentId={student.student_id} />;

  const user = await getUser();
  const firstName =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    student.display_name?.split(" ")[0] ??
    "friend";

  let sessionsDone: number;
  if (BYPASS_AUTH) {
    sessionsDone = mockSessionsCount;
  } else {
    const supabase = await createClient();
    const { count } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student.student_id);
    sessionsDone = count ?? 0;
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
    </>
  );
}
