"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

const QUESTIONS: { key: `q${number}`; text: string; reversed?: boolean }[] = [
  { key: "q1", text: "I feel nervous speaking English aloud.", reversed: true },
  { key: "q2", text: "I worry about making mistakes when I speak.", reversed: true },
  { key: "q3", text: "My heart races when I have to speak English.", reversed: true },
  { key: "q4", text: "I can express my ideas clearly in English." },
  { key: "q5", text: "I feel confident in English conversations." },
  { key: "q6", text: "I can handle unexpected questions in English." },
  { key: "q7", text: "I look for chances to practice speaking English." },
  { key: "q8", text: "I enjoy joining English conversations." },
  { key: "q9", text: "I enjoy speaking with the AI tutor." },
  { key: "q10", text: "I want to keep practicing with this tool." },
];

const SCALE = [1, 2, 3, 4, 5];

export function QuestionnaireForm({
  students,
}: {
  students: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [sitting, setSitting] = useState<"pre" | "post">("pre");
  const [answers, setAnswers] = useState<Record<string, number>>({});

  function setAnswer(key: string, val: number) {
    setAnswers((a) => ({ ...a, [key]: val }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const missing = QUESTIONS.filter((q) => answers[q.key] == null);
    if (missing.length) {
      setPending(false);
      setMessage(`Missing ${missing.length} response${missing.length === 1 ? "" : "s"}.`);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("questionnaire_responses").upsert(
      { student_id: studentId, sitting, ...answers },
      { onConflict: "student_id,sitting" },
    );
    setPending(false);
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Saved.");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Student">
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            className={selectCls}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id} className="bg-bg">
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sitting">
          <select
            value={sitting}
            onChange={(e) => setSitting(e.target.value as "pre" | "post")}
            required
            className={selectCls}
          >
            <option value="pre" className="bg-bg">Pre</option>
            <option value="post" className="bg-bg">Post</option>
          </select>
        </Field>
      </div>

      <div className="border border-fg/20">
        <div className="grid grid-cols-[1fr_auto] items-center border-b border-fg/20 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-fg-muted">
          <div>Item</div>
          <div className="ml-2">Disagree 1 — 5 Agree</div>
        </div>
        {QUESTIONS.map((q, i) => (
          <div
            key={q.key}
            className={cn(
              "grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3",
              i > 0 && "border-t border-fg/15",
            )}
          >
            <div className="text-sm">
              <span className="mr-2 text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                {q.key.toUpperCase()}
              </span>
              {q.text}
              {q.reversed && (
                <span className="ml-2 border border-fg/40 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-fg-muted">
                  Anxiety
                </span>
              )}
            </div>
            <div className="flex border border-fg/30">
              {SCALE.map((n) => {
                const active = answers[q.key] === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAnswer(q.key, n)}
                    className={cn(
                      "h-8 w-8 border-r border-fg/30 text-xs font-bold tabular-nums last:border-r-0",
                      active ? "bg-fg text-bg" : "text-fg-dim hover:bg-fg/10 hover:text-fg",
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full border border-fg bg-fg px-5 py-3 text-sm font-bold uppercase tracking-wider text-bg transition-colors hover:bg-bg hover:text-fg disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save questionnaire"}
      </button>

      {message && (
        <div className="border border-fg px-3 py-2 text-[11px] uppercase tracking-widest">
          {message}
        </div>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
        {label}
      </div>
      {children}
    </label>
  );
}

const selectCls =
  "w-full appearance-none border border-fg/30 bg-bg px-3 py-2.5 text-sm text-fg outline-none focus:border-fg";
