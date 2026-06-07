"use client";

export function Sparkline({
  data,
  width = 80,
  height = 24,
  strokeWidth = 1.5,
}: {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = data[data.length - 1];
  const lx = (data.length - 1) * stepX;
  const ly = height - ((last - min) / range) * height;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="square"
        strokeLinejoin="miter"
        points={points}
      />
      <rect x={lx - 1.5} y={ly - 1.5} width={3} height={3} fill="currentColor" />
    </svg>
  );
}
