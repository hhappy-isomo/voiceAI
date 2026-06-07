import { requireSuperadmin } from "@/lib/dal";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { PowerControls } from "./PowerControls";

export default async function PowerPage() {
  await requireSuperadmin();
  const supabase = await createClient();
  const { data: caps } = await supabase
    .from("cost_caps")
    .select("kill_all, drain_mode")
    .eq("id", 1)
    .single();

  return (
    <>
      <TopBar crumbs={["Superadmin", "Power"]} title="Power moves" />
      <Card glow>
        <PowerControls
          initial={{
            kill_all: !!caps?.kill_all,
            drain_mode: !!caps?.drain_mode,
          }}
        />
      </Card>
    </>
  );
}
