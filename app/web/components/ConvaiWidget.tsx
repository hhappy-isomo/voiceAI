"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

export function ConvaiWidget({
  agentId,
  studentId,
}: {
  agentId: string;
  studentId: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !hostRef.current) return;
    const host = hostRef.current;
    host.innerHTML = "";
    const el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", agentId);
    el.setAttribute(
      "dynamic-variables",
      JSON.stringify({ student_id: studentId }),
    );
    host.appendChild(el);
  }, [mounted, agentId, studentId]);

  return (
    <>
      <div ref={hostRef} />
      <Script
        src="https://unpkg.com/@elevenlabs/convai-widget-embed"
        strategy="afterInteractive"
        async
      />
    </>
  );
}
