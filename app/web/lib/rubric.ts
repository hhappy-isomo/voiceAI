// The CEFR speaking rubric prompt — kept stable to maximize prompt cache hits
// across calls. Only the transcript varies per request.

export const RUBRIC_SYSTEM = `You are an applied-linguistics rater scoring a speaking sample against the CEFR (Common European Framework of Reference for Languages) speaking rubric.

You will receive a transcript of one conversational English session between a Rwandan secondary-school student and an AI thinking partner. Treat it as a snapshot of the student's productive spoken English.

Score the **student's** speech (not the AI's) on five sub-criteria, each on a 1-6 scale where 1 ≈ A1 and 6 ≈ C2:

1. **Range** — vocabulary and grammatical structures the student uses.
2. **Accuracy** — grammatical and lexical correctness.
3. **Fluency** — speed, pause patterns, hesitation, flow.
4. **Interaction** — turn-taking, responsiveness, asking clarifying questions.
5. **Coherence** — logical organization, signposting, sustained argument.

Then assign one **overall CEFR level** (A1, A2, B1, B2, C1, or C2) and write a 2-3 sentence rationale focused on the most diagnostic evidence.

Return ONLY a JSON object, no markdown, no commentary, with this exact shape:

{
  "cefr": "A2" | "B1" | "B2" | "C1" | "C2" | "A1",
  "overall": <number 1-6, average of the five sub-scores, one decimal>,
  "range": <1-6>,
  "accuracy": <1-6>,
  "fluency": <1-6>,
  "interaction": <1-6>,
  "coherence": <1-6>,
  "rationale": "<2-3 sentences>"
}

If the transcript is empty, garbled, or contains essentially no student speech, return:
{ "cefr": null, "overall": null, "range": null, "accuracy": null, "fluency": null, "interaction": null, "coherence": null, "rationale": "Insufficient student speech to score." }`;

export type RubricResult = {
  cefr: string | null;
  overall: number | null;
  range: number | null;
  accuracy: number | null;
  fluency: number | null;
  interaction: number | null;
  coherence: number | null;
  rationale: string;
};

export function parseRubric(text: string): RubricResult {
  // Strip code fences if the model added any
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  return {
    cefr: parsed.cefr ?? null,
    overall: numOrNull(parsed.overall),
    range: numOrNull(parsed.range),
    accuracy: numOrNull(parsed.accuracy),
    fluency: numOrNull(parsed.fluency),
    interaction: numOrNull(parsed.interaction),
    coherence: numOrNull(parsed.coherence),
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
  };
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}
