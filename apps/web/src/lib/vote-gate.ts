/**
 * The vote gate: an action calls `afterVote` first. A player who hasn't voted
 * sees the vote screen and the action waits. Voting lets it continue. "Not
 * now" cancels it. Everyone who has already voted, or who can't vote in this
 * round, goes straight through.
 *
 * The vote screen (components/flow-state/vote-prompt.tsx) registers the
 * handler. No handler (signed out, vote over) → the action just runs.
 */
type Handler = () => Promise<void>;

let handler: Handler | null = null;

export function registerVoteGate(h: Handler | null) {
  handler = h;
}

/** True when the action may go ahead. False when the player closed the vote. */
export function voteGate(): Promise<boolean> {
  if (!handler) return Promise.resolve(true);
  return handler().then(
    () => true,
    () => false,
  );
}

/** Run `action` once the player has voted, or immediately if they don't need to. */
export function afterVote<T>(action: () => T | Promise<T>): Promise<T | undefined> {
  return voteGate().then((ok) => (ok ? action() : undefined));
}
