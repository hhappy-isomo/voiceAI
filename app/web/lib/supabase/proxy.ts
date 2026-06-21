import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const BYPASS_AUTH = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1";

// Two portals, one app — split by URL prefix. The proxy gates by role
// BEFORE any HTML is rendered, so a student never sees a facilitator
// route (even briefly) and vice versa.
const FACILITATOR_PREFIX = "/dashboard";
const STUDENT_HOME = "/";
const FACILITATOR_HOME = "/dashboard";

export async function updateSession(request: NextRequest) {
  if (BYPASS_AUTH) {
    const path = request.nextUrl.pathname;
    if (path === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" ||
    path.startsWith("/auth/") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico" ||
    // Server-to-server: pg_cron hits this with X-Cron-Secret; the route
    // validates the secret itself, so no Supabase session is required.
    path.startsWith("/api/cron/");

  // Unauthenticated → /login (except public routes).
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated → look up role and enforce portal isolation.
  if (user) {
    // Already-signed-in users shouldn't see /login.
    if (path === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    const [{ data: row }, statusRes] = await Promise.all([
      supabase
        .from("students")
        .select("role, suspended")
        .eq("student_id", user.id)
        .maybeSingle(),
      // cost_caps RLS is staff-only by design; this RPC is SECURITY
      // DEFINER and exposes ONLY the two boolean flags students need.
      supabase.rpc("get_pilot_status"),
    ]);
    const caps = (Array.isArray(statusRes.data) ? statusRes.data[0] : statusRes.data) as
      | { kill_all: boolean | null; drain_mode: boolean | null }
      | undefined;
    const role = (row?.role ?? "student") as
      | "student"
      | "facilitator"
      | "superadmin";
    const isStaff = role === "facilitator" || role === "superadmin";
    const isSuper = role === "superadmin";

    // Suspended students lose portal access entirely.
    if (row?.suspended && !isStaff && path !== "/suspended") {
      const url = request.nextUrl.clone();
      url.pathname = "/suspended";
      return NextResponse.redirect(url);
    }

    // Kill switch on → block students from the portal (staff still get in).
    if (caps?.kill_all && !isStaff && path !== "/paused") {
      const url = request.nextUrl.clone();
      url.pathname = "/paused";
      return NextResponse.redirect(url);
    }

    // /superadmin/* requires superadmin role.
    if (path.startsWith("/superadmin") && !isSuper) {
      const url = request.nextUrl.clone();
      url.pathname = isStaff ? "/dashboard" : "/";
      return NextResponse.redirect(url);
    }

    const isFacilitatorRoute = path.startsWith(FACILITATOR_PREFIX);
    const isStudentRoot = path === "/";

    // Student trying to enter the facilitator portal → bounced to student home.
    if (!isStaff && isFacilitatorRoute) {
      const url = request.nextUrl.clone();
      url.pathname = STUDENT_HOME;
      return NextResponse.redirect(url);
    }

    // Staff landing on the student portal root → sent to their dashboard.
    if (isStaff && isStudentRoot) {
      const url = request.nextUrl.clone();
      url.pathname = FACILITATOR_HOME;
      return NextResponse.redirect(url);
    }
  }

  return response;
}
