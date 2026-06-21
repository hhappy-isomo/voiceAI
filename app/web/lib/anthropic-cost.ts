// Per-token pricing for Claude Sonnet 4.6. Update when pricing changes.
// Cache writes are 1.25x input; cache reads are 0.1x input.
export const PRICE_IN  = 3e-6;     // $3 per Mtok
export const PRICE_OUT = 15e-6;    // $15 per Mtok
export const PRICE_CACHE_READ  = PRICE_IN * 0.1;
export const PRICE_CACHE_WRITE = PRICE_IN * 1.25;

export type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

// Real per-call cost: split input vs output vs cached. Anthropic's API
// reports input_tokens excluding cache_read and cache_creation, so all
// four counts add cleanly.
export function computeAnthropicCost(usage: Usage): {
  cost: number;
  totalTokens: number;
  inTok: number;
  outTok: number;
  readTok: number;
  writeTok: number;
} {
  const inTok    = usage.input_tokens ?? 0;
  const outTok   = usage.output_tokens ?? 0;
  const readTok  = usage.cache_read_input_tokens ?? 0;
  const writeTok = usage.cache_creation_input_tokens ?? 0;
  const cost =
    inTok    * PRICE_IN +
    outTok   * PRICE_OUT +
    readTok  * PRICE_CACHE_READ +
    writeTok * PRICE_CACHE_WRITE;
  return {
    cost,
    totalTokens: inTok + outTok + readTok + writeTok,
    inTok, outTok, readTok, writeTok,
  };
}
