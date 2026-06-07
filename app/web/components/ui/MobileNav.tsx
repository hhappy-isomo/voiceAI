"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Mic,
  ClipboardList,
  ClipboardCheck,
  UserPlus,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const studentNav: Item[] = [{ href: "/", label: "Today", icon: Mic }];

const facilitatorNav: Item[] = [
  { href: "/dashboard", label: "Dash", icon: LayoutDashboard },
  { href: "/dashboard/staff", label: "Staff", icon: ShieldCheck },
  { href: "/dashboard/seed", label: "Seed", icon: UserPlus },
  { href: "/dashboard/assessments", label: "Tests", icon: ClipboardList },
  { href: "/dashboard/questionnaire", label: "Survey", icon: ClipboardCheck },
];

export function MobileNav({
  role,
  bypass = false,
}: {
  role: "student" | "facilitator" | "superadmin";
  bypass?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<"day" | "night">("night");

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setTheme(t === "day" ? "day" : "night");
  }, []);

  const isStaff = role === "facilitator" || role === "superadmin";
  const items = bypass ? [...studentNav, ...facilitatorNav] : isStaff ? facilitatorNav : studentNav;

  function toggleTheme() {
    const next = theme === "day" ? "night" : "day";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ijwi.theme", next);
    } catch {}
    setTheme(next);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-fg bg-bg">
      <div className="flex">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 border-r border-fg/30 px-2 py-3 text-[9px] uppercase tracking-widest",
                active ? "bg-fg text-bg" : "text-fg-dim hover:text-fg",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
        <button
          onClick={toggleTheme}
          className="flex flex-col items-center justify-center gap-1 border-r border-fg/30 px-3 py-3 text-[9px] uppercase tracking-widest text-fg-dim hover:text-fg"
          aria-label="Toggle theme"
        >
          {theme === "day" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          {theme === "day" ? "Night" : "Day"}
        </button>
        <button
          onClick={signOut}
          className="flex flex-col items-center justify-center gap-1 px-3 py-3 text-[9px] uppercase tracking-widest text-fg-dim hover:text-fg"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
          Out
        </button>
      </div>
    </nav>
  );
}
