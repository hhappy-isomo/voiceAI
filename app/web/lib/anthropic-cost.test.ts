import { describe, it, expect } from "vitest";
import {
  computeAnthropicCost,
  PRICE_IN,
  PRICE_OUT,
  PRICE_CACHE_READ,
  PRICE_CACHE_WRITE,
} from "./anthropic-cost";

describe("computeAnthropicCost", () => {
  it("returns zero for empty usage", () => {
    const r = computeAnthropicCost({});
    expect(r.cost).toBe(0);
    expect(r.totalTokens).toBe(0);
  });

  it("input + output", () => {
    const r = computeAnthropicCost({ input_tokens: 1000, output_tokens: 500 });
    expect(r.cost).toBeCloseTo(1000 * PRICE_IN + 500 * PRICE_OUT, 12);
    expect(r.totalTokens).toBe(1500);
  });

  it("output tokens are 5x input price (not blended)", () => {
    // The round-1 bug used one flat rate; this is the regression test.
    const a = computeAnthropicCost({ input_tokens: 1000 });
    const b = computeAnthropicCost({ output_tokens: 1000 });
    expect(b.cost).toBeCloseTo(a.cost * 5, 12);
  });

  it("cache reads cost 10% of regular input", () => {
    const r = computeAnthropicCost({ cache_read_input_tokens: 1_000_000 });
    expect(r.cost).toBeCloseTo(1_000_000 * PRICE_CACHE_READ, 9);
    expect(PRICE_CACHE_READ).toBeCloseTo(PRICE_IN * 0.1, 12);
  });

  it("cache creation costs 1.25x regular input", () => {
    const r = computeAnthropicCost({ cache_creation_input_tokens: 1_000_000 });
    expect(r.cost).toBeCloseTo(1_000_000 * PRICE_CACHE_WRITE, 9);
    expect(PRICE_CACHE_WRITE).toBeCloseTo(PRICE_IN * 1.25, 12);
  });

  it("breaks down a realistic call", () => {
    // 1k system prompt cached, 100 user tokens, 200 output
    const r = computeAnthropicCost({
      input_tokens: 100,
      output_tokens: 200,
      cache_read_input_tokens: 1000,
      cache_creation_input_tokens: 0,
    });
    const expected =
      100 * PRICE_IN +
      200 * PRICE_OUT +
      1000 * PRICE_CACHE_READ;
    expect(r.cost).toBeCloseTo(expected, 12);
    expect(r.totalTokens).toBe(1300);
  });
});
