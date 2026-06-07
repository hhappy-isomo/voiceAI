"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "day" | "night";

function readTheme(): Theme {
  if (typeof document === "undefined") return "night";
  const t = document.documentElement.getAttribute("data-theme");
  return t === "day" ? "day" : "night";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("night");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "day" ? "night" : "day";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ijwi.theme", next);
    } catch {}
    setTheme(next);
  }

  const isDay = theme === "day";

  return (
    <button
      onClick={toggle}
      aria-label={isDay ? "Switch to night" : "Switch to day"}
      className="flex w-full items-center gap-3 border border-transparent px-3 py-2.5 text-sm uppercase tracking-wider text-fg-dim hover:border-fg/30 hover:text-fg transition-colors"
    >
      <span className="flex h-8 w-8 items-center justify-center border border-fg/30">
        {isDay ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
      {isDay ? "Night" : "Day"}
    </button>
  );
}
