import { requireSuperadmin } from "@/lib/dal";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { MasterPromptForm } from "./MasterPromptForm";
import { SESSIONS } from "@/lib/sessions-data";

export default async function MasterPromptPage() {
  await requireSuperadmin();
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("master_prompt_events")
    .select("id, session_no, agents_count, succeeded, failed, by_user, at")
    .order("at", { ascending: false })
    .limit(10);

  return (
    <>
      <TopBar crumbs={["Superadmin", "Master prompt"]} title="Master prompt push" />

      <Card glow className="mb-5">
        <div className="text-sm font-bold uppercase tracking-[0.2em]">
          What this does
        </div>
        <div className="mt-2 text-[12px] leading-relaxed text-fg-dim">
          Pushes a session prompt to <strong>every</strong> ElevenLabs agent on
          your account at once. Used for multi-cohort pilots where every agent
          needs to be on the same session simultaneously. Today there&apos;s one
          agent, so this is equivalent to /dashboard/sessions Activate — but it
          scales when you add more agents.
        </div>
      </Card>

      <Card glow>
        <MasterPromptForm sessions={SESSIONS.map((s) => ({ no: s.no, title: s.title }))} />
      </Card>

      <Card className="mt-5 !p-0">
        <div className="border-b border-fg/20 px-5 py-4">
          <div className="text-sm font-bold uppercase tracking-[0.2em]">Recent pushes</div>
        </div>
        {(events ?? []).length === 0 ? (
          <div className="px-5 py-12 text-center text-[11px] uppercase tracking-widest text-fg-muted">
            None yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-widest text-fg-muted">
              <tr className="border-b border-fg/15">
                <th className="px-5 py-3 font-bold">When</th>
                <th className="px-5 py-3 font-bold">Session</th>
                <th className="px-5 py-3 font-bold text-right">Agents</th>
                <th className="px-5 py-3 font-bold text-right">OK</th>
                <th className="px-5 py-3 font-bold text-right">Failed</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).map((e) => (
                <tr key={e.id} className="border-t border-fg/15">
                  <td className="px-5 py-2 text-[11px] text-fg-dim">
                    {new Date(e.at).toLocaleString()}
                  </td>
                  <td className="px-5 py-2 font-bold">
                    #{String(e.session_no).padStart(2, "0")}
                  </td>
                  <td className="px-5 py-2 text-right tabular-nums">{e.agents_count}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{e.succeeded}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{e.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
