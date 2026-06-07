"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

type Q = { key: `q${number}`; text: string; reversed?: boolean };

const PRE_QUESTIONS: Q[] = [
  { key: "q1", text: "I feel nervous speaking English aloud.", reversed: true },
  { key: "q2", text: "I worry about making mistakes when I speak.", reversed: true },
  { key: "q3", text: "My heart races when I have to speak English.", reversed: true },
  { key: "q4", text: "I can express my ideas clearly in English." },
  { key: "q5", text: "I feel confident in English conversations." },
  { key: "q6", text: "I can handle unexpected questions in English." },
  { key: "q7", text: "I look for chances to practice speaking English." },
  { key: "q8", text: "I enjoy joining English conversations." },
  { key: "q9", text: "I want to practice with the AI tutor." },
  { key: "q10", text: "I expect this will help my English." },
];

const POST_QUESTIONS: Q[] = [
  { key: "q1", text: "I still feel nervous speaking English aloud.", reversed: true },
  { key: "q2", text: "I worry about making mistakes when I speak.", reversed: true },
  { key: "q3", text: "My heart races when I have to speak English.", reversed: true },
  { key: "q4", text: "I can express my ideas clearly in English." },
  { key: "q5", text: "I feel confident in English conversations." },
  { key: "q6", text: "I can handle unexpected questions in English." },
  { key: "q7", text: "I look for chances to practice speaking English." },
  { key: "q8", text: "I enjoy joining English conversations." },
  { key: "q9", text: "I enjoyed speaking with the AI tutor." },
  { key: "q10", text: "I want to keep practicing with this tool." },
];

const SCALE = [1, 2, 3, 4, 5];

export function StudentQuestionnaireForm({
  sitting,
  alreadyDone,
}: {
  sitting: "pre" | "post";
  alreadyDone: boolean;
}) {
  const router = useRouter();
  const QUESTIONS = sitting === "post" ? POST_QUESTIONS : PRE_QUESTIONS;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function setAnswer(key: string, val: number) {
    setAnswers((a) => ({ ...a, [key]: val }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing = QUESTIONS.filter((q) => answers[q.key] == null);
    if (missing.length) {
      setMessage(`Answer all ${QUESTIONS.length} questions (${missing.length} left).`);
      return;
    }
    if (
      alreadyDone &&
      !confirm("You've already submitted this survey. Replace your previous answers?")
    ) {
      return;
    }
    setPending(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_questionnaire", {
      p_sitting: sitting,
      p_q1: answers.q1, p_q2: answers.q2, p_q3: answers.q3, p_q4: answers.q4, p_q5: answers.q5,
      p_q6: answers.q6, p_q7: answers.q7, p_q8: answers.q8, p_q9: answers.q9, p_q10: answers.q10,
    });
    setPending(false);
    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }
    setMessage("Thanks — your answers are in.");
    router.refresh();
  }

  const progress = Object.keys(answers).length;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <p className="text-fg-dim leading-relaxed">
          {sitting === "pre"
            ? "Before you start your six-week journey, tell us where you're at. No right or wrong answers — your honest score is what helps."
            : "You made it through six weeks. Same ten questions — let's see how it sits with you now."}
        </p>
        <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-fg-muted">
          <span className="tabular-nums">{progress}</span> / {QUESTIONS.length} answered
          <div className="ml-2 flex-1 h-2 border border-fg/40">
            <div
              className="h-full bg-fg transition-all"
              style={{ width: `${(progress / QUESTIONS.length) * 100}%` }}
            />
          </div>
        </div>
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
                      "h-9 w-9 border-r border-fg/30 text-sm font-bold tabular-nums last:border-r-0",
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
        {pending ? "Saving…" : "Submit"}
      </button>

      {message && (
        <div className="border border-fg px-3 py-2 text-[11px] uppercase tracking-widest">
          {message}
        </div>
      )}
    </form>
  );
}
