export function splitValue(
  v: string | number,
): { num: number; suffix: string } | null {
  if (typeof v === "number") return Number.isFinite(v) ? { num: v, suffix: "" } : null;
  const m = v.trim().match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? { num: n, suffix: m[2] ?? "" } : null;
}
