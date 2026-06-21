import { notFound } from "next/navigation";
import { BYPASS_AUTH, requireFacilitator } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { signRecordingPaths } from "@/lib/recordings";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { CohortToggle } from "@/components/CohortToggle";
import { RoleToggle } from "@/components/RoleToggle";
import { StudentControls } from "@/components/StudentControls";
import { Mem0Inspector } from "@/components/Mem0Inspector";
import { SessionsTable } from "@/components/SessionsTable";
import type { SessionRow } from "@/components/SessionDrawer";
import { TalkTimeWaterfall, type WaterfallBar } from "@/components/TalkTimeWaterfall";
import { mockWaterfall } from "@/lib/mock";
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
  const { id } = await params;

  let student!: {
    student_id: string;
    display_name: string | null;
    cohort: "base" | "foundation";
    role: "student" | "facilitator" | "superadmin";
    suspended: boolean;
  };
  const me = await requireFacilitator();
  let sessions: SessionRow[] | null;
  let assessments: Assessment[] | null;
  let quest: Quest[] | null;
  let memory: { summary: string | null; captured_on: string | null } | null;

  if (BYPASS_AUTH) {
    const mockRosterMod = await import("@/lib/mock");
    const m = mockRosterMod.mockRoster.find((r) => r.student_id === id);
    student = m
      ? { student_id: m.student_id, display_name: m.display_name, cohort: m.cohort, role: "student", suspended: false }
      : { student_id: id, display_name: "Dev Student", cohort: "base", role: "student", suspended: false };
    sessions = mockRosterMod.mockWaterfall
      .filter((b) => b.talk_min != null)
      .map((b, i) => ({
        id: 1000 + i,
        session_no: b.session_no,
        held_on: b.held_on ?? new Date().toISOString().slice(0, 10),
        duration_seconds: (b.talk_min ?? 0) * 60 + 200,
        student_talk_seconds: (b.talk_min ?? 0) * 60,
        flagged_low_talk: b.flagged,
        topic: null,
        conversation_id: null,
        transcript_url: null,
        recording_url: null,
      }));
    assessments = [
      { id: 1, sitting: "pre", instrument: "det", score: 70, cefr: "A2", assessed_on: "2026-05-12" },
      { id: 2, sitting: "pre", instrument: "rubric", score: 3, cefr: "A2", assessed_on: "2026-05-12" },
    ];
    quest = [
      { sitting: "pre", overall: 3.1, anxiety_reduced: 2.4, confidence: 3.0 },
    ];
    memory = {
      summary:
        "She is in Year 1 at FAWE Girls Kigali, wants to study medicine, and disagrees with the teacher about phone bans. She tells stories about her grandmother in Musanze.",
      captured_on: new Date(Date.now() - 86400000).toISOString(),
    };
  } else {
    const supabase = await createClient();
    const { data: studentRow } = await supabase
      .from("students")
      .select("student_id, display_name, cohort, role, enrolled_on, suspended")
      .eq("student_id", id)
      .single();
    if (!studentRow) notFound();
    student = studentRow;

    const [sRes, aRes, qRes, mRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, session_no, held_on, duration_seconds, student_talk_seconds, flagged_low_talk, safety_severity, topic, conversation_id, transcript_url, recording_url")
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
    sessions = sRes.data as SessionRow[] | null;
    assessments = aRes.data as Assessment[] | null;
    quest = qRes.data as Quest[] | null;
    memory = mRes.data as { summary: string | null; captured_on: string | null } | null;

    // Load transcript_flags for the per-session safety drilldown.
    if (sessions?.length) {
      const sessionIds = sessions.map((s) => s.id);
      const { data: flagsData } = await supabase
        .from("transcript_flags")
        .select("session_id, severity, snippet")
        .in("session_id", sessionIds);
      const flagsBySession = new Map<
        number,
        { severity: "warn" | "flag" | "block"; snippet: string | null }[]
      >();
      for (const f of (flagsData ?? []) as Array<{
        session_id: number;
        severity: "warn" | "flag" | "block";
        snippet: string | null;
      }>) {
        const arr = flagsBySession.get(f.session_id) ?? [];
        arr.push({ severity: f.severity, snippet: f.snippet });
        flagsBySession.set(f.session_id, arr);
      }
      sessions = sessions.map((s) => ({
        ...s,
        safety_flags: flagsBySession.get(s.id) ?? [],
      }));
    }

    // Recordings live in a PRIVATE storage bucket — sessions.recording_url
    // stores the path; mint short-lived signed URLs at render time.
    if (sessions?.length) {
      const signedUrls = await signRecordingPaths(
        sessions.map((s) => s.recording_url),
      );
      sessions = sessions.map((s, i) => ({ ...s, recording_url: signedUrls[i] }));
    }
  }

  const display = student.display_name ?? id.slice(0, 8);

  // Allow self-role-change only if another superadmin exists, so the only
  // remaining superadmin can never demote themselves into a lockout.
  let selfChangeAllowed = false;
  if (id === me.student_id && me.role === "superadmin") {
    if (BYPASS_AUTH) {
      selfChangeAllowed = true;
    } else {
      const supabase = await createClient();
      const { count } = await supabase
        .from("students")
        .select("student_id", { count: "exact", head: true })
        .eq("role", "superadmin");
      selfChangeAllowed = (count ?? 0) > 1;
    }
  }

  const waterfall: WaterfallBar[] = BYPASS_AUTH
    ? mockWaterfall
    : Array.from({ length: 24 }, (_, i) => {
        const n = i + 1;
        const hit = (sessions as SessionRow[] | null)?.find(
          (s) => s.session_no === n,
        );
        return {
          session_no: n,
          talk_min:
            hit?.student_talk_seconds != null
              ? Math.round(hit.student_talk_seconds / 60)
              : null,
          flagged: !!hit?.flagged_low_talk,
          held_on: hit?.held_on ?? null,
        };
      });

  return (
    <>
      <TopBar
        crumbs={["Pages", "Dashboard", display]}
        title={display}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <RoleToggle
              studentId={id}
              role={student.role}
              isSelf={id === me.student_id}
              callerRole={me.role}
              selfChangeAllowed={selfChangeAllowed}
            />
            <CohortToggle studentId={id} cohort={student.cohort} />
            <StudentControls
              studentId={id}
              suspended={student.suspended}
              isSelf={id === me.student_id}
            />
          </div>
        }
      />

      <div className="mb-5">
        <TalkTimeWaterfall bars={waterfall} />
      </div>

      {!BYPASS_AUTH && (
        <div className="mb-5">
          <Mem0Inspector studentId={id} />
        </div>
      )}

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
