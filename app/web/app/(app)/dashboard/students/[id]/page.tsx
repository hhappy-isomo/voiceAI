import { notFound } from "next/navigation";
import { requireFacilitator } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { CohortToggle } from "@/components/CohortToggle";
import { SessionsTable } from "@/components/SessionsTable";
import type { SessionRow } from "@/components/SessionDrawer";
import { Brain } from "lucide-react";
type Assessment = {
  id: number;
  sitting: "pre" | "post";
  instrument: string;
  score: number | null;
  cefr: string | null;
  assessed_on: string;
};
type Quest = {
  sitting: "pre" | "post";
  overall: number | null;
  anxiety_reduced: number | null;
  confidence: number | null;
};

export default async function StudentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFacilitator();
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("student_id, display_name, cohort, role, enrolled_on")
    .eq("student_id", id)
    .single();
  if (!student) notFound();

  const [{ data: sessions }, { data: assessments }, { data: quest }, { data: memory }] =
    await Promise.all([
      supabase
        .from("sessions")
        .select("id, session_no, held_on, duration_seconds, student_talk_seconds, flagged_low_talk, topic, conversation_id, transcript_url, recording_url")
        .eq("student_id", id)
        .order("held_on", { ascending: false }),
      supabase
        .from("assessments")
        .select("id, sitting, instrument, score, cefr, assessed_on")
        .eq("student_id", id)
        .order("assessed_on", { ascending: false }),
      supabase
        .from("v_questionnaire_scored")
        .select("sitting, overall, anxiety_reduced, confidence")
        .eq("student_id", id),
      supabase
        .from("memory_snapshots")
        .select("summary, captured_on")
        .eq("student_id", id)
        .order("captured_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const display = student.display_name ?? id.slice(0, 8);

  return (
    <>
      <TopBar
        crumbs={["Pages", "Dashboard", display]}
        title={display}
        right={<CohortToggle studentId={id} cohort={student.cohort} />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 border-b border-fg/20 pb-3">
            <Brain className="h-4 w-4 text-fg" />
            <div className="text-sm font-bold uppercase tracking-[0.2em]">
              What the tutor remembers
            </div>
          </div>
          {memory?.summary ? (
            <p className="text-sm leading-relaxed text-fg whitespace-pre-wrap">
              {memory.summary}
            </p>
          ) : (
            <div className="text-sm text-fg-muted">No memory snapshot yet — runs after the first call.</div>
          )}
          {memory?.captured_on && (
            <div className="mt-3 text-[11px] text-fg-muted">
              Captured {new Date(memory.captured_on).toLocaleString()}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 border-b border-fg/20 pb-3 text-sm font-bold uppercase tracking-[0.2em]">
            Questionnaire
          </div>
          <QuestionnaireGrid rows={(quest ?? []) as Quest[]} />
        </Card>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card className="!p-0">
          <div className="border-b border-fg/20 px-5 py-4">
            <div className="text-sm font-bold uppercase tracking-[0.2em]">Sessions</div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
              Click a row for transcript + playback
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
            <SessionsTable sessions={(sessions as SessionRow[] | null) ?? []} />
          </div>
        </Card>

        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-fg/20 px-5 py-4 text-sm font-bold uppercase tracking-[0.2em]">
            Assessments
          </div>
          <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Sitting</th>
                  <th className="px-5 py-2.5 font-medium">Instrument</th>
                  <th className="px-5 py-2.5 font-medium text-right">Score</th>
                  <th className="px-5 py-2.5 font-medium text-right">CEFR</th>
                </tr>
              </thead>
              <tbody>
                {(assessments as Assessment[] | null)?.length ? null : (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-fg-muted">
                      No assessments logged.
                    </td>
                  </tr>
                )}
                {(assessments as Assessment[] | null)?.map((a) => (
                  <tr key={a.id} className="border-t border-fg/15">
                    <td className="px-5 py-2.5 capitalize">{a.sitting}</td>
                    <td className="px-5 py-2.5 uppercase tracking-wide text-fg-dim">
                      {a.instrument}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{a.score ?? "—"}</td>
                    <td className="px-5 py-2.5 text-right text-fg-dim">{a.cefr ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

function QuestionnaireGrid({ rows }: { rows: Quest[] }) {
  const pre = rows.find((r) => r.sitting === "pre");
  const post = rows.find((r) => r.sitting === "post");
  const cells: { label: string; pre: number | null | undefined; post: number | null | undefined }[] = [
    { label: "Overall", pre: pre?.overall, post: post?.overall },
    { label: "Confidence", pre: pre?.confidence, post: post?.confidence },
    { label: "Anxiety ↓", pre: pre?.anxiety_reduced, post: post?.anxiety_reduced },
  ];
  return (
    <div className="space-y-0 border border-fg/20">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={i > 0 ? "border-t border-fg/20 px-3 py-3" : "px-3 py-3"}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted">{c.label}</div>
          <div className="mt-1.5 flex items-baseline gap-4 text-sm">
            <div>
              <span className="text-fg-muted text-[10px] uppercase tracking-widest mr-1">Pre</span>
              <span className="font-bold tabular-nums">{round(c.pre)}</span>
            </div>
            <div>
              <span className="text-fg-muted text-[10px] uppercase tracking-widest mr-1">Post</span>
              <span className="font-bold tabular-nums">{round(c.post)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function round(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(2);
}
