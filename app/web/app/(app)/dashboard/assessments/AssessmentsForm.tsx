"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const INSTRUMENTS = ["det", "rubric", "efset", "smalltalk2me", "ixl"] as const;
const SITTINGS = ["pre", "post"] as const;

export function AssessmentsForm({
  students,
}: {
  students: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setMessage(null);
    const supabase = createClient();
    const score = formData.get("score");
    const { error } = await supabase.from("assessments").upsert(
      {
        student_id: formData.get("student_id"),
        sitting: formData.get("sitting"),
        instrument: formData.get("instrument"),
        score: score ? Number(score) : null,
        cefr: (formData.get("cefr") as string) || null,
      },
      { onConflict: "student_id,sitting,instrument" },
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
    <form action={onSubmit} className="space-y-4">
      <Field label="Student">
        <select name="student_id" required className={selectCls}>
          {students.map((s) => (
            <option key={s.id} value={s.id} className="bg-bg-2">
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sitting">
          <select name="sitting" required className={selectCls}>
            {SITTINGS.map((s) => (
              <option key={s} value={s} className="bg-bg-2 capitalize">
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Instrument">
          <select name="instrument" required className={selectCls}>
            {INSTRUMENTS.map((i) => (
              <option key={i} value={i} className="bg-bg-2 uppercase">
                {i}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Score">
          <input
            name="score"
            type="number"
            step="0.01"
            className={inputCls}
            placeholder="e.g. 85"
          />
        </Field>
        <Field label="CEFR (optional)">
          <input
            name="cefr"
            className={inputCls}
            placeholder="A2 / B1 / B2…"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full border border-fg bg-fg px-5 py-3 text-sm font-bold uppercase tracking-wider text-bg transition-colors hover:bg-bg hover:text-fg disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save assessment"}
      </button>

      {message && (
        <div className="border border-fg px-3 py-2 text-[11px] uppercase tracking-widest text-fg">
          {message}
        </div>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">{label}</div>
      {children}
    </label>
  );
}

const inputCls =
  "w-full border border-fg/30 bg-bg px-3 py-2.5 text-sm text-fg outline-none focus:border-fg";
const selectCls = inputCls + " appearance-none";
