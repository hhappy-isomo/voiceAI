import { BYPASS_AUTH, requireFacilitator } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { RoleToggle } from "@/components/RoleToggle";
import { Shield, ShieldCheck } from "lucide-react";

type Row = {
  student_id: string;
  display_name: string | null;
  role: "facilitator" | "superadmin";
};

export default async function StaffPage() {
  const me = await requireFacilitator();

  let rows: Row[];
  let superadminCount = 0;

  if (BYPASS_AUTH) {
    rows = [
      { student_id: "00000000-0000-0000-0000-000000000aaa", display_name: "Happy Herman", role: "superadmin" },
      { student_id: "00000000-0000-0000-0000-000000000bbb", display_name: "Happy Herman (B2R)", role: "superadmin" },
      { student_id: "00000000-0000-0000-0000-000000000ccc", display_name: "Demo Facilitator", role: "facilitator" },
    ];
    superadminCount = 2;
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("v_staff")
      .select("student_id, display_name, role");
    rows = (data ?? []) as Row[];
    superadminCount = rows.filter((r) => r.role === "superadmin").length;
  }

  return (
    <>
      <TopBar
        crumbs={["Pages", "Dashboard", "Staff"]}
        title="Staff"
      />

      <Card className="!p-0">
        <div className="flex items-center justify-between border-b border-fg/20 px-5 py-4">
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.2em]">
              Facilitators & superadmins
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
              Inline role toggle · self-change allowed when ≥ 2 superadmins
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[10px] uppercase tracking-widest text-fg-muted">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              {rows.filter((r) => r.role === "facilitator").length} facilitators
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              {superadminCount} superadmins
            </span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-[11px] uppercase tracking-widest text-fg-muted">
            No staff yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-widest text-fg-muted">
              <tr className="border-b border-fg/15">
                <th className="px-5 py-3 font-bold">Name</th>
                <th className="px-5 py-3 font-bold">Current role</th>
                <th className="px-5 py-3 font-bold text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSelf = r.student_id === me.student_id;
                const selfChangeAllowed =
                  isSelf && me.role === "superadmin" && superadminCount > 1;
                return (
                  <tr key={r.student_id} className="border-t border-fg/15">
                    <td className="px-5 py-3 font-bold uppercase tracking-wider">
                      {r.display_name ?? r.student_id.slice(0, 8)}
                      {isSelf && (
                        <span className="ml-2 border border-fg/30 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-fg-muted">
                          you
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 capitalize text-fg-dim">
                      <span className="inline-flex items-center gap-1.5">
                        {r.role === "superadmin" ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <Shield className="h-3 w-3" />
                        )}
                        {r.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <RoleToggle
                          studentId={r.student_id}
                          role={r.role}
                          isSelf={isSelf}
                          callerRole={me.role}
                          selfChangeAllowed={selfChangeAllowed}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
