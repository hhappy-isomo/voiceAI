import { requireSuperadmin } from "@/lib/dal";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";

const PRIVILEGED_ACTIONS = [
  "role_change",
  "suspend",
  "unsuspend",
  "reset_student",
  "voice_approve",
  "voice_unapprove",
  "agent_create",
  "agent_update",
  "agent_delete",
  "master_prompt_push",
  "cost_caps_update",
  "consent_version_set",
  "safety_rule_add",
  "safety_rule_remove",
  "session_activated",
  "sync_usage",
];

type Row = {
  id: number;
  actor_id: string | null;
  action: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  at: string;
};

export default async function PrivilegedAuditPage() {
  await requireSuperadmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, actor_id, action, target_id, details, at")
    .in("action", PRIVILEGED_ACTIONS)
    .order("at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as Row[];

  return (
    <>
      <TopBar crumbs={["Superadmin", "Privileged audit"]} title="Privileged audit" />
      <Card className="!p-0">
        <div className="border-b border-fg/20 px-5 py-4">
          <div className="text-sm font-bold uppercase tracking-[0.2em]">
            Privileged actions only · {rows.length}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
            Role changes · suspensions · resets · agent edits · master prompt
            pushes · cost cap updates · consent version sets · safety rule edits
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-[11px] uppercase tracking-widest text-fg-muted">
            No privileged events yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-widest text-fg-muted">
              <tr className="border-b border-fg/15">
                <th className="px-5 py-3 font-bold">When</th>
                <th className="px-5 py-3 font-bold">Actor</th>
                <th className="px-5 py-3 font-bold">Action</th>
                <th className="px-5 py-3 font-bold">Target</th>
                <th className="px-5 py-3 font-bold">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-fg/15">
                  <td className="px-5 py-2 text-[11px] tabular-nums text-fg-dim">
                    {new Date(r.at).toLocaleString()}
                  </td>
                  <td className="px-5 py-2 font-mono text-[11px]">
                    {r.actor_id ? r.actor_id.slice(0, 8) : "—"}
                  </td>
                  <td className="px-5 py-2 font-bold uppercase tracking-wider text-[11px]">
                    {r.action.replace(/_/g, " ")}
                  </td>
                  <td className="px-5 py-2 font-mono text-[11px] text-fg-dim">
                    {r.target_id ? r.target_id.slice(0, 12) : "—"}
                  </td>
                  <td className="px-5 py-2 font-mono text-[11px] text-fg-muted">
                    {r.details ? JSON.stringify(r.details).slice(0, 80) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
