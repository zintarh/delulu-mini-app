import { decodeFunctionData, parseAbi, zeroAddress, type Address, type Hex } from "viem";

/**
 * The Flow State vote drive — voted right here in Delulu, no MetaMask.
 *
 * A Flow Council is a plain contract: a GoodDollar-verified wallet claims its
 * votes through Flow State's eligibility API (one signed message, no fee —
 * their bot adds it as a voter), then casts them with one `vote()` call.
 * Adapted from Calebux/flowstate-vote-kit (rules, relay, receipt checks) and
 * checked against flow-state-coop/flow-council + /platform.
 *
 * Set `active: false` to take the Home card down when voting ends.
 */
export const FLOW_STATE = {
  active: true,
  /** Optional "Voting ends Fri 28 Nov" line; null hides it. */
  endsOn: null as string | null,
};
export const flowStateLive = () => FLOW_STATE.active;

// Pinned — never take a vote destination from a URL or request body.
/** Delulu's recipient address on the council (Flow State lists it as "Delulu"). Lowercase. */
export const PROJECT_RECIPIENT = "0x5f3dd795ad9d626f5c0621b339a243220bcbd025" as Address;
export const PROJECT_NAME = "Delulu";
/** GoodBuilders S5 council on Celo. */
export const FLOW_COUNCIL = "0x889e0aadaa3f8b28a794ef70da147827c620a590" as Address;
export const FLOW_CHAIN = 42220;
export const FLOW_URL = `https://flowstate.network/flow-councils/${FLOW_CHAIN}/${FLOW_COUNCIL}`;
export const FLOW_QUERY = `chainId=${FLOW_CHAIN}&councilId=${FLOW_COUNCIL}`;

// GoodDollar identity (Celo) — the same contract lib/identity/status.ts uses.
export const IDENTITY_CONTRACT = "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42" as Address;
export const IDENTITY_ABI = parseAbi(["function getWhitelistedRoot(address account) view returns (address)"]);
export const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

export const FLOW_ABI = parseAbi([
  "function getVoter(address) view returns ((address account, uint96 votingPower, (uint160 recipientId, uint96 amount)[] votes) voter)",
  "function getVotes(address) view returns ((address recipient, uint96 amount)[])",
  "function getRecipient(address) view returns ((address account, uint96 votes) recipient)",
  "function maxVotingSpread() view returns (uint8)",
  "function vote((address recipient, uint96 amount)[] votes)",
]);
export type FlowVote = { recipient: Address; amount: bigint };
export type FlowSnapshot = { votingPower: bigint; votes: readonly FlowVote[]; maxSpread: number; verified: boolean; recipientActive: boolean };

/** Flow State's claim message, byte for byte (platform: flow-councils/lib/claimMessage.ts). Grants nothing by itself. */
export function flowClaimMessage(address: Address, issuedAt: number) {
  const timestamp = new Date(Math.floor(issuedAt / 1000) * 1000).toISOString().replace(/\.\d+Z$/, "Z");
  return ["Claim voting rights in this Flow Council.", "", `Council: ${FLOW_COUNCIL}`, `Chain: ${FLOW_CHAIN}`, `Wallet: ${address.toLowerCase()}`, `Issued at: ${timestamp}`].join("\n");
}

/** Delulu's votes now, and the most it can get: everything not given to another project. */
export function flowAllocation(snapshot: FlowSnapshot) {
  const current = snapshot.votes.find((v) => v.recipient.toLowerCase() === PROJECT_RECIPIENT)?.amount ?? 0n;
  const other = snapshot.votes.filter((v) => v.recipient.toLowerCase() !== PROJECT_RECIPIENT && v.recipient !== zeroAddress);
  const otherTotal = other.reduce((sum, vote) => sum + vote.amount, 0n);
  const maximum = snapshot.votingPower > otherTotal ? snapshot.votingPower - otherTotal : 0n;
  return { current, other, otherTotal, maximum };
}

/**
 * The ballot: only Delulu's line. vote() changes just the recipients it's
 * given, so every vote the player gave other projects stays as it was.
 */
export function buildFlowVote(snapshot: FlowSnapshot, amount: bigint): FlowVote[] {
  if (!snapshot.verified) throw new Error("Verify your face first — it's what gives you votes.");
  if (!snapshot.recipientActive) throw new Error(`${PROJECT_NAME} isn't taking votes in this round right now.`);
  if (snapshot.votingPower <= 0n) throw new Error("Claim your votes first.");
  const { current, other, maximum } = flowAllocation(snapshot);
  if (amount <= 0n || amount > maximum) throw new Error("All your votes are on other projects. Change them on Flow State first.");
  if (amount === current) throw new Error(`You've already given ${PROJECT_NAME} these votes.`);
  if (snapshot.maxSpread > 0 && other.filter((v) => v.amount > 0n).length + 1 > snapshot.maxSpread) {
    throw new Error("Your ballot already backs the most projects allowed. Change it on Flow State first.");
  }
  return [{ recipient: PROJECT_RECIPIENT, amount }];
}

export function flowSnapshotKey(snapshot: FlowSnapshot) {
  return [snapshot.votingPower, snapshot.maxSpread, snapshot.verified, snapshot.recipientActive, ...snapshot.votes.map((v) => `${v.recipient.toLowerCase()}:${v.amount}`).sort()].join("|");
}

/** A mined transaction really is this player's Delulu vote of this amount (not a replacement / cancel). */
export function matchesFlowVoteTransaction(address: Address, amount: string, tx: { from: Address; to: Address | null; input: Hex; value: bigint }) {
  try {
    const decoded = decodeFunctionData({ abi: FLOW_ABI, data: tx.input });
    const entries = decoded.functionName === "vote" ? decoded.args[0] : [];
    return (
      tx.from.toLowerCase() === address.toLowerCase() &&
      tx.to?.toLowerCase() === FLOW_COUNCIL &&
      tx.value === 0n &&
      entries.length === 1 &&
      entries[0].recipient.toLowerCase() === PROJECT_RECIPIENT &&
      entries[0].amount.toString() === amount
    );
  } catch {
    return false;
  }
}
