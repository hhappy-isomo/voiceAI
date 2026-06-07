import { requireSuperadmin } from "@/lib/dal";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { GovernancePanel } from "./GovernancePanel";

export default async function GovernancePage() {
  await requireSuperadmin();
  const supabase = await createClient();
  const [rules, consent] = await Promise.all([
    supabase
      .from("safety_rules")
      .select("id, word_or_re, is_regex, severity, notes, added_at")
      .order("added_at", { ascending: false }),
    supabase
      .from("consent_versions")
      .select("id, body, is_active, created_at")
      .order("id", { ascending: false }),
  ]);

  return (
    <>
      <TopBar crumbs={["Superadmin", "Governance"]} title="Governance" />
      <Card className="!p-0">
        <GovernancePanel
          rules={rules.data ?? []}
          consents={consent.data ?? []}
        />
      </Card>
    </>
  );
}
