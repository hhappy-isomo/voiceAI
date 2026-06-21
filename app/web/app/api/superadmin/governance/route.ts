import { NextResponse } from "next/server";
import { requireSuperadminApi } from "@/lib/superadmin-guard";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/admin";

// Three POST actions on one endpoint; payload's "kind" decides.
//  kind=add_word     -> add a safety rule
//  kind=remove_word  -> delete by id
//  kind=set_consent  -> create a new consent_versions row and set it active

export async function POST(req: Request) {
  const guard = await requireSuperadminApi();
  if (!guard.ok) return guard.response;
  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind ?? "");
  const admin = adminClient();
  const supabase = await createServerClient();

  if (kind === "add_word") {
    const word = String(body.word_or_re ?? "").trim();
    if (!word) return NextResponse.json({ error: "word required" }, { status: 400 });
    if (word.length > 200) {
      return NextResponse.json(
        { error: "pattern too long (>200 chars)" },
        { status: 400 },
      );
    }
    if (body.is_regex) {
      // Validate the pattern compiles. We don't try to detect ReDoS — the
      // webhook caps work via Edge runtime timeout. Capping length above
      // keeps the search space bounded.
      try {
        new RegExp(word);
      } catch (e) {
        return NextResponse.json(
          { error: `invalid regex: ${(e as Error).message}` },
          { status: 400 },
        );
      }
    }
    const { error } = await admin.from("safety_rules").insert({
      word_or_re: word,
      is_regex: !!body.is_regex,
      severity: ["warn", "flag", "block"].includes(body.severity) ? body.severity : "warn",
      notes: body.notes ?? null,
      added_by: guard.userId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.rpc("log_audit", {
      p_action: "safety_rule_add",
      p_target_id: null,
      p_details: { word_or_re: word, severity: body.severity },
    });
    return NextResponse.json({ ok: true });
  }

  if (kind === "remove_word") {
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { error } = await admin.from("safety_rules").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.rpc("log_audit", {
      p_action: "safety_rule_remove",
      p_target_id: String(id),
      p_details: null,
    });
    return NextResponse.json({ ok: true });
  }

  if (kind === "set_consent") {
    const text = String(body.body ?? "").trim();
    if (!text || text.length < 30) {
      return NextResponse.json({ error: "consent body too short" }, { status: 400 });
    }
    // Deactivate old + insert new
    await admin.from("consent_versions").update({ is_active: false }).eq("is_active", true);
    const { data, error } = await admin
      .from("consent_versions")
      .insert({ body: text, is_active: true, created_by: guard.userId })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.rpc("log_audit", {
      p_action: "consent_version_set",
      p_target_id: String(data.id),
      p_details: { length: text.length },
    });
    return NextResponse.json({ ok: true, id: data.id });
  }

  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
