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
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      students: students.data,
      sessions: sessions.data,
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
