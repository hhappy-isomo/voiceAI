import { BYPASS_AUTH, requireFacilitator } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { SeedForm } from "./SeedForm";

export type PendingRow = {
  id: number;
  email: string;
  display_name: string | null;
  cohort: "base" | "foundation";
  added_at: string;
};

export default async function SeedPage() {
  await requireFacilitator();

  let pending: PendingRow[] = [];
  let signedIn = 0;

  if (!BYPASS_AUTH) {
    const supabase = await createClient();
    const [p, s] = await Promise.all([
      supabase
        .from("pending_students")
        .select("id, email, display_name, cohort, added_at")
        .order("added_at", { ascending: false }),
      supabase
        .from("students")
        .select("student_id", { count: "exact", head: true })
        .eq("role", "student"),
    ]);
    pending = (p.data ?? []) as PendingRow[];
    signedIn = s.count ?? 0;
  }

  return (
    <>
      <TopBar
        crumbs={["Pages", "Dashboard", "Seed roster"]}
        title="Seed students"
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
            Signed in
          </div>
          <div className="mt-2 text-4xl font-bold tabular-nums">{signedIn}</div>
        </Card>
        <Card>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
            Pending (not yet signed in)
          </div>
          <div className="mt-2 text-4xl font-bold tabular-nums">{pending.length}</div>
        </Card>
      </div>

      <Card glow className="!p-0">
        <div className="border-b border-fg/20 px-5 py-4">
          <div className="text-sm font-bold uppercase tracking-[0.2em]">
            Paste a CSV
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
            Columns: email, name, cohort (header optional · cohort defaults to base)
          </div>
        </div>
        <SeedForm pending={pending} />
      </Card>
    </>
  );
}
