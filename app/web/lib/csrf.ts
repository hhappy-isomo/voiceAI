import "server-only";
import { NextResponse } from "next/server";

// Same-origin check for mutating routes. Defeats CSRF where a third-party
// page POSTs to our API and rides the Supabase session cookie (SameSite=Lax
// allows top-level cross-site POSTs).
//
// Logic:
//   1. If Origin is present, it MUST match the request Host.
//   2. Else if Referer is present, its host MUST match the request Host.
//   3. Else (neither set) reject. All modern browsers send one on POST/PATCH/DELETE.
//
// Returns NextResponse on failure (so the caller can `return` it); null on pass.
export function checkSameOrigin(req: Request): NextResponse | null {
  const host = req.headers.get("host");
  if (!host) {
    return NextResponse.json({ error: "missing host" }, { status: 400 });
  }

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const u = new URL(origin);
      if (u.host !== host) {
        return NextResponse.json(
          { error: "cross-origin request rejected" },
          { status: 403 },
        );
      }
      return null;
    } catch {
      return NextResponse.json({ error: "bad origin" }, { status: 400 });
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      if (u.host !== host) {
        return NextResponse.json(
          { error: "cross-origin request rejected" },
          { status: 403 },
        );
      }
      return null;
    } catch {
      return NextResponse.json({ error: "bad referer" }, { status: 400 });
    }
  }

  return NextResponse.json(
    { error: "origin or referer required" },
    { status: 403 },
  );
}
