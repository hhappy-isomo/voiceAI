"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setPending(false);
      alert(error.message);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <Card glow className="w-full max-w-md">
        <div className="flex flex-col items-center gap-8 px-2 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center border border-fg bg-bg">
            <Sparkles className="h-6 w-6 text-fg" />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-[0.05em] uppercase">
              Isomo
            </h1>
            <p className="text-sm uppercase tracking-[0.2em] text-fg-dim">
              Your English speaking partner
            </p>
          </div>

          <button
            onClick={signIn}
            disabled={pending}
            className="group flex w-full items-center justify-center gap-3 border border-fg bg-fg px-5 py-3 text-sm font-bold uppercase tracking-wider text-bg transition-colors hover:bg-bg hover:text-fg disabled:opacity-60"
          >
            <GoogleGlyph />
            {pending ? "Opening Google…" : "Continue with Google"}
          </button>

          <p className="text-[11px] text-fg-muted leading-relaxed">
            We use your Google account just to sign you in. Only your anonymous
            ID is shared with the AI tutor — never your email or name.
          </p>
        </div>
      </Card>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.25h2.9c1.7-1.57 2.69-3.88 2.69-6.6Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.25c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.95 10.71A5.4 5.4 0 0 1 3.65 9c0-.6.1-1.17.3-1.71V4.96H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.04l3.01-2.33Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.96l3.01 2.33C4.66 5.16 6.65 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
