"use client";

import { useEffect, useRef, useState } from "react";

export function CountUp({
  value,
  suffix = "",
  duration = 700,
  decimals,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  decimals?: number;
}) {
  const [n, setN] = useState(0);
  const start = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    start.current = null;
    function tick(t: number) {
      if (start.current == null) start.current = t;
      const elapsed = t - start.current;
      const p = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const d =
    decimals != null
      ? decimals
      : Number.isInteger(value)
        ? 0
        : Math.min(2, (`${value}`.split(".")[1] ?? "").length);

  return (
    <span className="tabular-nums">
      {n.toLocaleString(undefined, {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })}
      {suffix}
    </span>
  );
}

