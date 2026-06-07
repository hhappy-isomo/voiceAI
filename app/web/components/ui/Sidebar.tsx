"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mic,
  ClipboardList,
  ClipboardCheck,
  UserPlus,
  LogOut,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const studentNav: Item[] = [
  { href: "/", label: "Today", icon: Mic },
];

const facilitatorNav: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/seed", label: "Seed roster", icon: UserPlus },
  { href: "/dashboard/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/dashboard/questionnaire", label: "Questionnaire", icon: ClipboardCheck },
];

export function Sidebar({
  role,
  bypass = false,
}: {
  role: "student" | "facilitator" | "superadmin";
  bypass?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isStaff = role === "facilitator" || role === "superadmin";
  const nav = bypass ? [...studentNav, ...facilitatorNav] : isStaff ? facilitatorNav : studentNav;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex md:w-64 shrink-0 flex-col gap-6 px-5 py-7">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center border border-fg bg-bg">
          <Sparkles className="h-4 w-4 text-fg" />
        </div>
        <div className="leading-tight">
          <div className="text-[18px] font-bold tracking-[0.15em]">IJWI</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-fg-muted">
            {role === "superadmin" ? "Superadmin" : "Voice · Pilot"}
          </div>
        </div>
      </div>

      <div className="h-px w-full bg-fg/20" />

      <nav className="flex flex-col gap-1.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 border px-3 py-2.5 transition-colors",
                active
                  ? "border-fg bg-fg text-bg"
                  : "border-transparent text-fg-dim hover:border-fg/30 hover:text-fg",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center border",
                  active
                    ? "border-bg bg-bg text-fg"
                    : "border-fg/30 text-fg-dim group-hover:border-fg group-hover:text-fg",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold uppercase tracking-wider">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1">
        <ThemeToggle />
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 border border-transparent px-3 py-2.5 text-sm uppercase tracking-wider text-fg-dim hover:border-fg/30 hover:text-fg transition-colors"
        >
          <span className="flex h-8 w-8 items-center justify-center border border-fg/30">
            <LogOut className="h-4 w-4" />
          </span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
