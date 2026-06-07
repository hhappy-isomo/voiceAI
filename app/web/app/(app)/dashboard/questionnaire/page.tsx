import { BYPASS_AUTH, requireFacilitator } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { QuestionnaireForm } from "./QuestionnaireForm";
import { mockRosterForForm } from "@/lib/mock";

export default async function QuestionnairePage() {
  await requireFacilitator();

  let students: { id: string; name: string }[];
  if (BYPASS_AUTH) {
    students = mockRosterForForm;
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("students")
      .select("student_id, display_name")
      .eq("role", "student")
      .order("display_name");
    students = (data ?? []).map((s) => ({
      id: s.student_id,
      name: s.display_name ?? s.student_id.slice(0, 8),
    }));
  }

  return (
    <>
      <TopBar
        crumbs={["Pages", "Dashboard", "Questionnaire"]}
        title="Log questionnaire"
      />
      <Card glow className="max-w-3xl">
        <QuestionnaireForm students={students} />
      </Card>
    </>
  );
}
