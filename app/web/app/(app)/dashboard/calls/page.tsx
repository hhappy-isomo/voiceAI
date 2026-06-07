import { BYPASS_AUTH, requireFacilitator } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { CallsTable, type CallRow } from "./CallsTable";

export default async function CallsPage() {
  await requireFacilitator();

  let rows: CallRow[] = [];

  if (!BYPASS_AUTH) {
    const supabase = await createClient();
    const { data: sessions } = await supabase
      .from("sessions")
      .select(
        "id, student_id, session_no, held_on, duration_seconds, student_talk_seconds, flagged_low_talk, topic, conversation_id, transcript_url, recording_url",
      )
      .order("held_on", { ascending: false })
      .order("id", { ascending: false })
      .limit(500);

    const ids = (sessions ?? []).map((s) => s.id);
    const studentIds = [...new Set((sessions ?? []).map((s) => s.student_id))];

    const [rubricRes, studentsRes, memRes] = await Promise.all([
      ids.length
        ? supabase
            .from("auto_rubric_scores")
            .select("session_id, cefr, overall, rationale")
            .in("session_id", ids)
        : Promise.resolve({ data: [] }),
      studentIds.length
        ? supabase
            .from("students")
            .select("student_id, display_name, cohort")
            .in("student_id", studentIds)
        : Promise.resolve({ data: [] }),
      studentIds.length
        ? supabase
            .from("memory_snapshots")
            .select("student_id, summary, captured_on")
            .in("student_id", studentIds)
            .order("captured_on", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const rubricMap = new Map<
      number,
      { cefr: string | null; overall: number | null; rationale: string | null }
    >();
    for (const r of rubricRes.data ?? []) {
      rubricMap.set(r.session_id, {
        cefr: r.cefr,
        overall: r.overall,
        rationale: r.rationale,
      });
    }

    const studentMap = new Map<
      string,
      { name: string | null; cohort: "base" | "foundation" }
    >();
    for (const s of studentsRes.data ?? []) {
      studentMap.set(s.student_id, { name: s.display_name, cohort: s.cohort });
    }

    // Best-effort per-session summary: closest memory snapshot captured on or
    // after the session's held_on date.
    const memByStudent = new Map<string, { summary: string; captured_on: string }[]>();
    for (const m of memRes.data ?? []) {
      const arr = memByStudent.get(m.student_id) ?? [];
      arr.push({ summary: m.summary ?? "", captured_on: m.captured_on });
      memByStudent.set(m.student_id, arr);
    }

    rows = (sessions ?? []).map((s) => {
      const stu = studentMap.get(s.student_id);
      const rub = rubricMap.get(s.id);
      const memArr = memByStudent.get(s.student_id) ?? [];
      const snap = memArr.find((m) => m.captured_on >= s.held_on);
      return {
        id: s.id,
        student_id: s.student_id,
        student_name: stu?.name ?? null,
        cohort: stu?.cohort ?? "base",
        session_no: s.session_no,
        held_on: s.held_on,
        duration_seconds: s.duration_seconds,
        student_talk_seconds: s.student_talk_seconds,
        flagged_low_talk: !!s.flagged_low_talk,
        topic: s.topic,
        conversation_id: s.conversation_id,
        transcript_url: s.transcript_url,
        recording_url: s.recording_url,
        cefr: rub?.cefr ?? null,
        rubric_overall: rub?.overall ?? null,
        summary: snap?.summary ?? null,
      };
    });
  }

  return (
    <>
      <TopBar crumbs={["Pages", "Dashboard", "Calls"]} title="All calls" />
      <Card className="!p-0">
        <CallsTable rows={rows} />
      </Card>
    </>
  );
}
