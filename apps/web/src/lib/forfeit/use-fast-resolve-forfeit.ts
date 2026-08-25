"use client";

import { useEffect, useRef } from "react";
import type { ForfeitFeedItem } from "@/hooks/use-creator-forfeits";

/** Only worth a fast-path fetch for deadlines this close — day-scale goals are
 *  fine waiting for the 5-minute cron; short-duration goals aren't. */
const FAST_RESOLVE_WINDOW_SECONDS = 2 * 60 * 60; // 2 hours
/** Small buffer past the on-chain deadline so the contract's own deadline
 *  check (block.timestamp > currentPeriodDeadline) is unambiguously true by
 *  the time the request lands. */
const RESOLVE_BUFFER_SECONDS = 20;

/**
 * Companion to the 5-minute forfeit-deadline-check cron (GitHub Actions can't
 * schedule more often — see .github/workflows/forfeit-keeper.yml). For a
 * near-term deadline, up to 5 minutes of lag before a miss resolves on-chain
 * is a large fraction of a short-duration goal's whole lifespan. While the
 * app is open, this schedules a single fetch to /api/forfeit/resolve-if-overdue
 * right after each near-term deadline passes, so a missed short goal resolves
 * within seconds instead of waiting for the next cron sweep. Purely a
 * convenience fast-path — the cron remains the reliable backstop for when
 * the tab isn't open at the moment the deadline hits.
 */
export function useFastResolveForfeit(items: ForfeitFeedItem[], onResolved?: () => void) {
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    const timers = timersRef.current;

    for (const item of items) {
      const chain = item.onChain;
      const commitmentId = item.onChainCommitmentId;
      if (!chain?.active || chain.cancelled || commitmentId == null) continue;
      if (timers.has(commitmentId)) continue;

      const deadlineSec = Number(chain.currentPeriodDeadline ?? 0);
      if (!deadlineSec) continue;
      const secondsOut = deadlineSec - nowSec;
      if (secondsOut > FAST_RESOLVE_WINDOW_SECONDS) continue; // too far out — cron will get it

      const fireInMs = Math.max(0, secondsOut + RESOLVE_BUFFER_SECONDS) * 1000;
      const timer = setTimeout(() => {
        timers.delete(commitmentId);
        void fetch("/api/forfeit/resolve-if-overdue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onChainCommitmentId: commitmentId }),
        })
          .then(() => onResolved?.())
          .catch(() => {
            // Best-effort — the cron is the real backstop if this fails.
          });
      }, fireInMs);
      timers.set(commitmentId, timer);
    }
    // Deliberately no cleanup here — clearing on every re-run (e.g. a
    // react-query refetch returning a new `items` array) would cancel
    // still-pending timers that the `timers.has` guard above would then
    // refuse to reschedule. Real cleanup happens once, below, on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);
}
