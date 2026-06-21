import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  retryAfter: number; // seconds
};

// Hit the SECURITY DEFINER rate_limit_check RPC. Service-role client only.
//   key:     stable identifier (e.g. "auto-rubric:<user_id>")
//   max:     allowed hits per window
//   window:  window length in seconds
export async function rateLimit(
  admin: SupabaseClient,
  key: string,
  max: number,
  window: number,
): Promise<RateLimitResult> {
  const { data, error } = await admin.rpc("rate_limit_check", {
    p_key: key,
    p_max: max,
    p_window_secs: window,
  });
  if (error) {
    // Fail-open. If the RPC isn't deployed (migration window) or errors,
    // don't take down the route. The cost cap is the hard ceiling.
    return { allowed: true, count: 0, retryAfter: 0 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: !!row?.allowed,
    count: Number(row?.hit_count ?? 0),
    retryAfter: Number(row?.retry_after_secs ?? 0),
  };
}

// Helper: turn a denied result into a 429 NextResponse with Retry-After.
export function rateLimitResponse(r: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: "rate_limited", retry_after_secs: r.retryAfter },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, r.retryAfter)) },
    },
  );
}
