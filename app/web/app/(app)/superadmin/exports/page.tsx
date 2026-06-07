import { requireSuperadmin } from "@/lib/dal";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { ExportsPanel } from "./ExportsPanel";

export default async function ExportsPage() {
  await requireSuperadmin();
  const supabase = await createClient();
  const { data: students } = await supabase
    .from("students")
    .select("student_id, display_name")
    .eq("role", "student")
    .order("display_name");

  return (
    <>
      <TopBar crumbs={["Superadmin", "Exports"]} title="Data exports" />
      <Card glow>
        <ExportsPanel
          students={(students ?? []).map((s) => ({
            id: s.student_id,
            name: s.display_name ?? s.student_id.slice(0, 8),
          }))}
        />
      </Card>
    </>
  );
}
