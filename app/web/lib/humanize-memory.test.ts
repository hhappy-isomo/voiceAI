import { describe, it, expect } from "vitest";
import { humanizeMemory } from "./humanize-memory";

describe("humanizeMemory", () => {
  it("returns empty string for null/empty input", () => {
    expect(humanizeMemory(null, "Happy")).toBe("");
    expect(humanizeMemory("", "Happy")).toBe("");
  });

  it("substitutes User with the first name", () => {
    expect(humanizeMemory("User likes bowling.", "Happy")).toBe(
      "Happy likes bowling.",
    );
  });

  it("substitutes possessive User's", () => {
    expect(humanizeMemory("User's mom is a teacher.", "Charity")).toBe(
      "Charity's mom is a teacher.",
    );
  });

  it("substitutes lowercase user with you", () => {
    expect(humanizeMemory("Knows that user enjoys music.", "Happy")).toBe(
      "Knows that you enjoys music.",
    );
  });

  it("drops assistant-meta lines", () => {
    const raw =
      "User and friends go bowling together. | " +
      "Assistant has no specific prompt and is designed to have a conversation. | " +
      "User enjoys dating and having fun with friends.";
    const out = humanizeMemory(raw, "Happy");
    expect(out).toContain("Happy and friends go bowling");
    expect(out).toContain("Happy enjoys dating");
    expect(out.toLowerCase()).not.toContain("assistant has no specific prompt");
    expect(out.toLowerCase()).not.toContain("designed to have a conversation");
  });

  it("joins surviving lines with a space (not the Mem0 separator)", () => {
    const out = humanizeMemory("User likes X. | User likes Y.", "Happy");
    expect(out).toBe("Happy likes X. Happy likes Y.");
  });

  it("leaves text unchanged when name is missing", () => {
    expect(humanizeMemory("User likes bowling.", null)).toBe(
      "User likes bowling.",
    );
  });
});
