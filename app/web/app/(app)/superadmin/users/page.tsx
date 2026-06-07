import { requireSuperadmin } from "@/lib/dal";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { UsersTable, type UserRow } from "./UsersTable";

export default async function UsersPage() {
  const me = await requireSuperadmin();
  const supabase = await createClient();

  const [studentsRes, pendingRes] = await Promise.all([
    supabase
      .from("students")
      .select(
        "student_id, display_name, cohort, role, consent_given, suspended, enrolled_on",
      )
      .order("role", { ascending: false })
      .order("display_name", { ascending: true, nullsFirst: false }),
    supabase
      .from("pending_students")
      .select("id, email, display_name, cohort, added_at")
      .order("added_at", { ascending: false }),
  ]);

  const rows: UserRow[] = [
    ...((studentsRes.data ?? []) as Array<{
      student_id: string;
      display_name: string | null;
      cohort: "base" | "foundation";
      role: "student" | "facilitator" | "superadmin";
      consent_given: boolean;
      suspended: boolean;
      enrolled_on: string;
    }>).map((s) => ({
      kind: "signed_in" as const,
      id: s.student_id,
      display_name: s.display_name,
      role: s.role,
      cohort: s.cohort,
      consent_given: s.consent_given,
      suspended: s.suspended,
      enrolled_on: s.enrolled_on,
      email: null,
    })),
    ...((pendingRes.data ?? []) as Array<{
      id: number;
      email: string;
      display_name: string | null;
      cohort: "base" | "foundation";
      added_at: string;
    }>).map((p) => ({
      kind: "pending" as const,
      id: `pending:${p.id}`,
      display_name: p.display_name,
      role: "student" as const,
      cohort: p.cohort,
      consent_given: false,
      suspended: false,
      enrolled_on: p.added_at.slice(0, 10),
      email: p.email,
    })),
  ];

  const superCount = rows.filter((r) => r.role === "superadmin").length;

  return (
    <>
      <TopBar
        crumbs={["Superadmin", "Users"]}
        title="All users"
      />
      <Card className="!p-0">
        <UsersTable
          rows={rows}
          myId={me.student_id}
          superadminCount={superCount}
        />
      </Card>
    </>
  );
}
