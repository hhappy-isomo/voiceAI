import { describe, it, expect } from "vitest";
import { parseRubric } from "./rubric";

describe("parseRubric", () => {
  it("parses a clean JSON response", () => {
    const r = parseRubric(JSON.stringify({
      cefr: "B1",
      overall: 3.5,
      range: 3,
      accuracy: 4,
      fluency: 3,
      interaction: 4,
      coherence: 3,
      rationale: "Solid B1 with occasional A2 lapses.",
    }));
    expect(r.cefr).toBe("B1");
    expect(r.overall).toBe(3.5);
    expect(r.range).toBe(3);
    expect(r.rationale).toMatch(/B1/);
  });

  it("strips ```json fences", () => {
    const r = parseRubric("```json\n" + JSON.stringify({
      cefr: "A2", overall: 2, range: 2, accuracy: 2, fluency: 2,
      interaction: 2, coherence: 2, rationale: "x",
    }) + "\n```");
    expect(r.cefr).toBe("A2");
  });

  it("strips ``` (no language) fences", () => {
    const r = parseRubric("```\n" + JSON.stringify({
      cefr: "B2", overall: 4, range: 4, accuracy: 4, fluency: 4,
      interaction: 4, coherence: 4, rationale: "x",
    }) + "\n```");
    expect(r.cefr).toBe("B2");
  });

  it("coerces non-finite numbers to null", () => {
    const r = parseRubric(JSON.stringify({
      cefr: null,
      overall: "not a number",
      range: NaN,
      accuracy: 3,
      fluency: 3,
      interaction: 3,
      coherence: 3,
      rationale: "Insufficient student speech.",
    }));
    expect(r.cefr).toBeNull();
    expect(r.overall).toBeNull();
    expect(r.range).toBeNull();
    expect(r.accuracy).toBe(3);
  });

  it("handles the insufficient-speech sentinel shape", () => {
    const r = parseRubric(JSON.stringify({
      cefr: null, overall: null, range: null, accuracy: null,
      fluency: null, interaction: null, coherence: null,
      rationale: "Insufficient student speech to score.",
    }));
    expect(r.cefr).toBeNull();
    expect(r.rationale).toMatch(/Insufficient/);
  });

  it("throws on garbage", () => {
    expect(() => parseRubric("not json")).toThrow();
  });

  it("defaults rationale to empty string when missing", () => {
    const r = parseRubric(JSON.stringify({
      cefr: "A2", overall: 2, range: 2, accuracy: 2,
      fluency: 2, interaction: 2, coherence: 2,
    }));
    expect(r.rationale).toBe("");
  });
});
