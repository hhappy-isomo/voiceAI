import { BYPASS_AUTH, getStudent, isStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { StudentQuestionnaireForm } from "./StudentQuestionnaireForm";
import { ClipboardCheck } from "lucide-react";

export default async function QuestionnairePage({
  searchParams,
}: {
  searchParams: Promise<{ sitting?: string }>;
}) {
  const me = await getStudent();
  if (isStaff(me.role)) redirect("/dashboard");

  const sp = await searchParams;
  const requested = sp.sitting === "post" ? "post" : "pre";

  let preDone = false;
  let postDone = false;

  if (!BYPASS_AUTH) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("questionnaire_responses")
      .select("sitting")
      .eq("student_id", me.student_id);
    for (const r of data ?? []) {
      if (r.sitting === "pre") preDone = true;
      if (r.sitting === "post") postDone = true;
    }
  }

  const allDone = preDone && postDone;
  const sitting: "pre" | "post" =
    requested === "post" ? "post" : preDone && !postDone ? "post" : "pre";
  const alreadyDone =
    (sitting === "pre" && preDone) || (sitting === "post" && postDone);

  return (
    <>
      <TopBar
        crumbs={["Isomo Voice", "Survey"]}
        title={sitting === "pre" ? "Before we start" : "How was it?"}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Tab href="/questionnaire?sitting=pre" label="Pre" active={sitting === "pre"} done={preDone} />
        <Tab href="/questionnaire?sitting=post" label="Post" active={sitting === "post"} done={postDone} />
      </div>

      {allDone ? (
        <Card glow className="text-center">
          <div className="flex flex-col items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center border border-fg bg-bg">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold uppercase tracking-tight">
              Both surveys done.
            </div>
            <div className="max-w-md text-fg-dim leading-relaxed">
              Thank you. Your responses help Isomo Voice see how you&apos;ve grown.
            </div>
          </div>
        </Card>
      ) : (
        <Card glow>
          <StudentQuestionnaireForm sitting={sitting} alreadyDone={alreadyDone} />
        </Card>
      )}
    </>
  );
}

function Tab({
  href,
  label,
  active,
  done,
}: {
  href: string;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-2 border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${
        active ? "border-fg bg-fg text-bg" : "border-fg/30 text-fg-dim hover:border-fg hover:text-fg"
      }`}
    >
      {label}
      {done && (
        <span className="border border-current px-1 py-[1px] text-[9px]">
          done
        </span>
      )}
    </a>
  );
}
