"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";

const RECHECK_MS = 30_000;

type InviteState = {
  /** First lookup still in flight — hold the sign-in form so it doesn't flash. */
  checking: boolean;
  locked: boolean;
  username: string | null;
  pfpUrl: string | null;
};

/**
 * Looks up the referrer behind an invite code and whether their invite is on
 * hold (they missed a milestone and haven't posted today's proof — see
 * lib/referral/standing.ts). Rechecks every 30s while on hold so the invitee
 * gets through the moment the referrer posts. Fails open on errors.
 */
export function useInviteHold(code: string | null) {
  const [state, setState] = useState<InviteState>({
    checking: Boolean(code),
    locked: false,
    username: null,
    pfpUrl: null,
  });

  const check = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/referral/referrer?code=${encodeURIComponent(code)}`);
      const json = (await res.json()) as {
        found?: boolean;
        locked?: boolean;
        username?: string | null;
        pfpUrl?: string | null;
      };
      setState({
        checking: false,
        locked: Boolean(json.found && json.locked),
        username: json.username ?? null,
        pfpUrl: json.pfpUrl ?? null,
      });
    } catch {
      setState((s) => ({ ...s, checking: false, locked: false }));
    }
  }, [code]);

  useEffect(() => {
    if (!code) {
      setState({ checking: false, locked: false, username: null, pfpUrl: null });
      return;
    }
    setState((s) => ({ ...s, checking: true }));
    void check();
  }, [code, check]);

  useEffect(() => {
    if (!state.locked) return;
    const id = window.setInterval(() => void check(), RECHECK_MS);
    return () => window.clearInterval(id);
  }, [state.locked, check]);

  return { ...state, recheck: check };
}

export function ReferralInviteHold({
  username,
  pfpUrl,
  onRecheck,
}: {
  username: string | null;
  pfpUrl: string | null;
  onRecheck: () => Promise<void>;
}) {
  const [rechecking, setRechecking] = useState(false);
  const name = username ? `@${username}` : "Your friend";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-delulu-blue-light to-white p-6 dark:from-background dark:to-background">
      <div className="w-full max-w-sm rounded-3xl border border-border/80 bg-card p-6 text-center shadow-lg">
        <div className="relative mx-auto h-16 w-16">
          {pfpUrl ? (
            <img src={pfpUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-muted" />
          )}
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-foreground text-background">
            <Lock className="h-3.5 w-3.5" />
          </span>
        </div>

        <h2 className="mt-4 text-xl font-black tracking-tight text-foreground">
          {name}&apos;s invite is on hold
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          They need to post today&apos;s proof before you can join. We&apos;ve let them know you&apos;re waiting.
        </p>

        <button
          type="button"
          disabled={rechecking}
          onClick={async () => {
            setRechecking(true);
            try {
              await onRecheck();
            } finally {
              setRechecking(false);
            }
          }}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {rechecking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Check again
        </button>
      </div>
    </div>
  );
}
