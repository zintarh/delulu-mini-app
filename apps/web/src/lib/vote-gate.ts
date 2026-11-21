/**
 * The vote gate: everyday actions (posting a Bingo photo, claiming free daily
 * money) call `voteGate()` first. A player who can vote and hasn't yet sees
 * the vote screen before the action goes ahead; once they've voted, the
 * action continues by itself. Everyone else goes straight through.
 *
 * The vote screen (components/flow-state/vote-prompt.tsx) registers the
 * handler. No handler (signed out, vote over) → the action just runs.
 */
type Handler = () => Promise<void>;

let handler: Handler | null = null;

export function registerVoteGate(h: Handler | null) {
  handler = h;
}

/** Resolves when the action may go ahead. Never rejects. */
export function voteGate(): Promise<void> {
  return handler ? handler().catch(() => undefined) : Promise.resolve();
}

/** Run `action` once the gate lets the player through. */
export function afterVote<T>(action: () => T | Promise<T>): Promise<T> {
  return voteGate().then(action);
}
