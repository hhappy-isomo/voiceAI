import { BYPASS_AUTH, requireFacilitator } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { SessionsGrid } from "./SessionsGrid";
import { SESSIONS } from "@/lib/sessions-data";

export default async function SessionsPage() {
  await requireFacilitator();

  let activeNo = 1;
  let activatedAt: string | null = null;
  let activatedBy: string | null = null;

  if (!BYPASS_AUTH) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("pilot_config")
      .select("active_session_no, activated_at, activated_by")
      .eq("id", 1)
      .single();
    activeNo = data?.active_session_no ?? 1;
    activatedAt = data?.activated_at ?? null;
    activatedBy = data?.activated_by ?? null;
  }

  const active = SESSIONS.find((s) => s.no === activeNo) ?? SESSIONS[0];

  return (
    <>
      <TopBar
        crumbs={["Pages", "Dashboard", "Sessions"]}
        title="Sessions"
      />

      <Card glow className="mb-6">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="border border-fg px-4 py-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.25em] text-fg-muted">
              Live now
            </div>
            <div className="text-4xl font-bold tabular-nums">
              {String(active.no).padStart(2, "0")}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-fg-muted">
              / 24
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-fg-muted">
              Active prompt on agent
            </div>
            <div className="mt-1 text-xl font-bold uppercase tracking-tight">
              {active.title}
            </div>
            {activatedAt && (
              <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
                set {new Date(activatedAt).toLocaleString()}
                {activatedBy && ` · by ${activatedBy.slice(0, 8)}`}
              </div>
            )}
          </div>
        </div>
      </Card>

      <SessionsGrid sessions={SESSIONS} activeNo={activeNo} />
    </>
  );
}
