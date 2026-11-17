/**
 * The Flow State vote drive. `voteUrl` is Delulu's page on Flow State (the
 * council / project link) — the guide's "Vote" button and the Home card use it.
 * Set `active: false` to take the Home card down when voting ends.
 */
export const FLOW_STATE = {
  active: true,
  /** e.g. "https://flowstate.network/flow-councils/celo/0x…" — paste Delulu's page here. */
  voteUrl: "https://flowstate.network/flow-councils/42220/0x889e0aadaa3f8b28a794ef70da147827c620a590",
  /** Optional "Voting ends Fri 28 Nov" line; null hides it. */
  endsOn: null as string | null,
};

export const flowStateLive = () => FLOW_STATE.active;
