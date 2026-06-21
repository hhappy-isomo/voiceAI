import { NextResponse } from "next/server";
import { requireSuperadminApi } from "@/lib/superadmin-guard";
import { adminClient } from "@/lib/admin";

// GDPR + anonymized exports.
//   GET /api/superadmin/export?student_id=... → JSON dump for that student
//   GET /api/superadmin/export?anon=1         → anonymized dataset

export async function GET(req: Request) {
  const guard = await requireSuperadminApi();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const studentId = url.searchParams.get("student_id");
  const anon = url.searchParams.get("anon") === "1";
  const admin = adminClient();

  if (anon) {
    const [students, sessions, assess, quest, rubric] = await Promise.all([
      admin.from("students").select("cohort, enrolled_on, role").eq("role", "student"),
      admin
        .from("sessions")
        .select(
          "session_no, held_on, duration_seconds, student_talk_seconds, flagged_low_talk",
        ),
      admin.from("assessments").select("sitting, instrument, score, cefr"),
      admin.from("questionnaire_responses").select("sitting, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10"),
      admin.from("auto_rubric_scores").select("cefr, overall, range_score, accuracy_score, fluency_score, interaction_score, coherence_score"),
    ]);

    // Re-identification defense: (cohort, enrolled_on) paired with scores
    // lets anyone who knows one student's exact enrolment day isolate
    // their row. Bucket all dates to YYYY-MM granularity and apply
    // k-anonymity (k=5) on the cohort dimension.
    const bucketMonth = (d: string | null | undefined): string | null =>
      typeof d === "string" && d.length >= 7 ? d.slice(0, 7) : null;

    const studentsBucketed = (students.data ?? []).map(
      (s: { cohort: string; enrolled_on: string; role: string }) => ({
        cohort: s.cohort,
        enrolled_month: bucketMonth(s.enrolled_on),
        role: s.role,
      }),
    );
    // k-anonymity: if any cohort has fewer than 5 students, hide the
    // cohort field entirely (collapses to a single combined group).
    const K_MIN = 5;
    const cohortCounts = new Map<string, number>();
    for (const s of studentsBucketed) {
      cohortCounts.set(s.cohort, (cohortCounts.get(s.cohort) ?? 0) + 1);
    }
    const cohortBelowK = [...cohortCounts.values()].some((n) => n < K_MIN);
    const studentsAnon = cohortBelowK
      ? studentsBucketed.map((s) => ({ ...s, cohort: "redacted_k<5" }))
      : studentsBucketed;

    const sessionsBucketed = (sessions.data ?? []).map(
      (s: { session_no: number | null; held_on: string; duration_seconds: number | null; student_talk_seconds: number | null; flagged_low_talk: boolean | null }) => ({
        session_no: s.session_no,
        held_month: bucketMonth(s.held_on),
        duration_seconds: s.duration_seconds,
        student_talk_seconds: s.student_talk_seconds,
        flagged_low_talk: s.flagged_low_talk,
      }),
    );

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      anonymization: {
        date_granularity: "month",
        k_anonymity_min: K_MIN,
        cohort_redacted: cohortBelowK,
      },
      students: studentsAnon,
      sessions: sessionsBucketed,
      assessments: assess.data,
      questionnaire: quest.data,
      auto_rubric: rubric.data,
    });
  }

  if (!studentId) {
    return NextResponse.json({ error: "student_id or anon required" }, { status: 400 });
  }

  const [student, sessions, assess, quest, mem, adopt, rubric, usage] = await Promise.all([
    admin.from("students").select("*").eq("student_id", studentId).single(),
    admin.from("sessions").select("*").eq("student_id", studentId),
    admin.from("assessments").select("*").eq("student_id", studentId),
    admin.from("questionnaire_responses").select("*").eq("student_id", studentId),
    admin.from("memory_snapshots").select("*").eq("student_id", studentId),
    admin.from("adoption_survey").select("*").eq("student_id", studentId),
    admin.from("auto_rubric_scores").select("*").eq("student_id", studentId),
    admin.from("usage_log").select("*").eq("student_id", studentId),
  ]);

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    student: student.data,
    sessions: sessions.data,
    assessments: assess.data,
    questionnaire: quest.data,
    memory_snapshots: mem.data,
    adoption_survey: adopt.data,
    auto_rubric_scores: rubric.data,
    usage_log: usage.data,
  });
}
