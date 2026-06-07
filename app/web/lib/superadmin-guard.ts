import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireSuperadminApi(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  const { data: row } = await supabase
    .from("students")
    .select("role")
    .eq("student_id", user.id)
    .single();
  if (row?.role !== "superadmin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, userId: user.id };
}
