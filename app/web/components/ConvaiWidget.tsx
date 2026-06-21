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
      {/* Pinned + SRI-locked. Children join voice calls; if unpkg ever
          serves a tampered bundle the browser refuses to run it.
          Bumping the version means recomputing the integrity hash:
            curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A
      */}
      <Script
        src="https://unpkg.com/@elevenlabs/convai-widget-embed@0.14.4/dist/index.js"
        integrity="sha384-nZO9GQJlx3wPcYC/v9paE+aktIIUioukEuVdOKOMC9H7vHSmjqbR9/lZnrHQztzO"
        crossOrigin="anonymous"
        strategy="afterInteractive"
        async
      />
    </>
  );
}
