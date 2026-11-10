"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * One loading state for Home instead of a skeleton per card.
 *
 * The real cards mount straight away (hidden) so their data starts loading,
 * each reports when it's ready, and the page swaps one skeleton for all of
 * them at once. If something is slow (a flaky RPC), Home shows anyway after
 * `maxWaitMs` and only that card keeps its own placeholder.
 */
const ReportCtx = createContext<((_key: string, _ready: boolean) => void) | null>(null);

/** After the first reveal this session, coming back to Home shows it straight away (data is cached). */
let shownThisSession = false;

/** Cards call this; outside a HomeReadyGate it does nothing. */
export function useReportHomeReady(key: string, ready: boolean) {
  const report = useContext(ReportCtx);
  useEffect(() => {
    report?.(key, ready);
  }, [report, key, ready]);
}

export function HomeReadyGate({
  waitFor,
  extraReady = true,
  skeleton,
  children,
  maxWaitMs = 4000,
}: {
  /** Keys cards report via useReportHomeReady. */
  waitFor: string[];
  /** Readiness the page already knows itself (e.g. its own queries). */
  extraReady?: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  maxWaitMs?: number;
}) {
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [timedOut, setTimedOut] = useState(false);
  const [revealed, setRevealed] = useState(() => shownThisSession);

  const report = useCallback((key: string, isReady: boolean) => {
    setReady((r) => (r[key] === isReady ? r : { ...r, [key]: isReady }));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), maxWaitMs);
    return () => window.clearTimeout(id);
  }, [maxWaitMs]);

  const allReady = extraReady && waitFor.every((k) => ready[k]);
  // Once shown, never go back to the skeleton (a later refetch mustn't blank the page).
  useEffect(() => {
    if (allReady || timedOut) {
      shownThisSession = true;
      setRevealed(true);
    }
  }, [allReady, timedOut]);

  return (
    <ReportCtx.Provider value={report}>
      {revealed ? null : skeleton}
      {/* A class, not the hidden attribute: utility display classes would override [hidden]. */}
      <div className={revealed ? undefined : "hidden"} aria-hidden={!revealed}>
        {children}
      </div>
    </ReportCtx.Provider>
  );
}
