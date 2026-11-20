"use client";

import { useEffect, useState } from "react";

/**
 * "N Delulu players have voted" — social proof for the Flow State vote.
 * Small numbers read worse than none, so under 10 it's "Be one of the first".
 */
export function useFlowVotersLine(): string | null {
  const [voters, setVoters] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/flowstate")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { voters?: number } | null) => alive && typeof d?.voters === "number" && setVoters(d.voters))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (voters == null) return null;
  return voters >= 10 ? `🗳️ ${voters.toLocaleString("en-US")} Delulu players have voted · add yours` : "🗳️ Be one of the first Delulu players to vote";
}
