"use client";

import { useEffect, useState } from "react";
import { X, Calendar, Clock, Mic, Hash, ExternalLink, Sparkles, ShieldAlert } from "lucide-react";

export type SafetyFlag = {
  severity: "warn" | "flag" | "block";
  snippet: string | null;
};

export type SessionRow = {
  id: number;
  session_no: number | null;
  held_on: string;
  duration_seconds: number | null;
  student_talk_seconds: number | null;
  flagged_low_talk: boolean | null;
  safety_severity?: "clean" | "warn" | "flag" | "block" | null;
  safety_flags?: SafetyFlag[];
  topic: string | null;
  conversation_id?: string | null;
  transcript_url?: string | null;
  recording_url?: string | null;
};

export function SessionDrawer({
  session,
  onClose,
}: {
  session: SessionRow | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (session) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [session, onClose]);

  if (!session) return null;

  const dur = session.duration_seconds ?? 0;
  const talk = session.student_talk_seconds ?? 0;
  const talkPct = dur > 0 ? Math.min(100, Math.round((talk / dur) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-bg/80 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <aside className="relative h-full w-full max-w-lg overflow-y-auto border-l border-fg bg-bg p-6 scrollbar-thin">
        <div className="flex items-start justify-between border-b border-fg/30 pb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-fg-muted">
              Session
            </div>
            <div className="mt-1 text-3xl font-bold uppercase tabular-nums">
              {session.session_no ? `#${String(session.session_no).padStart(2, "0")}` : "—"}
            </div>
            {session.topic && (
              <div className="mt-1 text-sm text-fg-dim">{session.topic}</div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center border border-fg/30 text-fg-dim hover:border-fg hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="mt-5 space-y-0 border border-fg/20">
          <Row icon={Calendar} label="Date" value={session.held_on} />
          <Row
            icon={Clock}
            label="Duration"
            value={dur ? `${Math.round(dur / 60)} min · ${dur}s` : "—"}
          />
          <Row
            icon={Mic}
            label="Talk-time"
            value={
              <div className="space-y-2">
                <div className="font-bold tabular-nums">
                  {Math.round(talk / 60)} min · {talkPct}%
                  {session.flagged_low_talk && (
                    <span className="ml-2 border border-fg px-1.5 py-0.5 text-[9px] uppercase tracking-widest">
                      Low
                    </span>
                  )}
                </div>
                <div className="h-2 w-full border border-fg/40">
                  <div className="h-full bg-fg" style={{ width: `${talkPct}%` }} />
                </div>
              </div>
            }
          />
          {session.conversation_id && (
            <Row icon={Hash} label="Conv ID" value={
              <span className="font-mono text-[11px] break-all">{session.conversation_id}</span>
            } />
          )}
        </dl>

        {(session.safety_severity === "warn" ||
          session.safety_severity === "flag" ||
          session.safety_severity === "block") && (
          <div className="mt-5">
            <SectionLabel>
              <ShieldAlert className="mr-1 inline h-3 w-3" />
              Safety scan · {session.safety_severity.toUpperCase()}
            </SectionLabel>
            {session.safety_flags && session.safety_flags.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {session.safety_flags.map((f, i) => (
                  <li
                    key={i}
                    className="border border-fg/30 px-3 py-2 text-[12px] leading-relaxed"
                  >
                    <div className="text-[9px] font-bold uppercase tracking-widest text-fg-muted">
                      {f.severity}
                    </div>
                    <div className="mt-1 text-fg-dim italic">
                      {f.snippet ? `…${f.snippet}…` : "(no snippet)"}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 border border-dashed border-fg/30 px-4 py-3 text-[11px] uppercase tracking-widest text-fg-muted">
                Severity recorded; no individual hits stored
              </div>
            )}
          </div>
        )}

        <div className="mt-5">
          <SectionLabel>Recording</SectionLabel>
          {session.recording_url ? (
            <audio
              src={session.recording_url}
              controls
              className="mt-2 w-full"
              preload="none"
            />
          ) : (
            <div className="mt-2 border border-dashed border-fg/30 px-4 py-6 text-center text-[11px] uppercase tracking-widest text-fg-muted">
              No recording stored
            </div>
          )}
        </div>

        <div className="mt-5">
          <SectionLabel>Transcript</SectionLabel>
          {session.transcript_url ? (
            <a
              href={session.transcript_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-between border border-fg px-4 py-3 text-sm font-bold uppercase tracking-wider hover:bg-fg hover:text-bg"
            >
              Open transcript
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <div className="mt-2 border border-dashed border-fg/30 px-4 py-6 text-center text-[11px] uppercase tracking-widest text-fg-muted">
              No transcript yet
            </div>
          )}
        </div>

        <div className="mt-5">
          <SectionLabel>Auto-rubric (Claude)</SectionLabel>
          <AutoRubricPanel sessionId={session.id} hasTranscript={!!session.transcript_url} />
        </div>
      </aside>
    </div>
  );
}

type RubricResult = {
  cefr: string | null;
  overall: number | null;
  range: number | null;
  accuracy: number | null;
  fluency: number | null;
  interaction: number | null;
  coherence: number | null;
  rationale: string;
};

function AutoRubricPanel({
  sessionId,
  hasTranscript,
}: {
  sessionId: number;
  hasTranscript: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RubricResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function score() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auto-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
      } else {
        setResult(json.rubric);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (!hasTranscript) {
    return (
      <div className="mt-2 border border-dashed border-fg/30 px-4 py-6 text-center text-[11px] uppercase tracking-widest text-fg-muted">
        Needs transcript first
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      <button
        onClick={score}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 border border-fg bg-fg px-4 py-3 text-sm font-bold uppercase tracking-wider text-bg hover:bg-bg hover:text-fg disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {pending ? "Scoring…" : "Score with Claude"}
      </button>
      {error && (
        <div className="border border-fg px-3 py-2 text-[11px] text-fg-dim">
          {error}
        </div>
      )}
      {result && (
        <div className="border border-fg/30">
          <div className="grid grid-cols-2 gap-0 border-b border-fg/20">
            <div className="px-3 py-3">
              <div className="text-[10px] uppercase tracking-widest text-fg-muted">CEFR</div>
              <div className="mt-1 text-3xl font-bold uppercase tabular-nums">
                {result.cefr ?? "—"}
              </div>
            </div>
            <div className="border-l border-fg/20 px-3 py-3">
              <div className="text-[10px] uppercase tracking-widest text-fg-muted">Overall</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">
                {result.overall ?? "—"}
                <span className="text-base text-fg-muted"> / 6</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-0 border-b border-fg/20 text-center">
            <RScore label="Range" v={result.range} />
            <RScore label="Acc" v={result.accuracy} borderL />
            <RScore label="Flu" v={result.fluency} borderL />
            <RScore label="Inter" v={result.interaction} borderL />
            <RScore label="Coh" v={result.coherence} borderL />
          </div>
          {result.rationale && (
            <div className="px-3 py-3 text-[12px] leading-relaxed">
              {result.rationale}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RScore({
  label,
  v,
  borderL,
}: {
  label: string;
  v: number | null;
  borderL?: boolean;
}) {
  return (
    <div className={borderL ? "border-l border-fg/20 px-2 py-2" : "px-2 py-2"}>
      <div className="text-[9px] uppercase tracking-widest text-fg-muted">{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums">{v ?? "—"}</div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_auto_1fr] items-center gap-3 border-b border-fg/20 px-4 py-3 last:border-b-0">
      <Icon className="h-4 w-4 text-fg-muted" />
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-fg-muted">
      {children}
    </div>
  );
}
