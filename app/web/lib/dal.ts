import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StudentRow = {
  student_id: string;
  display_name: string | null;
  cohort: "base" | "foundation";
  role: "student" | "facilitator";
  consent_given: boolean;
  enrolled_on: string;
};

export const BYPASS_AUTH = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1";
const BYPASS_ROLE: "student" | "facilitator" =
  process.env.NEXT_PUBLIC_DEV_BYPASS_ROLE === "facilitator"
    ? "facilitator"
    : "student";

const FAKE_USER_ID = "00000000-0000-0000-0000-000000000dev";

export const getUser = cache(async () => {
  if (BYPASS_AUTH) {
    return {
      id: FAKE_USER_ID,
      email: "dev@isomo.local",
      user_metadata: { full_name: "Dev Preview" },
    } as { id: string; email: string; user_metadata: { full_name: string } };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
});

export const getStudent = cache(async (): Promise<StudentRow> => {
  if (BYPASS_AUTH) {
    return {
      student_id: FAKE_USER_ID,
      display_name: "Dev Preview",
      cohort: "base",
      role: BYPASS_ROLE,
      consent_given: true,
      enrolled_on: new Date().toISOString().slice(0, 10),
    };
  }
  const user = await getUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("student_id, display_name, cohort, role, consent_given, enrolled_on")
    .eq("student_id", user.id)
    .single();
  if (error || !data) {
    throw new Error(`students row missing for ${user.id}: ${error?.message}`);
  }
  return data as StudentRow;
});

export const requireFacilitator = cache(async () => {
  const student = await getStudent();
  if (!BYPASS_AUTH && student.role !== "facilitator") redirect("/");
  return student;
});
